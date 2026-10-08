import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/ai/test-key
 * body: { provider: 'gemini' | 'openai', apiKey: string }
 *
 * Makes the cheapest possible provider call to check whether the key is
 * valid. The key is used transiently for this single check — never stored
 * or logged.
 */
export async function POST(req: NextRequest) {
  let body: { provider?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, error: 'Body phải là JSON.' }, { status: 400 });
  }

  const provider = String(body.provider || '').toLowerCase() === 'openai' ? 'openai' : 'gemini';
  const apiKey = String(body.apiKey || '').trim();
  if (!apiKey) {
    return NextResponse.json({ valid: false, error: 'Thiếu API key.' }, { status: 400 });
  }

  try {
    if (provider === 'gemini') {
      // Lightweight: list models. 400 = bad key format, 401/403 = invalid key.
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (res.ok) return NextResponse.json({ valid: true, provider });
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return NextResponse.json({ valid: false, error: 'Key không hợp lệ hoặc đã hết hạn.' });
      }
      return NextResponse.json({ valid: false, error: `Google trả về lỗi ${res.status}. Thử lại sau.` });
    }

    // OpenAI: list models with a Bearer token.
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return NextResponse.json({ valid: true, provider });
    if (res.status === 401) {
      return NextResponse.json({ valid: false, error: 'Key không hợp lệ hoặc đã hết hạn.' });
    }
    return NextResponse.json({ valid: false, error: `OpenAI trả về lỗi ${res.status}. Thử lại sau.` });
  } catch {
    return NextResponse.json({ valid: false, error: 'Không kết nối được. Kiểm tra mạng rồi thử lại.' });
  }
}
