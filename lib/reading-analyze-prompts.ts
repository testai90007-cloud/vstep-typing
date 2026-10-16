// Prompt + response parsing for Reading AI analysis ("Phân tích với AI").
//
// Flow: after a mock Reading test is submitted, the user can ask AI to
// explain a question. The API returns structured JSON: why the correct
// answer is correct, why the user's pick was wrong (when applicable),
// a short tip, and 1–3 VERBATIM evidence quotes from the passage. The
// client highlights those quotes in the passage when the user clicks
// the question.

export interface ReadingAnalysis {
  /** Why the correct answer is correct (2–4 sentences, Vietnamese). */
  whyCorrect: string;
  /** Why the user's pick was wrong, or null when the user was right / blank. */
  whyUserWrong: string | null;
  /** One short tip for similar questions. */
  tip: string;
  /** Verbatim quotes from the passage proving the correct answer (1–3). */
  evidence: string[];
}

const LETTERS = ['A', 'B', 'C', 'D'];

export function buildReadingAnalyzePrompt(args: {
  passage: string;
  question: string;
  options: string[];
  /** 0–3, or null when the user left the question blank. */
  userAnswer: number | null;
  correctAnswer: number;
}): string {
  const { passage, question, options, userAnswer, correctAnswer } = args;
  const optionLines = options
    .map((opt, i) => `${LETTERS[i]}. ${opt}`)
    .join('\n');
  const userLine =
    userAnswer == null
      ? 'Người làm bài đã bỏ trống câu này (không chọn đáp án nào).'
      : `Người làm bài đã chọn đáp án ${LETTERS[userAnswer]}.`;
  const wrongLine =
    userAnswer == null || userAnswer === correctAnswer
      ? 'Vì người làm bài không chọn sai (đúng hoặc bỏ trống), hãy để "whyUserWrong" là null.'
      : `Hãy giải thích ngắn gọn vì sao đáp án ${LETTERS[userAnswer]} mà người làm bài chọn là SAI — bẫy của câu hỏi nằm ở đâu.`;

  return [
    'Bạn là giáo viên luyện thi VSTEP Reading. Hãy phân tích MỘT câu hỏi đọc hiểu dưới đây.',
    '',
    '--- ĐOẠN VĂN ---',
    passage,
    '--- CÂU HỎI ---',
    question,
    '--- CÁC LỰA CHỌN ---',
    optionLines,
    `Đáp án đúng: ${LETTERS[correctAnswer]}.`,
    userLine,
    '',
    'Yêu cầu: trả lời HOÀN TOÀN bằng tiếng Việt, CHỈ trả về JSON (không thêm lời giải thích ngoài JSON) theo đúng định dạng sau:',
    '{',
    '  "whyCorrect": "Giải thích 2–4 câu vì sao đáp án đúng là đúng, dựa vào đoạn văn. Nêu rõ logic, không nói chung chung.",',
    '  "whyUserWrong": "1–3 câu giải thích vì sao lựa chọn của người làm bài là sai, hoặc null.",',
    '  "tip": "Một mẹo ngắn (1–2 câu) để làm tốt dạng câu hỏi này.",',
    '  "evidence": ["Trích nguyên văn 1 câu/cụm từ NGẮN trong đoạn văn chứng minh đáp án đúng", "..."]',
    '}',
    wrongLine,
    'Quy tắc cho "evidence": 1–3 mục, mỗi mục là trích dẫn NGUYÊN VĂN từ đoạn văn (copy chính xác từng chữ, không paraphrase, không tự bịa), mỗi mục tối đa ~200 ký tự, chỉ lấy những câu/cụm trực tiếp chứng minh đáp án đúng.',
  ].join('\n');
}

/** Parse the model reply into a ReadingAnalysis. Returns null when unusable. */
export function parseAnalyzeJson(text: string): ReadingAnalysis | null {
  if (!text) return null;
  // Strip code fences if the model wrapped the JSON.
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const whyCorrect = typeof obj.whyCorrect === 'string' ? obj.whyCorrect.trim() : '';
  const tip = typeof obj.tip === 'string' ? obj.tip.trim() : '';
  if (!whyCorrect || !tip) return null;
  const whyUserWrong =
    typeof obj.whyUserWrong === 'string' && obj.whyUserWrong.trim()
      ? obj.whyUserWrong.trim()
      : null;
  const evidence = Array.isArray(obj.evidence)
    ? obj.evidence
        .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
        .map((e) => e.trim().slice(0, 300))
        .slice(0, 3)
    : [];
  return { whyCorrect, whyUserWrong, tip, evidence };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A [start, end) character span inside one paragraph. */
export interface TextSpan {
  start: number;
  end: number;
}

/** Find one evidence quote inside a paragraph (case-insensitive, whitespace-flexible). */
export function findEvidenceSpan(text: string, quote: string): TextSpan | null {
  const q = quote.trim();
  if (q.length < 8) return null;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx >= 0) return { start: idx, end: idx + q.length };
  const flexible = (s: string): RegExp | null => {
    try {
      return new RegExp(escapeRegExp(s).replace(/\s+/g, '\\s+'), 'i');
    } catch {
      return null;
    }
  };
  const m = flexible(q)?.exec(text);
  if (m) return { start: m.index, end: m.index + m[0].length };
  // Fallback: match just the first 60 chars as an anchor.
  const head = flexible(q.slice(0, 60))?.exec(text);
  if (head) return { start: head.index, end: head.index + head[0].length };
  return null;
}

/** Map each evidence quote to the paragraph + span where it occurs. */
export function getEvidenceSpans(paragraphs: string[], evidence: string[]): Map<number, TextSpan[]> {
  const map = new Map<number, TextSpan[]>();
  for (const quote of evidence.slice(0, 3)) {
    for (let i = 0; i < paragraphs.length; i++) {
      const span = findEvidenceSpan(paragraphs[i], quote);
      if (span) {
        const list = map.get(i) ?? [];
        if (!list.some((s) => span.start < s.end && s.start < span.end)) list.push(span);
        map.set(i, list);
        break; // a quote belongs to the first paragraph containing it
      }
    }
  }
  return map;
}
