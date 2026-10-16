import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import {
  buildReadingAnalyzePrompt,
  parseAnalyzeJson,
} from '@/lib/reading-analyze-prompts';

// AI analysis for one Reading question, after a mock test is submitted (BYOK:
// the caller's own Gemini/OpenAI key, same pattern as Writing/Speaking scoring).
// Returns structured JSON: why the correct answer is right, why the user's
// pick was wrong (when applicable), a short tip, and verbatim evidence
// quotes the client highlights in the passage.
export const runtime = 'nodejs';
export const maxDuration = 60;

const GEMINI_MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.8-flash')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const OPENAI_MODEL = process.env.OPENAI_SCORE_MODEL || 'gpt-4o-mini';
const ANALYZE_BUDGET_MS = 50000;
const MAX_ATTEMPT_MS = 20000;
const MAX_PASSAGE_CHARS = 12000;

type Provider = 'openai' | 'gemini';

function remainingMs(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('TIMEOUT');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function callGemini(prompt: string, apiKey: string, deadline: number): Promise<string> {
  let lastError = '';
  for (const model of GEMINI_MODELS) {
    const budget = Math.min(MAX_ATTEMPT_MS, remainingMs(deadline));
    if (budget <= 0) throw new Error('TIMEOUT');
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
          }),
        },
        budget,
      );
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      continue;
    }
    if (!res.ok) {
      lastError = `Gemini ${model} -> HTTP ${res.status}`;
      continue;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (text.trim()) return text;
    lastError = `Gemini ${model} -> empty response`;
  }
  throw new Error(lastError || 'Gemini failed');
}

async function callOpenAI(prompt: string, apiKey: string, deadline: number): Promise<string> {
  const budget = Math.min(MAX_ATTEMPT_MS, remainingMs(deadline));
  if (budget <= 0) throw new Error('TIMEOUT');
  const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  }, budget);
  if (!res.ok) throw new Error(`OpenAI -> HTTP ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('OpenAI -> empty response');
  return text;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Bạn cần đăng nhập bằng Google để dùng Phân tích với AI.' },
      { status: 401 },
    );
  }

  // 45 analyze requests / 5 minutes per user: enough for one full 40-question
  // bulk run plus a few retries, while still bounding abuse.
  const rl = checkRateLimit(`reading-analyze:${session.user.id}`, 45, 300_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request không hợp lệ.' }, { status: 400 });
  }

  const passage = String(body.passage || '').trim();
  const question = String(body.question || '').trim();
  const options = Array.isArray(body.options) ? body.options.map(String) : [];
  const userAnswer =
    body.userAnswer === null || body.userAnswer === undefined
      ? null
      : Number(body.userAnswer);
  const correctAnswer = Number(body.correctAnswer);
  const formProvider = String(body.provider || '').toLowerCase();
  const formKey = String(body.apiKey || '').trim();

  if (!passage || passage.length > MAX_PASSAGE_CHARS) {
    return NextResponse.json({ error: 'Đoạn văn không hợp lệ.' }, { status: 400 });
  }
  if (!question || options.length !== 4) {
    return NextResponse.json({ error: 'Câu hỏi không hợp lệ.' }, { status: 400 });
  }
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
    return NextResponse.json({ error: 'Đáp án đúng không hợp lệ.' }, { status: 400 });
  }
  if (
    userAnswer !== null &&
    (!Number.isInteger(userAnswer) || userAnswer < 0 || userAnswer > 3)
  ) {
    return NextResponse.json({ error: 'Đáp án đã chọn không hợp lệ.' }, { status: 400 });
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
          'Chưa có API key để phân tích. Vào trang Cài đặt để thêm key Gemini (miễn phí) hoặc OpenAI của bạn — key chỉ lưu trong trình duyệt của bạn, server không giữ.',
      },
      { status: 503 },
    );
  }

  const prompt = buildReadingAnalyzePrompt({
    passage,
    question,
    options,
    userAnswer,
    correctAnswer,
  });
  const deadline = Date.now() + ANALYZE_BUDGET_MS;

  try {
    const raw =
      provider === 'gemini'
        ? await callGemini(prompt, apiKey, deadline)
        : await callOpenAI(prompt, apiKey, deadline);
    const analysis = parseAnalyzeJson(raw);
    if (!analysis) {
      return NextResponse.json(
        { error: 'AI trả về kết quả không đúng định dạng. Bấm thử lại.' },
        { status: 502 },
      );
    }
    return NextResponse.json({ analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'TIMEOUT') {
      return NextResponse.json(
        { error: 'AI phân tích quá thời gian. Bấm thử lại.' },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: 'AI phân tích thất bại. Kiểm tra key rồi bấm thử lại.' },
      { status: 502 },
    );
  }
}
