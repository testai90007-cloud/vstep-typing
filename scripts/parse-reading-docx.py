#!/usr/bin/env python3
"""Parse the 4 VSTEP Reading DOCX banks (1000 tests) into chunked TS data files.

Input : ~/workspace/user/files/VSTEP-Reading-De-*.docx  (4 files x 250 tests)
Output: lib/reading-tests/data-*.ts   (chunked, each file <= ~100 KB so the
        Vercel deploy uploader accepts it)
        lib/reading-tests.ts          (types + chunk manifest + loadReadingTest)
        lib/test-titles.ts            (READING_TITLE_LIST regenerated)

DOCX structure per test:
    ĐỀ NNNN
    Part P — Đề NNNN – Bài đọc P: <title>
    <passage paragraphs...>
    Câu N. <question>
    A. ... / B. ... / C. ... / D. ...
    (x10 questions)
    (x4 parts)
    Đáp án
    1. X   2. X ... (40 answers: Part1 Q1-10, Part2 Q1-10, Part3, Part4)

Validation is strict: any deviation aborts with a clear error, and nothing
is written. Run: python3 scripts/parse-reading-docx.py
"""

import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCX_FILES = [
    Path.home() / "workspace/user/files/VSTEP-Reading-De-0001-0250.docx",
    Path.home() / "workspace/user/files/VSTEP-Reading-De-0251-0500.docx",
    Path.home() / "workspace/user/files/VSTEP-Reading-De-0501-0750.docx",
    Path.home() / "workspace/user/files/VSTEP-Reading-De-0751-1000.docx",
]
DATA_DIR = ROOT / "lib/reading-tests"
INDEX_TS = ROOT / "lib/reading-tests.ts"
TITLES_TS = ROOT / "lib/test-titles.ts"
MAX_CHUNK_BYTES = 88_000  # keep each data file's base64 (~4/3 x raw) under the
# deploy uploader's 125000 limit: 88_000 raw -> ~117_333 base64. The raw
# ceiling is ~93_750; 88_000 leaves a safe margin for the TS wrapper.

PARA_RE = re.compile(r"<w:p[ >].*?</w:p>", re.S)
RUN_RE = re.compile(r"<w:t[^>]*>(.*?)</w:t>|<w:tab\s*/>|<w:br\s*/>", re.S)
TEST_RE = re.compile(r"^ĐỀ (\d+)$")
PART_RE = re.compile(r"^Part\s+(\d+)\s*[—–-]\s*Đề\s+(\d+)\s*[—–-]\s*Bài đọc\s+(\d+):\s*(.+)$")
# Short variant found in 8 tests of file 3: "Part 1 — Tiệc Potluck Khu Phố"
# (no "Đề NNNN – Bài đọc N:" segment). "Part of ..." passage paragraphs do
# NOT match either pattern (no digit right after "Part ").
PART_SHORT_RE = re.compile(r"^Part\s+(\d+)\s*[—–-]\s*(.+)$")
Q_RE = re.compile(r"^Câu\s+(\d+)\.\s*(.+)$")
OPT_RE = re.compile(r"^([A-D])\.\s*(.+)$")
ANS_RE = re.compile(r"(\d+)\.\s*([A-D])")
ANS_HEAD_RE = re.compile(r"^Đáp án$")


def para_texts(docx_path: Path) -> list[str]:
    """Extract plain text of every Word paragraph, in order."""
    xml = zipfile.ZipFile(docx_path).read("word/document.xml").decode("utf-8")
    out: list[str] = []
    for para in PARA_RE.findall(xml):
        parts: list[str] = []
        for m in RUN_RE.finditer(para):
            if m.group(1) is not None:
                parts.append(m.group(1))
            else:
                parts.append(" ")  # tab / line break
        out.append("".join(parts).strip())
    return out


