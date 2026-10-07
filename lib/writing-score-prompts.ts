// Scoring prompts for Writing Task 1 & Task 2.
// Base prompt provided by the user (file: Promp_ch_m__i_m.docx). Placeholders
// are filled with the ACTUAL test being taken (test title, task text,
// instructions) and the candidate's writing at request time. The model must
// answer with JSON ONLY so the app can render a per-criterion breakdown.

export interface ScorePromptInput {
  /** e.g. "Đề 300". */
  testTitle: string;
  /** The test's prompt lines (task description + email/notes excerpt). */
  taskText: string;
  /** The "Yêu cầu" requirement line of the test. */
  instructions: string;
  /** The candidate's writing. */
  essay: string;
}

export interface CriterionScore {
  key: string;
  name_vi: string;
  score: number;
  comment: string;
  mistakes: string[];
}

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
}

export interface WritingScore {
  is_off_topic: boolean;
  overall_score: number;
  current_level: string;
  level_feedback: string;
  criteria: CriterionScore[];
  strengths: string[];
  improvements: string[];
  corrections: Correction[];
  revised_version: string;
}

const ROLE = `You are an expert English language teacher specializing in B1, B2, and C1 level proficiency exams for Vietnamese learners. You have extensive experience teaching English writing skills, with deep expertise in:
- Writing exam preparation and evaluation
- Email, letter, and essay writing assessment
- Providing detailed feedback on grammar, vocabulary, and coherence
- Helping Vietnamese learners improve their writing skills
- Understanding common mistakes Vietnamese writers make
- Teaching proper writing structure and organization

I need you to evaluate and provide feedback on my English writing assignment for the B1, B2, and C1 level exam.`;

const GRADING_RULES = `**IMPORTANT: Please provide all feedback and evaluation in Vietnamese language. Grade strictly, not leniently, based on B1, B2, and C1 level standards.**

**OFF-TOPIC RULE (check this FIRST): List EACH question/requirement from the Task above and mark answered / not answered. Set "is_off_topic" to true ONLY when the writing answers NONE of them — completely off-topic / lạc đề (wrong recipient, wrong topic, or wrong task type). The scoring system will automatically force overall_score to 0 when is_off_topic is true, so still fill in criteria, mistakes and corrections normally for learning feedback. When at least one question is addressed, set is_off_topic to false and score normally (penalize Task Achievement heavily for partial off-topic).**

**CRITICAL: Your evaluation MUST be specific to THIS task and THIS writing. Go through EACH question/requirement in the Task above one by one and state which were answered, missed, or only partially answered. QUOTE the candidate's exact sentences/words when commenting on vocabulary, grammar, and mistakes. Never write generic comments that could apply to any essay — every remark must reference the actual writing and the specific task above.**`;

const JSON_OUTPUT = `**Respond with JSON ONLY** in exactly this shape (every text value in Vietnamese):
{
  "is_off_topic": <true ONLY if the writing answers NONE of the task's questions (wrong recipient/topic/task type), otherwise false>,
  "overall_score": <number 0-10, decimals like 7.5 allowed>,
  "current_level": "<estimated CEFR level, e.g. B2>",
  "level_feedback": "<what is the candidate's current level, and what is needed to reach a higher level?>",
  "criteria": [
    { "key": "task_achievement", "name_vi": "Hoàn thành yêu cầu đề bài", "score": <0-10>, "comment": "<which exact questions were answered/missed, with quotes>", "mistakes": ["<quote exact phrase> — <why it fails the requirement>"] },
    { "key": "coherence_cohesion", "name_vi": "Mạch lạc và liên kết", "score": <0-10>, "comment": "<comment on THIS essay's organization, quoting examples>", "mistakes": ["<quote exact phrase> — <what is wrong>"] },
    { "key": "vocabulary", "name_vi": "Từ vựng", "score": <0-10>, "comment": "<comment on word choices IN THIS WRITING, quoting strong/weak examples>", "mistakes": ["<quote exact word/phrase> — <better alternative>"] },
    { "key": "grammar", "name_vi": "Ngữ pháp", "score": <0-10>, "comment": "<overview of grammar in THIS writing>", "mistakes": ["<quote exact wrong sentence> — <grammar rule violated>"] },
    { "key": "word_count", "name_vi": "Số từ", "score": <0-10>, "comment": "<exact word count of My Writing and whether it meets the minimum>", "mistakes": [] }
  ],
  "strengths": ["<specific strength with a quote from the writing>", "<...>"],
  "improvements": ["<specific area to improve, referencing the writing>", "<...>"],
  "corrections": [
    { "original": "<the candidate's exact wrong sentence>", "corrected": "<corrected sentence>", "explanation": "<short explanation>" }
  ],
  "revised_version": "<rewritten version that properly addresses THIS task above — reuse the task's exact people, places and questions; NEVER invent a different topic, recipient or scenario. If the writing was off-topic, write a proper model response to the actual task instead; otherwise empty string>"
}`;

