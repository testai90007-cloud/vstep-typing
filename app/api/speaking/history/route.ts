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
    const rows = await sql`
      SELECT part, prompt, transcript, scores, overall, feedback, created_at
      FROM speaking_sessions
      WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC
      LIMIT 100`;
    return NextResponse.json({ sessions: rows });
  } catch (err) {
    console.error('speaking/history failed:', err);
    return NextResponse.json({ error: 'Không đọc được lịch sử.' }, { status: 500 });
  }
}
