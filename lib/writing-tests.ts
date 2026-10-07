// 300 đề Writing (Đề 300 → Đề 1).
// Dữ liệu do người dùng cung cấp (file docx).

export interface WritingTestPart {
  type: string;
  prompt: string[];
  requirement: string;
}
export interface WritingTest {
  id: string;
  num: number;
  title: string;
  timeMin: number;
  part1: WritingTestPart;
  part2: WritingTestPart;
}

import { DATA_01 } from './writing-tests/data-01';
import { DATA_02 } from './writing-tests/data-02';
import { DATA_03 } from './writing-tests/data-03';
import { DATA_04 } from './writing-tests/data-04';
import { DATA_05 } from './writing-tests/data-05';
import { DATA_06 } from './writing-tests/data-06';
import { DATA_07 } from './writing-tests/data-07';
import { DATA_08 } from './writing-tests/data-08';

export const WRITING_TESTS: WritingTest[] = [
  ...DATA_01,
  ...DATA_02,
  ...DATA_03,
  ...DATA_04,
  ...DATA_05,
  ...DATA_06,
  ...DATA_07,
  ...DATA_08,
];