def parse_docx(docx_path: Path) -> list[dict]:
    tests: list[dict] = []
    test: dict | None = None
    part: dict | None = None
    question: dict | None = None
    expecting: str = "test"  # test | part | passage | question | option | answers
    opt_expected: str = "A"
    answers_needed = 0

    def fail(msg: str) -> None:
        raise ValueError(f"{docx_path.name}: {msg} (test={test['num'] if test else '?'})")

    for raw in para_texts(docx_path):
        if not raw:
            continue
        if expecting == "answers":
            # Accumulate answer lines until we have 40 (normally one paragraph).
            # A structural header here means the answer line is missing/short —
            # fail loudly instead of swallowing the next test's content.
            if TEST_RE.match(raw) or PART_RE.match(raw) or Q_RE.match(raw):
                fail(f"expected answer line, got structural header: {raw[:80]!r}")
            pairs = ANS_RE.findall(raw)
            if not pairs:
                fail(f"expected answer line, got: {raw[:80]!r}")
            for num_s, letter in pairs:
                if test is None:
                    fail("answer line without a test")
                test["_answers"].append((int(num_s), letter))
            if len(test["_answers"]) >= 40:
                if len(test["_answers"]) != 40:
                    fail(f"expected 40 answers, got {len(test['_answers'])}")
                nums = [n for n, _ in test["_answers"]]
                if nums != list(range(1, 11)) * 4:
                    fail(f"answer numbering is not 1..10 x4: {nums}")
                expecting = "test"
                # assign answers part-major
                idx = 0
                for p in test["parts"]:
                    for q in p["questions"]:
                        q["answer"] = "ABCD".index(test["_answers"][idx][1])
                        idx += 1
                del test["_answers"]
                tests.append(test)
                test = None
            continue

        m = TEST_RE.match(raw)
        if m and expecting == "test":
            num = int(m.group(1))
            if any(t["num"] == num for t in tests):
                fail(f"duplicate test number {num}")
            test = {"id": f"rd-{num:04d}", "num": num, "title": f"Đề {num:04d}",
                    "timeMin": 60, "parts": [], "_answers": []}
            expecting = "part"
            continue

        m = PART_RE.match(raw)
        if m and expecting in ("part", "test", "passage") and test is not None:
            pnum, dnum, bnum, title = int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4).strip()
            if dnum != test["num"] or bnum != pnum:
                fail(f"Part header mismatch: Part {pnum} Đề {dnum} Bài đọc {bnum}")
            if pnum != len(test["parts"]) + 1:
                fail(f"Part {pnum} out of order")
            if not title:
                fail("empty passage title")
            part = {"title": title, "paragraphs": [], "questions": []}
            test["parts"].append(part)
            expecting = "passage"
            continue

        m = PART_SHORT_RE.match(raw)
        if m and expecting in ("part", "test", "passage") and test is not None:
            pnum, title = int(m.group(1)), m.group(2).strip()
            if pnum != len(test["parts"]) + 1:
                fail(f"Part {pnum} out of order (short header)")
            if not title:
                fail("empty passage title (short header)")
            part = {"title": title, "paragraphs": [], "questions": []}
            test["parts"].append(part)
            expecting = "passage"
            continue

        m = Q_RE.match(raw)
        if m and expecting in ("passage", "option") and part is not None:
            qnum, qtext = int(m.group(1)), m.group(2).strip()
            if qnum != len(part["questions"]) + 1:
                fail(f"Câu {qnum} out of order")
            if not qtext:
                fail("empty question text")
            question = {"q": qtext, "options": [], "answer": -1}
            part["questions"].append(question)
            expecting = "option"
            opt_expected = "A"
            continue

        m = OPT_RE.match(raw)
        if m and expecting == "option" and question is not None:
            letter, otext = m.group(1), m.group(2).strip()
            if letter != opt_expected:
                fail(f"option {letter} out of order, expected {opt_expected}")
            if not otext:
                fail(f"empty option {letter}")
            question["options"].append(otext)
            opt_expected = chr(ord(opt_expected) + 1)
            if letter == "D":
                expecting = "passage"  # next: more questions, or Đáp án
            continue

        if ANS_HEAD_RE.match(raw) and part is not None and len(test["parts"]) == 4:
            if any(len(p["questions"]) != 10 for p in test["parts"]):
                fail("Đáp án heading before all 4 parts have 10 questions")
            expecting = "answers"
            answers_needed = 40
            continue

        if expecting == "passage" and part is not None and len(part["questions"]) == 0:
            part["paragraphs"].append(raw)
            continue

        if expecting == "test" and test is None:
            # File preamble (bank title, instructions) before the first ĐỀ.
            continue

        fail(f"unexpected paragraph in state {expecting}: {raw[:120]!r}")

    if test is not None:
        fail("file ended mid-test")
    return tests


