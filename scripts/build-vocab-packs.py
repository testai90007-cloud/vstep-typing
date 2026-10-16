#!/usr/bin/env python3
"""Build compact STATIC definition packs for the vocab games.

Why: deck building used to call POST /api/vocab/define at game time.
Only the first ~50 A1 words were cache-warm; a random 100-word wave took
~25s (cold words hit the flaky Dictionary API + Wiktionary fallback), and
multi-wave games (synant/fill/listening) multiplied that. The game shell now
reads these packs (one static JSON per level, split into <=85KB chunks so
deploy.py's base64 cap is never hit) and builds decks locally with ZERO API
calls. The API remains as a fallback for words missing from a pack.

Usage: build-vocab-packs.py [a1|a2|b1|b2|c1 ...]  (default: all)
- Fetches via the production batch API (also warms the DB cache).
- Raw API results are cached in ~/workspace/vocab-packs-cache/ so a
  killed run resumes without re-fetching.
- Chunks are staged in ~/workspace/vocab-packs-tmp/ (outside the project,
  so deploy.py never uploads them), then moved into
  public/vocab-defs/ level by level; index.json is updated per level, so
  each level goes live independently as soon as its chunks land.
- Pack entry keys: d=first definition, e=example (prefer one containing
  the word), a=audio, p=phonetic, o=part of speech, s=synonyms (<=6),
  t=antonyms (<=6). Words with no definition are omitted.
"""
import json
import os
import re
import shutil
import sys
import time
import urllib.request

BASE = "https://vstep-typing.vercel.app"
BATCH = 100
PAUSE = 2.0
ROOT = "/home/hatch/workspace/vstep-typing"
CACHE_DIR = "/home/hatch/workspace/vocab-packs-cache"
TMP_DIR = "/home/hatch/workspace/vocab-packs-tmp"
OUT_DIR = f"{ROOT}/public/vocab-defs"
MAX_CHUNK_BYTES = 85_000
ALL_LEVELS = ["a1", "a2", "b1", "b2", "c1"]


def load_words(level: str) -> list[str]:
    with open(f"{ROOT}/lib/vocab/words-{level}.json", encoding="utf-8") as f:
        return json.load(f)


def post_batch(words: list[str]) -> dict:
    req = urllib.request.Request(
        f"{BASE}/api/vocab/define",
        data=json.dumps({"words": words}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as res:
        return json.load(res)


def cache_path(level: str) -> str:
    return f"{CACHE_DIR}/{level}.json"


def load_cache(level: str) -> dict:
    try:
        with open(cache_path(level), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_cache(level: str, cache: dict) -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)
    tmp = cache_path(level) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)
    os.replace(tmp, cache_path(level))


def build_entry(word: str, d: dict):
    if not d.get("found"):
        return None
    meanings = d.get("meanings") or []
    if not meanings:
        return None
    first = meanings[0]
    defs = first.get("definitions") or []
    if not defs:
        return None
    text = defs[0].get("definition") or ""
    if not text:
        return None
    pat = re.compile(r"\b" + re.escape(word) + r"\b", re.I)
    ex = ""
    for m in meanings:  # prefer an example that actually contains the word
        for dd in m.get("definitions") or []:
            if dd.get("example") and pat.search(dd["example"]):
                ex = dd["example"]
                break
        if ex:
            break
    if not ex:
        for m in meanings:
            for dd in m.get("definitions") or []:
                if dd.get("example"):
                    ex = dd["example"]
                    break
            if ex:
                break
    return {
        "d": text,
        "e": ex,
        "a": d.get("audio") or "",
        "p": d.get("phonetic") or "",
        "o": first.get("pos") or "",
        "s": (d.get("synonyms") or [])[:6],
        "t": (d.get("antonyms") or [])[:6],
    }


def fetch_missing(level: str, words: list[str], cache: dict) -> None:
    """Fetch every word not yet in cache (None = fetched but not found)."""
    todo = [w for w in words if w not in cache]
    print(f"[{level}] {len(words)} words, {len(todo)} to fetch", flush=True)
    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        try:
            data = post_batch(batch)
            results = data.get("results", {})
            for w in batch:
                cache[w] = results.get(w)
            found = sum(1 for w in batch if (results.get(w) or {}).get("found"))
            print(f"[{level}] fetched {i + len(batch)}/{len(todo)} found {found}/{len(batch)}", flush=True)
        except Exception as e:  # noqa: BLE001 - log, mark failed, move on
            print(f"[{level}] batch {i}-{i + len(batch)} FAILED: {e}", flush=True)
            for w in batch:
                cache.setdefault(w, None)
        save_cache(level, cache)
        time.sleep(PAUSE)
    # One retry for words that came back not-found (may have been transient).
    retry = [w for w in words if not (cache.get(w) or {}).get("found")]
    if retry:
        print(f"[{level}] retrying {len(retry)} not-found words", flush=True)
        for i in range(0, len(retry), BATCH):
            batch = retry[i : i + BATCH]
            try:
                data = post_batch(batch)
                results = data.get("results", {})
                for w in batch:
                    if (results.get(w) or {}).get("found"):
                        cache[w] = results[w]
                found = sum(1 for w in batch if (results.get(w) or {}).get("found"))
                print(f"[{level}] retry {i + len(batch)}/{len(retry)} found {found}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"[{level}] retry batch FAILED: {e}", flush=True)
            save_cache(level, cache)
            time.sleep(PAUSE)


def write_level(level: str, words: list[str], cache: dict) -> int:
    """Build compact entries, split into chunks, move into public/vocab-defs."""
    entries: dict[str, dict] = {}
    for w in words:
        entry = build_entry(w, cache.get(w) or {})
        if entry:
            entries[w] = entry
    os.makedirs(TMP_DIR, exist_ok=True)
    chunks: list[dict] = []
    cur: dict[str, dict] = {}
    for w, entry in entries.items():
        cur[w] = entry
        if len(json.dumps({"words": cur}, ensure_ascii=False, separators=(",", ":")).encode()) > MAX_CHUNK_BYTES:
            del cur[w]
            chunks.append({"words": cur})
            cur = {w: entry}
    if cur:
        chunks.append({"words": cur})
    os.makedirs(OUT_DIR, exist_ok=True)
    for i, chunk in enumerate(chunks):
        with open(f"{TMP_DIR}/{level}-{i}.json", "w", encoding="utf-8") as f:
            json.dump(chunk, f, ensure_ascii=False, separators=(",", ":"))
    for i in range(len(chunks)):
        shutil.move(f"{TMP_DIR}/{level}-{i}.json", f"{OUT_DIR}/{level}-{i}.json")
    # Remove stale chunks from a previous longer build of this level.
    i = len(chunks)
    while os.path.exists(f"{OUT_DIR}/{level}-{i}.json"):
        os.remove(f"{OUT_DIR}/{level}-{i}.json")
        i += 1
    index_path = f"{OUT_DIR}/index.json"
    try:
        with open(index_path, encoding="utf-8") as f:
            index = json.load(f)
    except (OSError, ValueError):
        index = {}
    index[level] = len(chunks)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)
    total = sum(os.path.getsize(f"{OUT_DIR}/{level}-{i}.json") for i in range(len(chunks)))
    print(f"[{level}] pack: {len(entries)}/{len(words)} words, {len(chunks)} chunks, {total} bytes", flush=True)
    return len(chunks)


def main(levels: list[str]) -> None:
    for level in levels:
        words = load_words(level)
        cache = load_cache(level)
        fetch_missing(level, words, cache)
        write_level(level, words, cache)
        print(f"[{level}] done", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:] or ALL_LEVELS)
