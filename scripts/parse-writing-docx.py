#!/usr/bin/env python3
"""Parse the 5 VSTEP Writing DOCX banks (5000 tests) into chunked TS data files.

Input : ~/workspace/user/files/VSTEP-Writing-De-*.docx  (5 files x 1000 tests)
Output: lib/writing-tests/data-*.ts   (chunked, each file <= ~88 KB raw so its
        base64 stays under the deploy uploader's 125000 limit)
        lib/writing-tests.ts          (types + chunk manifest + loadWritingTest)
        lib/writing-titles/data-*.ts  (chunked title list, same size limit)
        lib/writing-titles.ts         (WRITING_TITLE_LIST, concatenated)

DOCX structure per test:
    ĐỀ NNNN
    TASK 1 (Part 1): <type> — <topic>
    Trình độ: B1|B2|C1 | Tối thiểu: 120 từ | Thời gian: 20 phút
    <Vietnamese summary>
    You should spend about 20 minutes on this task.
    <situation paragraph>
    Write a letter/email to ... In your letter, you should:   (sometimes absent
        / phrased "Write an email to ...")
    <3 bullet lines>                                           (occasionally 2 or 4)
    <requirement line>            (occasionally split, shortened, or missing)
    TASK 2 (Part 2): <type> — <topic>
    Trình độ: B2|C1 | Tối thiểu: 250 từ | Thời gian: 40 phút
    <Vietnamese summary>
    You should spend about 40 minutes on this task.
    <background / statement paragraphs>
    <question line>               (occasionally wrapped in double quotes)
    <requirement line>            (occasionally split across 2 paragraphs)

Parsing is positional (Trình độ / summary / intro / body / question /
requirement), not pattern-based, so the variants above are handled.
Known variants are normalized with an anomaly log; structural violations
(wrong header order, bad intro, unparseable Trình độ line) abort.
Run: python3 scripts/parse-writing-docx.py
"""

import html
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCX_FILES = [
    Path.home() / "workspace/user/files/VSTEP-Writing-De-0001-1000.docx",
    Path.home() / "workspace/user/files/VSTEP-Writing-De-1001-2000.docx",
    Path.home() / "workspace/user/files/VSTEP-Writing-De-2001-3000.docx",
    Path.home() / "workspace/user/files/VSTEP-Writing-De-3001-4000.docx",
    Path.home() / "workspace/user/files/VSTEP-Writing-De-4001-5000.docx",
]
DATA_DIR = ROOT / "lib/writing-tests"
INDEX_TS = ROOT / "lib/writing-tests.ts"
TITLES_DIR = ROOT / "lib/writing-titles"
TITLES_INDEX_TS = ROOT / "lib/writing-titles.ts"
MAX_CHUNK_BYTES = 88_000

STD_INTRO_20 = "You should spend about 20 minutes on this task."
STD_INTRO_40 = "You should spend about 40 minutes on this task."
INTRO1 = {STD_INTRO_20, "You have 20 minutes to write this task."}
INTRO2 = {STD_INTRO_40, "You have 40 minutes to write this task."}
STD_REQ_120 = ("You should write at least 120 words. "
               "You do not need to include your name or addresses.")
STD_REQ_250 = ("You should write at least 250 words. Give reasons for your answer "
               "and include any relevant examples from your own knowledge or experience.")

PARA_RE = re.compile(r"<w:p[ >].*?</w:p>", re.S)
RUN_RE = re.compile(r"<w:t[^>]*>(.*?)</w:t>|<w:tab\s*/>|<w:br\s*/>", re.S)
TEST_RE = re.compile(r"^ĐỀ (\d+)$")
TASK1_RE = re.compile(r"^TASK 1 \(Part 1\): (.+)$")
TASK2_RE = re.compile(r"^TASK 2 \(Part 2\): (.+)$")
LEVEL_RE = re.compile(
    r"^Trình độ:\s*(\S+)\s*\|\s*Tối thiểu:\s*(\d+) từ\s*\|\s*Thời gian:\s*(\d+) phút$")
WRITE_RE = re.compile(
    r"^Write (an? (letter|email|formal)|the letter)"
    r"|^In your (letter|email), you should")
