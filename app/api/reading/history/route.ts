import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSql } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập bằng Google.' }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ sessions: [], reason: 'no-database' });
  }

  try {
    // Self-healing: create the table on first read (migration 003, idempotent).
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
    const rows = await sql`
      SELECT test_id, score, total, duration_sec, answers, created_at
      FROM reading_sessions
      WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC
      LIMIT 100`;
    return NextResponse.json({ sessions: rows });
  } catch (err) {
    console.error('reading/history failed:', err);
    return NextResponse.json({ error: 'Không đọc được lịch sử.' }, { status: 500 });
  }
}