/** Split the task text into the title line and the original content (mirrors the reference prompt layout). */
export function splitTaskText(taskText: string): { title: string; content: string } {
  const lines = taskText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return { title: lines[0] ?? '', content: lines.slice(1).join('\n') };
}

const PROVIDE_LIST = `**Please provide (in Vietnamese):**
- Overall score/rating (Please grade strictly, not leniently, based on B1, B2, and C1 level standards)
- What is your current level, and what is needed to go to a higher level?
- Specific strengths
- Areas for improvement
- Suggestions and corrections
- Revised version (if needed)`;

export function buildTask1ScorePrompt({ testTitle, taskText, instructions, essay }: ScorePromptInput): string {
  const { title, content } = splitTaskText(taskText);
  return `${ROLE}

${GRADING_RULES}

**Test:** ${testTitle}
**Task Type:** Task 1 (Email and Letter Writing) - Minimum 120 words

**Task Title:**
${title}

**Original Content/Prompt:**
${content}

**Task Instructions:**
${instructions}

**My Writing:**
${essay}

**Please evaluate my writing based on:**
1. Task Achievement (Did I address all requirements?)
2. Coherence and Cohesion (Organization and flow of ideas)
3. Vocabulary (Range and accuracy)
4. Grammar (Range and accuracy)
5. Word count (At least 120 words)

${PROVIDE_LIST}

${JSON_OUTPUT}`;
}

export function buildTask2ScorePrompt({ testTitle, taskText, instructions, essay }: ScorePromptInput): string {
  const { title, content } = splitTaskText(taskText);
  return `${ROLE}

${GRADING_RULES}

**Test:** ${testTitle}
**Task Type:** Task 2 (Essay Writing) - Minimum 250 words

**Task Title:**
${title}

**Original Content/Prompt:**
${content}

**Task Instructions:**
${instructions}

**My Writing:**
${essay}

**Please evaluate my writing based on:**
1. Task Achievement (Did I address all requirements?)
2. Coherence and Cohesion (Organization and flow of ideas)
3. Vocabulary (Range and accuracy)
4. Grammar (Range and accuracy)
5. Word count (At least 250 words)

${PROVIDE_LIST}

${JSON_OUTPUT}`;
}

/** Gemini responseSchema for structured scoring output. */
export const WRITING_SCORE_SCHEMA = {
  type: 'object',
  properties: {
    is_off_topic: { type: 'boolean' },
    overall_score: { type: 'number' },
    current_level: { type: 'string' },
    level_feedback: { type: 'string' },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          name_vi: { type: 'string' },
          score: { type: 'number' },
          comment: { type: 'string' },
          mistakes: { type: 'array', items: { type: 'string' } },
        },
        required: ['key', 'name_vi', 'score', 'comment', 'mistakes'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          original: { type: 'string' },
          corrected: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['original', 'corrected', 'explanation'],
      },
    },
    revised_version: { type: 'string' },
  },
  required: [
    'is_off_topic',
    'overall_score',
    'current_level',
    'level_feedback',
    'criteria',
    'strengths',
    'improvements',
    'corrections',
    'revised_version',
  ],
} as const;

function clampScore(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(0, Math.round(n * 10) / 10));
}

/** Safely parse the model's JSON (handles markdown code fences). */
export function parseScoreJson(raw: string): { score: WritingScore | null; text: string } {
  const text = raw.trim();
  if (!text) return { score: null, text: '' };
  let jsonStr = text;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonStr = fence[1].trim();
  try {
    const o = JSON.parse(jsonStr);
    const criteria: CriterionScore[] = Array.isArray(o.criteria)
      ? o.criteria.slice(0, 5).map((c: Record<string, unknown>) => ({
          key: String(c.key || ''),
          name_vi: String(c.name_vi || c.key || ''),
          score: clampScore(c.score) ?? 0,
          comment: String(c.comment || ''),
          mistakes: Array.isArray(c.mistakes) ? c.mistakes.map(String) : [],
        }))
      : [];
    const score: WritingScore = {
      is_off_topic: o.is_off_topic === true,
      overall_score: clampScore(o.overall_score) ?? 0,
      current_level: String(o.current_level || ''),
      level_feedback: String(o.level_feedback || ''),
      criteria,
      strengths: Array.isArray(o.strengths) ? o.strengths.map(String) : [],
      improvements: Array.isArray(o.improvements) ? o.improvements.map(String) : [],
      corrections: Array.isArray(o.corrections)
        ? o.corrections.map((c: Record<string, unknown>) => ({
            original: String(c.original || ''),
            corrected: String(c.corrected || ''),
            explanation: String(c.explanation || ''),
          }))
        : [],
      revised_version: String(o.revised_version || ''),
    };
    return { score, text };
  } catch {
    return { score: null, text };
  }
}