REQ1_FRAGS = (
    re.compile(r"^You should write at least 120 words"),
    re.compile(r"^Write at least 120 words\.$"),
    re.compile(r"^You do not need to include your name or addresses\.$"),
)
REQ2_FRAGS = (
    re.compile(r"^You should write at least 250 words"),
    re.compile(r"^Write at least 250 words\.$"),
    re.compile(r"^Give reasons for your answer"),
    re.compile(r"^any relevant examples from your own knowledge or experience\.$"),
)

ANOMALIES: Counter = Counter()
ANOMALY_EXAMPLES: dict[str, str] = {}


def log_anomaly(kind: str, num: int, detail: str) -> None:
    ANOMALIES[kind] += 1
    ANOMALY_EXAMPLES.setdefault(kind, f"Đề {num:04d}: {detail}")


def para_texts(docx_path: Path) -> list[str]:
    xml = zipfile.ZipFile(docx_path).read("word/document.xml").decode("utf-8")
    out: list[str] = []
    for para in PARA_RE.findall(xml):
        parts: list[str] = []
        for m in RUN_RE.finditer(para):
            parts.append(m.group(1) if m.group(1) is not None else " ")
        # <w:t> content is XML-escaped: "&amp;" in the XML is a literal "&".
        out.append(html.unescape("".join(parts)).strip())
    return out


def parse_level(line: str, num: int, expect_min: int, expect_time: int) -> str:
    m = LEVEL_RE.match(line)
    if not m:
        raise ValueError(f"Đề {num:04d}: bad Trình độ line: {line[:100]!r}")
    level, min_words, minutes = m.group(1), int(m.group(2)), int(m.group(3))
    if level not in ("B1", "B2", "C1"):
        raise ValueError(f"Đề {num:04d}: unknown level {level!r}")
    if min_words != expect_min or minutes != expect_time:
        raise ValueError(
            f"Đề {num:04d}: Trình độ min/time {min_words}/{minutes}, "
            f"expected {expect_min}/{expect_time}")
    return level


def peel_requirement(rest: list[str], frags, num: int, std: str, min_word: str) -> str:
    parts: list[str] = []
    while rest and any(rx.match(rest[-1]) for rx in frags):
        parts.insert(0, rest.pop())
    req = " ".join(parts)
    if not parts:
        log_anomaly("requirement-missing", num, "no requirement line; used standard")
        return std
    if min_word not in req:
        log_anomaly("requirement-no-minwords", num, f"requirement={req[:80]!r}")
        req = f"You should write at least {min_word} words. " + req
    if len(parts) > 1:
        log_anomaly("requirement-split", num, f"{len(parts)} fragments joined")
    return req


def finalize_task1(block: list[str], type_: str, num: int) -> dict:
    if len(block) < 4:
        raise ValueError(f"Đề {num:04d} Task 1: block too short ({len(block)} lines)")
    level = parse_level(block[0], num, 120, 20)
    vi = block[1]
    if not vi:
        raise ValueError(f"Đề {num:04d} Task 1: empty Vietnamese summary")
    intro = block[2]
    if intro in INTRO1:
        rest = block[3:]
    else:
        # ~30 tests omit the intro line (body starts at block[2]); restore
        # the bank's own standard boilerplate so every prompt has the same
        # shape: [intro, situation, (Write-line)?, bullets...].
        log_anomaly("intro-missing", num, f"block[2]={intro[:70]!r}")
        intro = STD_INTRO_20
        rest = block[2:]
    requirement = peel_requirement(rest, REQ1_FRAGS, num, STD_REQ_120, "120")
    # ~15 tests split the requirement around the bullets:
    # "Write at least 120 words." before the bullets, the rest after them.
    # The trailing part is peeled above; drop the stray mid-block fragment
    # from the prompt (the requirement was already reconstructed).
    if "Write at least 120 words." in rest:
        log_anomaly("requirement-midline", num, "dropped mid-block fragment")
        rest = [l for l in rest if l != "Write at least 120 words."]
    wi = next((i for i, l in enumerate(rest) if WRITE_RE.match(l)), -1)
    if wi >= 0:
        situation = rest[:wi]
        bullets = rest[wi + 1:]
    else:
        log_anomaly("task1-no-write-line", num, f"middle={rest[:2]}")
        situation = rest[:1]
        bullets = rest[1:]
    if len(situation) != 1:
        log_anomaly("task1-situation-lines", num, f"{len(situation)} situation lines")
    if len(bullets) != 3:
        log_anomaly("task1-bullet-count", num, f"{len(bullets)} bullets")
    for l in rest:
        if l.startswith("Write ") and not WRITE_RE.match(l):
            log_anomaly("task1-write-variant", num, l[:80])
    return {
        "type": type_, "level": level, "vi": vi,
        "prompt": [intro] + rest,
        "requirement": requirement,
    }


