import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSql, userExists } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập bằng Google.' }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ sessions: [], total: 0, reason: 'no-database' });
  }

  // Pagination: ?limit= (default 100, max 200) &offset= (default 0).
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '100', 10) || 100));
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0);

  try {
    // Read-only: GETs must not write to the DB (no upsert, no self-healing).
    // A user row is created on first save; without one there can be no sessions.
    if (!(await userExists(sql, session.user.id))) {
      return NextResponse.json({ sessions: [], total: 0 });
    }
    const [rows, countRows] = await Promise.all([
      sql`
        SELECT id, part, prompt, transcript, scores, overall, feedback, mode, created_at
        FROM speaking_sessions
        WHERE user_id = ${session.user.id}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      sql`SELECT COUNT(*)::int AS total FROM speaking_sessions WHERE user_id = ${session.user.id}`,
    ]);
    return NextResponse.json({ sessions: rows, total: countRows[0]?.total ?? 0 });
  } catch (err) {
    console.error('speaking/history failed:', err);
    return NextResponse.json({ error: 'Không đọc được lịch sử.' }, { status: 500 });
  }
}
