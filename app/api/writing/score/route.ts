import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  buildTask1ScorePrompt,
  buildTask2ScorePrompt,
  parseScoreJson,
  splitTaskText,
  WRITING_SCORE_SCHEMA,
} from '@/lib/writing-score-prompts';

// AI scoring for Writing Task 1 / Task 2 (BYOK: the caller's own Gemini/OpenAI key).
// The scoring prompts were provided by the user; feedback is returned in Vietnamese.
export const runtime = 'nodejs';
export const maxDuration = 60;

const GEMINI_MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.8-flash')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const OPENAI_MODEL = process.env.OPENAI_SCORE_MODEL || 'gpt-4o-mini';
// Per-model budget: fail fast instead of hanging until the function times out.
const GEMINI_TIMEOUT_MS = 45000;

type Provider = 'openai' | 'gemini';

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function scoreWithGemini(prompt: string, apiKey: string): Promise<string> {
  let lastError = '';
  for (const model of GEMINI_MODELS) {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
              responseSchema: WRITING_SCORE_SCHEMA,
            },
          }),
        },
        GEMINI_TIMEOUT_MS
      );
    } catch {
      // Network error / timeout → try the next model.
      lastError = 'Gemini không phản hồi kịp, đang thử model khác…';
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      const parts = (data.candidates?.[0]?.content?.parts || []) as { text?: string }[];
      const text = parts.map((p) => p.text || '').join('').trim();
      if (text) return text;
      lastError = 'Empty response';
      continue;
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error('INVALID_KEY');
    }
    // 404 (model retired for this key) / 429 / 5xx → try the next model.
    lastError = `Gemini scoring failed (${res.status})`;
  }
  throw new Error(lastError || 'Gemini scoring failed');
}

async function scoreWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('INVALID_KEY');
    throw new Error(`OpenAI scoring failed (${res.status})`);
  }
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content || '').trim();
}

/** Plain-text generation (no JSON schema) — used for the off-topic model answer. */
async function generateTextWithGemini(prompt: string, apiKey: string): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        },
        GEMINI_TIMEOUT_MS
      );
    } catch {
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      const parts = (data.candidates?.[0]?.content?.parts || []) as { text?: string }[];
      const text = parts
        .map((p) => p.text || '')
        .join('')
        .trim();
      if (text) return text;
      continue;
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) return null;
  }
  return null;
}

async function generateTextWithOpenAI(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.7,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = String(data.choices?.[0]?.message?.content || '').trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handleScore(req);
  } catch (e) {
    console.error('writing/score fatal:', e);
    return NextResponse.json(
      { error: 'Máy chủ chấm điểm gặp sự cố. Đợi ít phút rồi bấm "Thử chấm lại".' },
      { status: 500 }
    );
  }
}