def finalize_task2(block: list[str], type_: str, num: int) -> dict:
    if len(block) < 4:
        raise ValueError(f"Đề {num:04d} Task 2: block too short ({len(block)} lines)")
    level = parse_level(block[0], num, 250, 40)
    vi = block[1]
    if not vi:
        raise ValueError(f"Đề {num:04d} Task 2: empty Vietnamese summary")
    intro = block[2]
    if intro in INTRO2:
        rest = block[3:]
    else:
        log_anomaly("intro-missing", num, f"block[2]={intro[:70]!r}")
        intro = STD_INTRO_40
        rest = block[2:]
    requirement = peel_requirement(rest, REQ2_FRAGS, num, STD_REQ_250, "250")
    # Same split-requirement shape as Task 1, if it ever appears here.
    if "Write at least 250 words." in rest:
        log_anomaly("requirement-midline", num, "dropped mid-block fragment")
        rest = [l for l in rest if l != "Write at least 250 words."]
    if not rest:
        raise ValueError(f"Đề {num:04d} Task 2: nothing left after requirement peel")
    question = rest.pop()
    if len(question) >= 2 and question.startswith('"') and question.endswith('"'):
        log_anomaly("task2-quoted-question", num, question[:80])
        question = question[1:-1]
    if not question:
        raise ValueError(f"Đề {num:04d} Task 2: empty question")
    if not rest:
        log_anomaly("task2-no-body", num, "no background paragraphs")
    return {
        "type": type_, "level": level, "vi": vi,
        "prompt": [intro] + rest + [question],
        "requirement": requirement,
    }


def parse_docx(docx_path: Path) -> list[dict]:
    tests: list[dict] = []
    test: dict | None = None
    task: int | None = None
    block: list[str] = []
    type1 = type2 = ""

    def fail(msg: str) -> None:
        raise ValueError(f"{docx_path.name}: {msg} (test={test['num'] if test else '?'})")

    def finish_test() -> None:
        nonlocal test, task, block
        if test is None:
            return
        if task != 2:
            fail("test ended without Task 2")
        test["part2"] = finalize_task2(block, type2, test["num"])
        tests.append(test)
        test = None
        task = None
        block = []

    for raw in para_texts(docx_path):
        if not raw:
            continue
        m = TEST_RE.match(raw)
        if m:
            finish_test()
            num = int(m.group(1))
            if any(t["num"] == num for t in tests):
                fail(f"duplicate test number {num}")
            test = {"id": f"de-{num:04d}", "num": num, "title": f"Đề {num:04d}",
                    "timeMin": 60, "part1": None, "part2": None}
            continue
        m = TASK1_RE.match(raw)
        if m:
            if test is None or task is not None:
                fail(f"TASK 1 header out of place (task={task})")
            type1 = m.group(1).strip()
            if not type1:
                fail("empty Task 1 type")
            task = 1
            block = []
            continue
        m = TASK2_RE.match(raw)
        if m:
            if test is None or task != 1:
                fail(f"TASK 2 header out of place (task={task})")
            type2 = m.group(1).strip()
            if not type2:
                fail("empty Task 2 type")
            test["part1"] = finalize_task1(block, type1, test["num"])
            task = 2
            block = []
            continue
        if task is None:
            if test is None:
                continue  # file preamble (bank title) before the first ĐỀ
            fail(f"unexpected paragraph between tests: {raw[:100]!r}")
        block.append(raw)
    finish_test()
    return tests


