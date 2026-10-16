import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ensureUser, getSql } from '@/lib/db';

export const runtime = 'nodejs';

interface SaveBody {
  testId?: string;
  score?: number;
  total?: number;
  durationSec?: number;
  answers?: Record<string, number>;
  mode?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Bạn cần đăng nhập bằng Google để lưu kết quả.' },
      { status: 401 }
    );
  }

  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body phải là JSON.' }, { status: 400 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ saved: false, reason: 'no-database' });
  }

  try {
    await ensureUser(sql, {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    });

    // Validate before the DB sees the values (a crafted score=9999/total=1
    // used to be stored and corrupt dashboard averages).
    const bad = (msg: string) =>
      NextResponse.json({ saved: false, reason: 'invalid-input', error: msg }, { status: 400 });
    if (body.total !== undefined) {
      if (typeof body.total !== 'number' || !Number.isInteger(body.total) || body.total <= 0) {
        return bad('Tổng số câu phải là số nguyên lớn hơn 0.');
      }
    }
    if (body.score !== undefined) {
      if (typeof body.score !== 'number' || !Number.isFinite(body.score) || body.score < 0) {
        return bad('Điểm phải là số không âm.');
      }
      if (body.total !== undefined && body.score > body.total) {
        return bad('Điểm không được lớn hơn tổng số câu.');
      }
    }
    if (
      body.durationSec !== undefined &&
      (typeof body.durationSec !== 'number' || !Number.isFinite(body.durationSec) || body.durationSec < 0)
    ) {
      return bad('Thời gian làm bài không hợp lệ.');
    }
    if (body.answers !== undefined) {
      if (typeof body.answers !== 'object' || body.answers === null || Array.isArray(body.answers)) {
        return bad('Đáp án không hợp lệ.');
      }
      if (JSON.stringify(body.answers).length > 100 * 1024) {
        return bad('Dữ liệu đáp án quá lớn (tối đa 100KB).');
      }
    }

    await sql`INSERT INTO reading_sessions (user_id, test_id, score, total, duration_sec, answers, mode)
              VALUES (${session.user.id}, ${body.testId || null}, ${body.score ?? null},
                      ${body.total ?? null}, ${body.durationSec ?? null},
                      ${body.answers ? JSON.stringify(body.answers) : null},
                      ${body.mode || null})`;
    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error('reading/save failed:', err);
    return NextResponse.json({ saved: false, reason: 'db-error' }, { status: 500 });
  }
}