def validate_all(tests: list[dict]) -> None:
    nums = sorted(t["num"] for t in tests)
    if nums != list(range(1, 1001)):
        missing = [n for n in range(1, 1001) if n not in nums]
        dupes = [n for n, c in Counter(t["num"] for t in tests).items() if c > 1]
        raise ValueError(f"test numbers are not exactly 1..1000 (missing={missing[:10]}, dupes={dupes[:10]})")
    dist = Counter()
    titles = Counter()
    for t in tests:
        if len(t["parts"]) != 4:
            raise ValueError(f"test {t['num']}: {len(t['parts'])} parts")
        for p in t["parts"]:
            if not p["paragraphs"]:
                raise ValueError(f"test {t['num']} part {p['title'][:40]}: no passage paragraphs")
            if len(p["questions"]) != 10:
                raise ValueError(f"test {t['num']} part {p['title'][:40]}: {len(p['questions'])} questions")
            titles[p["title"]] += 1
            for q in p["questions"]:
                if len(q["options"]) != 4:
                    raise ValueError(f"test {t['num']}: question has {len(q['options'])} options")
                if q["answer"] not in (0, 1, 2, 3):
                    raise ValueError(f"test {t['num']}: invalid answer {q['answer']}")
                if not q["q"].strip() or any(not o.strip() for o in q["options"]):
                    raise ValueError(f"test {t['num']}: empty question/option")
                dist["ABCD"[q["answer"]]] += 1
    print(f"Answer distribution (40000): {dict(sorted(dist.items()))}")
    dup_titles = {k: v for k, v in titles.items() if v > 1}
    if dup_titles:
        print(f"NOTE: {len(dup_titles)} passage titles appear in >1 test (bank may reuse passages):")
        for k, v in list(dup_titles.items())[:10]:
            print(f"  x{v}  {k[:80]}")


def write_data_files(tests: list[dict]) -> list[int]:
    """Pack tests into chunk files, each <= MAX_CHUNK_BYTES. Returns chunk_of[num-1]."""
    for old in DATA_DIR.glob("data-*.ts"):
        old.unlink()
    chunk_of: list[int] = []
    chunk = 0
    buf: list[str] = []
    buf_size = 0

    def flush() -> None:
        nonlocal chunk, buf, buf_size
        if not buf:
            return
        chunk += 1
        name = f"data-{chunk:03d}"
        first = int(buf[0].split('"num":')[1].split(",")[0])
        last = int(buf[-1].split('"num":')[1].split(",")[0])
        content = (
            f"// Reading tests {first:04d} → {last:04d}.\n"
            f"import type {{ ReadingTest }} from '../reading-tests';\n\n"
            f"export const DATA_{chunk:03d}: ReadingTest[] = [\n"
            + ",\n".join(buf)
            + "\n];\n"
        )
        (DATA_DIR / f"{name}.ts").write_text(content, encoding="utf-8")
        print(f"  {name}.ts: {len(buf)} tests ({first:04d}-{last:04d}), {len(content.encode())} bytes")
        buf, buf_size = [], 0

    for t in tests:
        line = json.dumps(t, ensure_ascii=False, separators=(",", ":"))
        if buf and buf_size + len(line.encode()) + 2 > MAX_CHUNK_BYTES:
            flush()
        buf.append(line)
        buf_size += len(line.encode()) + 2
        chunk_of.append(chunk + 1)  # chunk not yet flushed counts as chunk+1
    flush()
    return chunk_of