def validate_all(tests: list[dict]) -> None:
    nums = sorted(t["num"] for t in tests)
    if nums != list(range(1, 5001)):
        missing = [n for n in range(1, 5001) if n not in nums]
        dupes = [n for n, c in Counter(t["num"] for t in tests).items() if c > 1]
        raise ValueError(f"test numbers are not exactly 1..5000 "
                         f"(missing={missing[:10]}, dupes={dupes[:10]})")
    t1types: Counter = Counter()
    t2types: Counter = Counter()
    levels: Counter = Counter()
    for t in tests:
        for key in ("part1", "part2"):
            p = t[key]
            if not p or not p["type"] or not p["prompt"] or not p["requirement"]:
                raise ValueError(f"test {t['num']}: empty {key} field")
            if not p["vi"] or p["level"] not in ("B1", "B2", "C1"):
                raise ValueError(f"test {t['num']}: bad {key} vi/level")
            levels[f"{key}:{p['level']}"] += 1
        t1types[t["part1"]["type"].split(" — ")[0]] += 1
        t2types[t["part2"]["type"].split(" — ")[0]] += 1
    print("Task 1 types:", dict(t1types))
    print("Task 2 types:", dict(t2types))
    print("Levels:", dict(sorted(levels.items())))


def write_data_files(tests: list[dict]) -> list[int]:
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
            f"// Writing tests {first:04d} → {last:04d}.\n"
            f"import type {{ WritingTest }} from '../writing-tests';\n\n"
            f"export const DATA_{chunk:03d}: WritingTest[] = [\n"
            + ",\n".join(buf)
            + "\n];\n"
        )
        (DATA_DIR / f"{name}.ts").write_text(content, encoding="utf-8")
        buf, buf_size = [], 0

    for t in tests:
        line = json.dumps(t, ensure_ascii=False, separators=(",", ":"))
        if buf and buf_size + len(line.encode()) + 2 > MAX_CHUNK_BYTES:
            flush()
        buf.append(line)
        buf_size += len(line.encode()) + 2
        chunk_of.append(chunk + 1)
    flush()
    return chunk_of


def write_index_ts(chunk_of: list[int]) -> None:
    manifest = ", ".join(str(c) for c in chunk_of)
    content = f"""// ---------------------------------------------------------------------------
// Writing test bank: 5000 tests (Đề 0001–5000), GENERATED from the five
// VSTEP-Writing-De-*.docx files by scripts/parse-writing-docx.py — do NOT
// hand-edit. Re-run the parser after changing the source docx files.
//
// The bank is too large to bundle into one page chunk, so tests live in
// chunked files (lib/writing-tests/data-*.ts) and are loaded on demand via
// loadWritingTest(). The list page uses WRITING_TITLE_LIST in
// lib/writing-titles.ts and never imports this bank.
// ---------------------------------------------------------------------------

export interface WritingTestPart {{
  type: string;
  /** CEFR level from the docx "Trình độ" line (B1 / B2 / C1). */
  level?: string;
  /** Vietnamese summary of the task from the docx. */
  vi?: string;
  prompt: string[];
  requirement: string;
}}

export interface WritingTest {{
  id: string;
  num: number;
  title: string;
  timeMin: number;
  part1: WritingTestPart;
  part2: WritingTestPart;
}}

export const WRITING_TEST_COUNT = 5000;

/** WRITING_CHUNK_OF[num - 1] = chunk file holding test `num`. */
export const WRITING_CHUNK_OF: number[] = [{manifest}];

/**
 * Load one test by id (e.g. "de-0001"). Returns null when the id is unknown.
 * Uses a dynamic import so only the requested test's chunk (~88 KB) is
 * fetched — the full 5000-test bank is never bundled into a page.
 */
export async function loadWritingTest(id: string): Promise<WritingTest | null> {{
  const m = /^de-(\\d+)$/.exec(id);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (num < 1 || num > WRITING_TEST_COUNT) return null;
  const chunk = WRITING_CHUNK_OF[num - 1];
  const pad = String(chunk).padStart(3, "0");
  const mod = (await import(`./writing-tests/data-${{pad}}`)) as Record<
    string,
    WritingTest[]
  >;
  const tests = mod[`DATA_${{pad}}`] ?? [];
  return tests.find((t) => t.num === num) ?? null;
}}
"""
    INDEX_TS.write_text(content, encoding="utf-8")
    print(f"wrote {INDEX_TS.relative_to(ROOT)} ({len(content.encode())} bytes)")


