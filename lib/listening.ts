// ---------------------------------------------------------------------------
// Listening practice tests.
//
// ACTUAL DATA SHAPE (56 real tests + 1 demo):
//   Each test has exactly 3 recordings — one per part — streamed from the CDN
//   links in the data files (https://cdn.thanhnamnguyen.dev/vstep/audio/...):
//     Part 1: 1 recording holding ALL 8 short announcements (Q1-8)
//     Part 2: 1 recording holding the conversations (Q9-20)
//     Part 3: 1 recording holding the talks (Q21-35)
//   Audio file names follow the CDN's convention (e.g. part1-2.mp3 is
//   Part 2's audio, part1-3.mp3 is Part 3's audio) — do NOT "fix" them.
//   Part 3 transcripts end with a "Nguồn: <url>" attribution line, which the
//   player strips at render time.
//
// HOW TO ADD A REAL TEST (35 questions):
//   1. Host 3 MP3 files on the CDN (one per part) and note their URLs.
//   2. Add a ListeningTest object to the data chunks (copy the shape of an
//      existing test; questions are numbered 1..N automatically in order).
//   3. Redeploy the app.
//
// A commented template is included at the bottom of this file.
// ---------------------------------------------------------------------------

export interface ListeningQuestion {
  q: string;
  options: string[]; // 4 options, A/B/C/D
  answer: number; // index of the correct option (0-3)
}

export interface ListeningRecording {
  id: string;
  label: string; // Vietnamese label shown in the UI, e.g. "Thông báo tại sân bay"
  audio: string; // public path, e.g. "/audio/listening-01/p1-01.mp3"
  script: string; // transcript shown in review mode
  questions: ListeningQuestion[];
}

export interface ListeningPart {
  n: number; // 1 | 2 | 3
  title: string;
  hint: string;
  recordings: ListeningRecording[];
}

export interface ListeningTest {
  id: string;
  title: string;
  subtitle: string;
  durationMin: number; // countdown minutes (40 for a real test)
  demo?: boolean; // true => clearly labeled as a demo/familiarization test
  parts: ListeningPart[];
}

// HINTS lives in ./listening-hints (separate module to avoid a circular import:
// the data chunks need these values while this module is still initializing).
import { HINTS } from './listening-hints';
export { HINTS };