def write_index_ts(chunk_of: list[int]) -> None:
    manifest = ", ".join(str(c) for c in chunk_of)
    content = f"""// ---------------------------------------------------------------------------
// Reading test bank: 1000 tests (Đề 0001–1000), GENERATED from the four
// VSTEP-Reading-De-*.docx files by scripts/parse-reading-docx.py — do NOT
// hand-edit. Re-run the parser after changing the source docx files.
//
// The bank is ~36 MB, far too large to bundle into one page chunk, so tests
// live in chunked files (lib/reading-tests/data-*.ts) and are loaded on
// demand via loadReadingTest(). The list page uses READING_TITLE_LIST in
// lib/test-titles.ts and never imports this bank.
// ---------------------------------------------------------------------------

export interface ReadingQuestion {{
  q: string;
  options: string[];
  answer: number;
}}

export interface ReadingPassage {{
  title: string;
  paragraphs: string[];
  questions: ReadingQuestion[];
}}

export interface ReadingTest {{
  id: string;
  num: number;
  title: string;
  timeMin: number;
  parts: ReadingPassage[];
}}

export const READING_TEST_COUNT = 1000;

/** READING_CHUNK_OF[num - 1] = chunk file holding test `num`. */
export const READING_CHUNK_OF: number[] = [{manifest}];

/**
 * Load one test by id (e.g. "rd-0001"). Returns null when the id is unknown.
 * Uses a dynamic import so only the requested test's chunk (~100 KB) is
 * fetched — the full 1000-test bank is never bundled into a page.
 */
export async function loadReadingTest(id: string): Promise<ReadingTest | null> {{
  const m = /^rd-(\\d+)$/.exec(id);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (num < 1 || num > READING_TEST_COUNT) return null;
  const chunk = READING_CHUNK_OF[num - 1];
  const pad = String(chunk).padStart(3, "0");
  const mod = (await import(`./reading-tests/data-${{pad}}`)) as Record<
    string,
    ReadingTest[]
  >;
  const tests = mod[`DATA_${{pad}}`] ?? [];
  return tests.find((t) => t.num === num) ?? null;
}}
"""
    INDEX_TS.write_text(content, encoding="utf-8")
    print(f"wrote {INDEX_TS.relative_to(ROOT)} ({len(content.encode())} bytes)")


def write_title_list(tests: list[dict]) -> None:
    src = TITLES_TS.read_text(encoding="utf-8")
    entries = "".join(
        f'  {{ id: "rd-{t["num"]:04d}", num: {t["num"]}, title: "Đề {t["num"]:04d}" }},\n'
        for t in tests
    )
    new_src, n = re.subn(
        r"(export const READING_TITLE_LIST: TestTitleEntry\[\] = \[).*?(\n\];)",
        lambda m: m.group(1) + "\n" + entries.rstrip("\n") + m.group(2),
        src,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise ValueError("READING_TITLE_LIST block not found in lib/test-titles.ts")
    new_src = new_src.replace(
        "/** Reading: 200 tests, ordered by num. */",
        "/** Reading: 1000 tests, ordered by num. */",
    )
    TITLES_TS.write_text(new_src, encoding="utf-8")
    print(f"wrote READING_TITLE_LIST (1000 entries) into {TITLES_TS.relative_to(ROOT)}")


def main() -> int:
    all_tests: list[dict] = []
    for path in DOCX_FILES:
        if not path.exists():
            print(f"MISSING: {path}")
            return 1
        tests = parse_docx(path)
        print(f"{path.name}: {len(tests)} tests (Đề {tests[0]['num']:04d}–{tests[-1]['num']:04d})")
        all_tests.extend(tests)
    all_tests.sort(key=lambda t: t["num"])
    validate_all(all_tests)
    print("Writing data files...")
    chunk_of = write_data_files(all_tests)
    print(f"{len(set(chunk_of))} chunk files, max chunk = {max(chunk_of)}")
    write_index_ts(chunk_of)
    write_title_list(all_tests)
    total_q = sum(len(p["questions"]) for t in all_tests for p in t["parts"])
    print(f"OK: {len(all_tests)} tests, {total_q} questions, "
          f"{sum(len(p['paragraphs']) for t in all_tests for p in t['parts'])} passage paragraphs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
