// ---------------------------------------------------------------------------
// VSTEP Speaking practice prompts — original VSTEP-style content written for
// this app. Real test timing: 12 minutes total (2 minutes of preparation:
// 1 minute in Part 2 and 1 minute in Part 3).
//
//   Part 1 · Social Interaction  — 3 minutes, no prep. Examiner asks 2 topics
//                                  x 3 questions about familiar subjects.
//   Part 2 · Solution Discussion — 1 min prep + 3 min talk. Situation with
//                                  3 options; pick the best and justify it.
//   Part 3 · Topic Development   — 1 min prep + 4 min talk. Topic + mind-map;
//                                  develop it, then answer follow-up questions.
// ---------------------------------------------------------------------------

export interface Part1TopicSet {
  id: string;
  label: string;
  topics: { title: string; questions: string[] }[];
}

export const PART1_SETS: Part1TopicSet[] = [
  {
    id: 'p1-a',
    label: 'Bộ A · Gia đình & Thời gian rảnh',
    topics: [
      {
        title: 'Family',
        questions: [
          'Do you have a large or a small family?',
          'Who are you closest to in your family?',
          'What do you usually do together at weekends?',
        ],
      },
      {
        title: 'Free time',
        questions: [
          'What do you like doing in your free time?',
          'Do you prefer spending your free time alone or with other people?',
          'How has the way you spend your free time changed over the years?',
        ],
      },
    ],
  },
  {
    id: 'p1-b',
    label: 'Bộ B · Học tập / Công việc & Quê hương',
    topics: [
      {
        title: 'Study / Work',
        questions: [
          'What do you study? / What is your job?',
          'What do you like most about your studies / your work?',
          'What are your plans for the future?',
        ],
      },
      {
        title: 'Hometown',
        questions: [
          'Where is your hometown?',
          'What is it famous for?',
          'Would you like to live there in the future? Why (not)?',
        ],
      },
    ],
  },
  {
    id: 'p1-c',
    label: 'Bộ C · Du lịch & Ẩm thực',
    topics: [
      {
        title: 'Travel',
        questions: [
          'Do you like travelling?',
          'Where did you go on your last trip?',
          'Which place would you like to visit the most?',
        ],
      },
      {
        title: 'Food',
        questions: [
          'What is your favourite food?',
          'Do you prefer cooking at home or eating out?',
          'Has your eating habit changed recently?',
        ],
      },
    ],
  },
];

export interface Part2Situation {
  id: string;
  situation: string;
  options: string[];
}

export const PART2_SITUATIONS: Part2Situation[] = [
  {
    id: 'p2-a',
    situation:
      'Your English club is going to organize a weekend activity. There are three suggestions: a picnic in the park, a charity visit to a nursing home, and a movie night at a member’s house. Which one do you think is the best choice?',
    options: [
      'A picnic in the park',
      'A charity visit to a nursing home',
      'A movie night at a member’s house',
    ],
  },
  {
    id: 'p2-b',
    situation:
      'You have some free time this summer and want to improve your English. There are three options: joining an English speaking club, watching English movies every day, and taking an online English course. Which one would you choose?',
    options: [
      'Joining an English speaking club',
      'Watching English movies every day',
      'Taking an online English course',
    ],
  },
  {
    id: 'p2-c',
    situation:
      'Your office wants to reduce paper waste. Three ideas are suggested: using both sides of paper, sending documents by email instead of printing, and placing recycling bins in every room. Which idea do you think is the most effective?',
    options: [
      'Using both sides of paper',
      'Sending documents by email instead of printing',
      'Placing recycling bins in every room',
    ],
  },
];

export interface Part3Topic {
  id: string;
  topic: string;
  /** Mind-map points (the last one is conventionally "(Your own idea)") */
  points: string[];
  followUps: string[];
}

export const PART3_TOPICS: Part3Topic[] = [
  {
    id: 'p3-a',
    topic: 'Doing regular exercise is very important.',
    points: ['Health improvement', 'Stress reduction', '(Your own idea)', 'Making new friends'],
    followUps: [
      'Do you think people exercise enough nowadays?',
      'What stops people from exercising regularly?',
      'How can schools encourage students to do more sports?',
    ],
  },
  {
    id: 'p3-b',
    topic: 'Learning English brings many benefits.',
    points: ['Better job opportunities', 'Access to knowledge', '(Your own idea)', 'Travelling easily'],
    followUps: [
      'Is English the most important foreign language to learn?',
      'What difficulties do Vietnamese learners face when learning English?',
      'How has technology changed the way people learn English?',
    ],
  },
  {
    id: 'p3-c',
    topic: 'Protecting the environment is everyone’s responsibility.',
    points: ['Reducing plastic use', 'Saving energy', '(Your own idea)', 'Planting trees'],
    followUps: [
      'Who should take the main responsibility for environmental protection?',
      'What are the biggest environmental problems in Vietnam?',
      'Do you think young people care enough about the environment?',
    ],
  },
];

/** Official VSTEP speaking criteria (0–10 each). Overall = mean, rounded to 0.5. */
export const SPEAKING_CRITERIA = [
  { key: 'grammar', label: 'Grammar', vi: 'Ngữ pháp: độ đa dạng và chính xác của cấu trúc câu' },
  { key: 'vocabulary', label: 'Vocabulary', vi: 'Từ vựng: vốn từ và cách dùng từ' },
  { key: 'pronunciation', label: 'Pronunciation', vi: 'Phát âm (AI chỉ đánh giá tương đối)' },
  { key: 'fluency', label: 'Fluency', vi: 'Độ trôi chảy và mạch lạc' },
  { key: 'discourse_management', label: 'Discourse management', vi: 'Tổ chức & triển khai ý' },
] as const;

export type SpeakingCriterionKey = (typeof SPEAKING_CRITERIA)[number]['key'];

/** Timings in seconds, matching the real test. */
export const SPEAKING_TIMING = {
  part1: { total: 180, prep: 0, talk: 180, label: '3 phút' },
  part2: { total: 240, prep: 60, talk: 180, label: '1 phút chuẩn bị + 3 phút nói' },
  part3: { total: 300, prep: 60, talk: 240, label: '1 phút chuẩn bị + 4 phút nói' },
} as const;