def write_title_list(tests: list[dict]) -> None:
    """Write WRITING_TITLE_LIST as chunked files (<= ~88 KB each).

    The 5000-entry list (~225 KB) cannot live in lib/test-titles.ts: that
    file would exceed the deploy uploader's 125000 base64 limit. Instead the
    list lives in lib/writing-titles/ and lib/test-titles.ts imports it only
    to build the WRITING_TITLES map.
    """
    TITLES_DIR.mkdir(exist_ok=True)
    for old in TITLES_DIR.glob("data-*.ts"):
        old.unlink()
    chunks: list[list[str]] = []
    buf: list[str] = []
    buf_size = 0
    for t in tests:
        line = (f'  {{ id: "de-{t["num"]:04d}", num: {t["num"]}, '
                f'title: "Đề {t["num"]:04d}" }},')
        if buf and buf_size + len(line.encode()) + 1 > MAX_CHUNK_BYTES:
            chunks.append(buf)
            buf, buf_size = [], 0
        buf.append(line)
        buf_size += len(line.encode()) + 1
    if buf:
        chunks.append(buf)
    names: list[str] = []
    for i, chunk in enumerate(chunks, 1):
        name = f"WRITING_TITLES_{i:03d}"
        names.append(name)
        first = int(chunk[0].split("num:")[1].split(",")[0])
        last = int(chunk[-1].split("num:")[1].split(",")[0])
        content = (
            f"// Writing titles {first:04d} → {last:04d}.\n"
            f"import type {{ TestTitleEntry }} from '../test-titles';\n\n"
            f"export const {name}: TestTitleEntry[] = [\n"
            + "\n".join(chunk)
            + "\n];\n"
        )
        (TITLES_DIR / f"data-{i:03d}.ts").write_text(content, encoding="utf-8")
    index = (
        "// ---------------------------------------------------------------------------\n"
        "// Writing title list (5000 entries), GENERATED from the five\n"
        "// VSTEP-Writing-De-*.docx files by scripts/parse-writing-docx.py — do NOT\n"
        "// hand-edit. Chunked so every file stays under the deploy uploader's\n"
        "// 125000 base64 limit. lib/test-titles.ts imports this list to build\n"
        "// the WRITING_TITLES id→title map.\n"
        "// ---------------------------------------------------------------------------\n\n"
        "import type { TestTitleEntry } from './test-titles';\n"
        + "".join(
            f"import {{ {n} }} from './writing-titles/data-{i:03d}';\n"
            for i, n in enumerate(names, 1)
        )
        + "\n"
        + "export const WRITING_TITLE_LIST: TestTitleEntry[] = [\n"
        + ",\n".join(f"  ...{n}" for n in names)
        + "\n];\n"
    )
    TITLES_INDEX_TS.write_text(index, encoding="utf-8")
    print(f"wrote WRITING_TITLE_LIST ({len(tests)} entries, {len(chunks)} chunks) "
          f"into {TITLES_INDEX_TS.relative_to(ROOT)}")


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
    print("Anomaly summary (handled + normalized):")
    for kind, count in ANOMALIES.most_common():
        print(f"  {kind}: {count}  e.g. {ANOMALY_EXAMPLES[kind][:110]}")
    if not ANOMALIES:
        print("  (none)")
    print("Writing data files...")
    chunk_of = write_data_files(all_tests)
    print(f"{len(set(chunk_of))} chunk files, max chunk = {max(chunk_of)}")
    write_index_ts(chunk_of)
    write_title_list(all_tests)
    print(f"OK: {len(all_tests)} tests")
    return 0


if __name__ == "__main__":
    sys.exit(main())
