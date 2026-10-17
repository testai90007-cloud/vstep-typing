// ---------------------------------------------------------------------------
// Writing title list (5000 entries), GENERATED from the five
// VSTEP-Writing-De-*.docx files by scripts/parse-writing-docx.py — do NOT
// hand-edit. Chunked so every file stays under the deploy uploader's
// 125000 base64 limit. lib/test-titles.ts imports this list to build
// the WRITING_TITLES id→title map.
// ---------------------------------------------------------------------------

import type { TestTitleEntry } from './test-titles';
import { WRITING_TITLES_001 } from './writing-titles/data-001';
import { WRITING_TITLES_002 } from './writing-titles/data-002';
import { WRITING_TITLES_003 } from './writing-titles/data-003';

export const WRITING_TITLE_LIST: TestTitleEntry[] = [
  ...WRITING_TITLES_001,
  ...WRITING_TITLES_002,
  ...WRITING_TITLES_003
];
