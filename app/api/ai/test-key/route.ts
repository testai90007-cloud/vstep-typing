import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/**
 * POST /api/ai/test-key
 * body: { provider: 'gemini' | 'openai', apiKey: string }
 *
 * Makes the cheapest possible provider call to check whether the key is
 * valid. The key is used transiently for this single check — never stored
 * or logged. Requires sign-in (otherwise anyone could use this endpoint
 * as a free key-validation oracle).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ valid: false, error: 'Bạn cần đăng nhập bằng Google.' }, { status: 401 });
  }

  // 5 checks/minute per user.
  const rl = checkRateLimit(`test-key:${session.user.id}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

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
      // The key travels in the x-goog-api-key header — never in the URL
      // query string, which routinely ends up in access logs.
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
        {
          headers: { 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(15000),
        }
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
