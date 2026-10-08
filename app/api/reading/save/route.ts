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
    // Self-healing: create the table on first write (migration 003, idempotent).
    await sql`CREATE TABLE IF NOT EXISTS reading_sessions (
      id           SERIAL PRIMARY KEY,
      user_id      TEXT REFERENCES users(id),
      test_id      TEXT,
      score        INT,
      total        INT,
      duration_sec INT,
      answers      JSONB,
      created_at   TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reading_user ON reading_sessions(user_id, created_at DESC)`;
    await sql`ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS mode TEXT`;
    await ensureUser(sql, {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    });
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
