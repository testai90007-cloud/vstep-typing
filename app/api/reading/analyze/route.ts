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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Thrown when every Gemini model answered 429 (free-tier per-minute quota). */
class RateLimitedError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super('RATE_LIMITED');
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * How long Google says to wait before retrying, from the Retry-After header
 * or the error body's details[].retryDelay (e.g. "21s"). Defaults to 20s.
 */
function parseRetryAfterMs(res: Response, bodyText: string): number {
  const header = res.headers.get('Retry-After');
  if (header) {
    const s = Number(header);
    if (Number.isFinite(s) && s > 0) return Math.min(s * 1000, 60_000);
  }
  try {
    const data = JSON.parse(bodyText) as {
      error?: { details?: { retryDelay?: string }[] };
    };
    const details = data?.error?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        const m = typeof d?.retryDelay === 'string' && d.retryDelay.match(/^([\d.]+)s$/);
        if (m) return Math.min(Number(m[1]) * 1000, 60_000);
      }
    }
  } catch {
    /* body wasn't JSON — fall through to the default */
  }
  return 20_000;
}

async function callGemini(prompt: string, apiKey: string, deadline: number): Promise<string> {
  let lastError = '';
  let lastRetryAfterMs = 0;
  let allRateLimited = true;
  for (const model of GEMINI_MODELS) {
    // Up to 2 attempts per model: the first call, plus one retry after a
    // capped wait when Google answers 429. A 429 must NOT fall through to
    // the next model immediately — that just burns the next model's quota
    // too, and a burst of questions then fails every single one.
    for (let attempt = 0; attempt < 2; attempt++) {
      const budget = Math.min(MAX_ATTEMPT_MS, remainingMs(deadline));
      if (budget <= 0) {
        if (allRateLimited && lastRetryAfterMs > 0) {
          throw new RateLimitedError(lastRetryAfterMs);
        }
        throw new Error('TIMEOUT');
      }
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
        allRateLimited = false;
        break;
      }
      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        if (text.trim()) return text;
        lastError = `Gemini ${model} -> empty response`;
        allRateLimited = false;
        break;
      }
      const bodyText = await res.text().catch(() => '');
      if (res.status === 429) {
        const waitMs = parseRetryAfterMs(res, bodyText);
        lastRetryAfterMs = Math.max(lastRetryAfterMs, waitMs);
        lastError = `Gemini ${model} -> HTTP 429`;
        if (attempt === 0 && remainingMs(deadline) >= 2000) {
          // Wait (capped at 8s so one question can't eat the whole budget),
          // then retry the same model once before falling through.
          await sleep(Math.min(waitMs, 8000, remainingMs(deadline)));
          continue;
        }
        break;
      }
      lastError = `Gemini ${model} -> HTTP ${res.status}`;
      allRateLimited = false;
      break;
    }
  }
  if (allRateLimited && lastRetryAfterMs > 0) {
    throw new RateLimitedError(lastRetryAfterMs);
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
    if (e instanceof RateLimitedError) {
      // Free-tier per-minute quota, NOT a bad key — say so explicitly, and
      // tell the client how long to wait so it can pause instead of hammering.
      const waitSec = Math.max(1, Math.ceil(e.retryAfterMs / 1000));
      return NextResponse.json(
        {
          error: `Đã chạm giới hạn tốc độ của Gemini (gói miễn phí). Đợi khoảng ${waitSec} giây rồi bấm thử lại — không cần đổi key.`,
          retryAfterMs: e.retryAfterMs,
        },
        { status: 429, headers: { 'Retry-After': String(waitSec) } },
      );
    }
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