async function handleScore(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Bạn cần đăng nhập bằng Google để AI chấm bài.' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request không hợp lệ.' }, { status: 400 });
  }

  const part = Number(body.part);
  const essay = String(body.essay || '').trim();
  const testTitle = String(body.testTitle || '');
  const promptLines = Array.isArray(body.prompt) ? body.prompt.map(String) : [];
  const requirement = String(body.requirement || '');
  const formProvider = String(body.provider || '').toLowerCase();
  // Client-supplied key (BYOK). Used transiently for this request only —
  // never logged, never written to DB, never persisted anywhere.
  const formKey = String(body.apiKey || '').trim();

  if (![1, 2].includes(part)) {
    return NextResponse.json({ error: 'Part không hợp lệ.' }, { status: 400 });
  }
  if (essay.length < 20) {
    return NextResponse.json(
      { error: 'Bài viết quá ngắn để chấm. Hãy viết thêm rồi thử lại.' },
      { status: 422 }
    );
  }

  // Key resolution: client key first → server OPENAI_API_KEY fallback (openai only).
  let provider: Provider;
  let apiKey: string;
  if (formKey) {
    provider = formProvider === 'openai' ? 'openai' : 'gemini';
    apiKey = formKey;
  } else if (process.env.OPENAI_API_KEY) {
    provider = 'openai';
    apiKey = process.env.OPENAI_API_KEY;
  } else {
    return NextResponse.json(
      {
        error:
          'Chưa có API key để AI chấm Writing. Vào trang Cài đặt để thêm key Gemini (miễn phí) hoặc OpenAI của bạn — key chỉ lưu trong trình duyệt của bạn, server không giữ.',
      },
      { status: 503 }
    );
  }

  const taskText = promptLines.join('\n');
  const scorePrompt =
    part === 1
      ? buildTask1ScorePrompt({ testTitle, taskText, instructions: requirement, essay })
      : buildTask2ScorePrompt({ testTitle, taskText, instructions: requirement, essay });

  try {
    const feedback =
      provider === 'gemini'
        ? await scoreWithGemini(scorePrompt, apiKey)
        : await scoreWithOpenAI(scorePrompt, apiKey);
    if (!feedback) {
      return NextResponse.json(
        { error: 'AI không trả về kết quả. Hãy thử chấm lại.' },
        { status: 502 }
      );
    }
    const { score, text } = parseScoreJson(feedback);
    // Deterministic off-topic enforcement: the model only has to set the
    // boolean correctly; the server guarantees the 0 instead of trusting
    // the model's own numeric score.
    if (score && score.is_off_topic === true) {
      score.overall_score = 0;
      score.current_level = 'Below B1';
      // Criteria 1-4 earn nothing when off-topic. Criterion 5 (word count)
      // is mechanical — count it server-side and credit it if met.
      const minWords = part === 1 ? 120 : 250;
      const wc = essay.split(/\s+/).filter(Boolean).length;
      if (Array.isArray(score.criteria)) {
        score.criteria = score.criteria.map((c) => {
          if (c.key === 'word_count') {
            const s = wc >= minWords ? 10 : Math.round((wc / minWords) * 100) / 10;
            return {
              ...c,
              score: s,
              comment: `Bài viết có ${wc} từ — ${wc >= minWords ? 'đạt' : 'chưa đạt'} yêu cầu tối thiểu ${minWords} từ.`,
            };
          }
          return { ...c, score: 0 };
        });
      }
      const fb = score.level_feedback || '';
      if (!/lạc đề/i.test(fb)) {
        score.level_feedback =
          'Bài viết hoàn toàn lạc đề — không trả lời yêu cầu của đề bài nên bị 0 điểm. ' + fb;
      }
      // The model often "rewrites" the off-topic essay instead of answering the
      // actual task — replace it with a dedicated model answer to the real task.
      const { title: taskTitle, content: taskContent } = splitTaskText(taskText);
      const kind = part === 1 ? 'email/letter' : 'essay';
      const targetWords = part === 1 ? 'around 150 words' : 'around 280 words';
      const rewritePrompt =
        `Write a model ${kind} response for the VSTEP writing task below, at B2 level, ${targetWords}. ` +
        `Use ONLY the people, places and questions from the task — do not invent a different topic, recipient or scenario. ` +
        `Output ONLY the ${kind} text, no explanations, no headings.\n\n` +
        `**Test:** ${testTitle}\n**Task Title:**\n${taskTitle}\n\n**Original Content/Prompt:**\n${taskContent}\n\n**Task Instructions:**\n${requirement}`;
      const modelAnswer =
        provider === 'gemini'
          ? await generateTextWithGemini(rewritePrompt, apiKey)
          : await generateTextWithOpenAI(rewritePrompt, apiKey);
      if (modelAnswer) score.revised_version = modelAnswer;
    }
    return NextResponse.json({ score, raw: score ? '' : text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'INVALID_KEY') {
      return NextResponse.json(
        {
          error:
            'API key không hợp lệ hoặc đã hết hạn. Kiểm tra lại key trong trang Cài đặt.',
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Chấm bài thất bại. Kiểm tra mạng rồi thử chấm lại.' },
      { status: 502 }
    );
  }
}
