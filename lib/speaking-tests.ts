// ---------------------------------------------------------------------------
// 300 VSTEP Speaking tests (Đề 302 → Đề 3), parsed from the user-uploaded docx.
// VSTEP format: Part 1 = Social Interaction (6 questions), Part 2 = Solution
// Discussion (situation + 3 options), Part 3 = Topic Development (topic +
// mind-map points + follow-up questions). 12 minutes total.
// ---------------------------------------------------------------------------

export interface SpeakingTest {
  id: string; // 'sp-302'
  num: number; // 302
  title: string; // 'Đề 302'
  part1: string[]; // 6 questions
  part2: { situation: string; options: string[] }; // 3 options
  part3: { topic: string; points: string[]; followUps: string[] };
}

import { DATA_01 } from './speaking-tests/data-01';
import { DATA_02 } from './speaking-tests/data-02';
import { DATA_03 } from './speaking-tests/data-03';
import { DATA_04 } from './speaking-tests/data-04';
import { DATA_05 } from './speaking-tests/data-05';

export const SPEAKING_TESTS: SpeakingTest[] = [
  ...DATA_01,
  ...DATA_02,
  ...DATA_03,
  ...DATA_04,
  ...DATA_05,
];
