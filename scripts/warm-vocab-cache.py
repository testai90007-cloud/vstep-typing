#!/usr/bin/env python3
"""Warm the production vocab_cache by POSTing word batches to /api/vocab/define.

Usage: warm-vocab-cache.py [a1|a2|b1|b2|c1 ...]  (default: a1 a2)
- 50 words per batch, 2s pause between batches (gentle on Dictionary API).
- Words that come back not-found are retried once at the end (they may have
  timed out / 429'd rather than truly missing from the dictionary).
- Progress is printed per batch; cache writes on the server are durable, so
  a killed run can simply be re-run (already-cached words return fast).
"""
import json
import sys
import time
import urllib.request

BASE = "https://vstep-typing.vercel.app"
BATCH = 50
PAUSE = 2.0
ROOT = "/home/hatch/workspace/vstep-typing/lib/vocab"


def load_words(level: str) -> list[str]:
    with open(f"{ROOT}/words-{level}.json", encoding="utf-8") as f:
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


def warm(levels: list[str]) -> None:
    for level in levels:
        words = load_words(level)
        print(f"[{level}] {len(words)} words", flush=True)
        not_found: list[str] = []
        for i in range(0, len(words), BATCH):
            batch = words[i : i + BATCH]
            try:
                data = post_batch(batch)
            except Exception as e:  # noqa: BLE001 - log and move on
                print(f"[{level}] batch {i}-{i + len(batch)} FAILED: {e}", flush=True)
                not_found.extend(batch)
                time.sleep(PAUSE)
                continue
            results = data.get("results", {})
            found = sum(1 for v in results.values() if v.get("found"))
            not_found.extend(
                w for w in batch if not results.get(w, {}).get("found")
            )
            print(
                f"[{level}] {i + len(batch)}/{len(words)} found {found}/{len(batch)}",
                flush=True,
            )
            time.sleep(PAUSE)
        # One retry pass for words that came back not-found (timeouts/429s).
        if not_found:
            print(f"[{level}] retrying {len(not_found)} not-found words", flush=True)
            for i in range(0, len(not_found), BATCH):
                batch = not_found[i : i + BATCH]
                try:
                    data = post_batch(batch)
                    results = data.get("results", {})
                    found = sum(1 for v in results.values() if v.get("found"))
                    print(f"[{level}] retry {i + len(batch)}/{len(not_found)} found {found}", flush=True)
                except Exception as e:  # noqa: BLE001
                    print(f"[{level}] retry batch FAILED: {e}", flush=True)
                time.sleep(PAUSE)
        print(f"[{level}] done", flush=True)


if __name__ == "__main__":
    warm(sys.argv[1:] or ["a1", "a2"])