const DEMO_TESTS: ListeningTest[] = [
  {
    id: 'demo',
    title: 'Đề demo',
    subtitle: 'Bản làm quen giao diện — 3 đoạn nghe ngắn, 4 câu hỏi',
    durationMin: 5,
    demo: true,
    parts: [
      {
        n: 1,
        title: 'Part 1',
        hint: HINTS[1],
        recordings: [
          {
            id: 'demo-01',
            label: 'Thông báo tại cửa hàng',
            audio: '/audio/demo/demo-01.mp3',
            script:
              'Attention, shoppers. Our store will close in ten minutes, at nine P M. ' +
              'Please bring your items to the checkout. Thank you for shopping with us today.',
            questions: [
              {
                q: 'When will the store close?',
                options: ['At eight P M', 'At nine P M', 'At ten P M', 'At eleven P M'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        n: 2,
        title: 'Part 2',
        hint: HINTS[2],
        recordings: [
          {
            id: 'demo-02',
            label: 'Hai bạn hẹn gặp nhau',
            audio: '/audio/demo/demo-02.mp3',
            script:
              'Anna: Hi, Peter. Are we still meeting for lunch tomorrow?\n' +
              'Peter: Yes, at twelve thirty, at the noodle shop near the park.\n' +
              'Anna: Perfect. Should I bring the report for our project?\n' +
              'Peter: Yes, please. I want to check the final numbers before Friday.',
            questions: [
              {
                q: 'Where will they meet for lunch?',
                options: [
                  'At the park',
                  'At a noodle shop near the park',
                  'At the office',
                  "At Anna's house",
                ],
                answer: 1,
              },
              {
                q: 'What will Anna bring?',
                options: [
                  'A birthday gift',
                  'The report for their project',
                  'Lunch money',
                  'A map',
                ],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        n: 3,
        title: 'Part 3',
        hint: HINTS[3],
        recordings: [
          {
            id: 'demo-03',
            label: 'Bài nói: Uống đủ nước',
            audio: '/audio/demo/demo-03.mp3',
            script:
              'Water is essential for our bodies. Experts recommend drinking about eight ' +
              'glasses of water each day. When you do not drink enough, you may feel tired ' +
              'and have difficulty concentrating. A simple habit is to keep a water bottle ' +
              'on your desk and take a sip every thirty minutes.',
            questions: [
              {
                q: 'What may happen if you do not drink enough water?',
                options: [
                  'You may feel tired and have difficulty concentrating',
                  'You will sleep better',
                  'You will feel hungry all the time',
                  'Nothing will happen',
                ],
                answer: 0,
              },
            ],
          },
        ],
      },
    ],
  },
];

export function getListeningTest(id: string): ListeningTest | undefined {
  return LISTENING_TESTS.find((t) => t.id === id);
}

// 56 real tests (Đề 01 → Đề 56), parsed from the user-uploaded docx.
// Audio is streamed from the CDN links provided in the source file.
import { DATA_01 as L01 } from './listening-tests/data-01';
import { DATA_02 as L02 } from './listening-tests/data-02';
import { DATA_03 as L03 } from './listening-tests/data-03';
import { DATA_04 as L04 } from './listening-tests/data-04';
import { DATA_05 as L05 } from './listening-tests/data-05';
import { DATA_06 as L06 } from './listening-tests/data-06';
import { DATA_07 as L07 } from './listening-tests/data-07';
import { DATA_08 as L08 } from './listening-tests/data-08';
import { DATA_09 as L09 } from './listening-tests/data-09';
import { DATA_10 as L10 } from './listening-tests/data-10';
import { DATA_11 as L11 } from './listening-tests/data-11';
import { DATA_12 as L12 } from './listening-tests/data-12';
import { DATA_13 as L13 } from './listening-tests/data-13';
import { DATA_14 as L14 } from './listening-tests/data-14';
import { DATA_15 as L15 } from './listening-tests/data-15';
import { DATA_16 as L16 } from './listening-tests/data-16';
import { DATA_17 as L17 } from './listening-tests/data-17';
import { DATA_18 as L18 } from './listening-tests/data-18';
import { DATA_19 as L19 } from './listening-tests/data-19';

export const LISTENING_TESTS: ListeningTest[] = [
  ...DEMO_TESTS,
  ...L01, ...L02, ...L03, ...L04, ...L05, ...L06, ...L07, ...L08, ...L09,
  ...L10, ...L11, ...L12, ...L13, ...L14, ...L15, ...L16, ...L17, ...L18, ...L19,
];

/** Flattened questions with global numbers 1..N in test order. */
export interface FlatQuestion extends ListeningQuestion {
  num: number;
  part: number;
  recId: string;
  recLabel: string;
}

export function flattenQuestions(test: ListeningTest): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  let num = 0;
  for (const part of test.parts) {
    for (const rec of part.recordings) {
      for (const q of rec.questions) {
        num += 1;
        out.push({ ...q, num, part: part.n, recId: rec.id, recLabel: rec.label });
      }
    }
  }
  return out;
}

/** Per-part correct/total breakdown for a submitted answer map. */
export function scoreParts(
  test: ListeningTest,
  answers: Record<number, number>
): { part: number; correct: number; total: number }[] {
  return test.parts.map((part) => {
    const qs = flattenQuestions(test).filter((q) => q.part === part.n);
    const correct = qs.filter((q) => answers[q.num] === q.answer).length;
    return { part: part.n, correct, total: qs.length };
  });
}

// ---------------------------------------------------------------------------
// TEMPLATE — copy, fill in, and push into the data chunks to add a full test.
// (See "HOW TO ADD A REAL TEST" at the top of this file.)
// One recording per part; each recording's script holds ALL of that part's
// audio concatenated (Part 1: 8 announcements, Part 2: conversations,
// Part 3: talks).
//
// {
//   id: 'listening-57',
//   title: 'Đề 57',
//   subtitle: '35 câu · 40 phút',
//   durationMin: 40,
//   parts: [
//     {
//       n: 1, title: 'Part 1', hint: HINTS[1],
//       recordings: [
//         {
//           id: 'listening-57-p1',
//           label: 'Bài nghe Part 1',
//           audio: 'https://<cdn>/listening-57/part1-1.mp3',
//           script: 'All 8 announcements concatenated, numbered 1-8…',
//           questions: [
//             { q: 'Question text?', options: ['A', 'B', 'C', 'D'], answer: 0 },
//             // …8 questions (Q1-8), one per announcement
//           ],
//         },
//       ],
//     },
//     {
//       n: 2, title: 'Part 2', hint: HINTS[2],
//       recordings: [
//         {
//           id: 'listening-57-p2',
//           label: 'Bài nghe Part 2',
//           audio: 'https://<cdn>/listening-57/part1-2.mp3',
//           script: 'All conversations concatenated…',
//           questions: [
//             // …12 questions (Q9-20)
//           ],
//         },
//       ],
//     },
//     {
//       n: 3, title: 'Part 3', hint: HINTS[3],
//       recordings: [
//         {
//           id: 'listening-57-p3',
//           label: 'Bài nghe Part 3',
//           audio: 'https://<cdn>/listening-57/part1-3.mp3',
//           script: 'All talks concatenated… (a trailing "Nguồn: <url>" line is stripped at render time)',
//           questions: [
//             // …15 questions (Q21-35)
//           ],
//         },
//       ],
//     },
//   ],
// },
// ---------------------------------------------------------------------------
