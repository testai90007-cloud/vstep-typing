import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSql } from '@/lib/db';

export const runtime = 'nodejs';

const TABLES = {
  writing: 'writing_sessions',
  speaking: 'speaking_sessions',
  listening: 'listening_sessions',
  reading: 'reading_sessions',
} as const;

type Skill = keyof typeof TABLES;

/**
 * Delete one practice session: POST /api/history/delete
 * body: { skill: 'writing' | 'speaking' | 'listening' | 'reading', id: number }
 * Only deletes rows owned by the signed-in user.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  }

  let body: { skill?: string; id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body phải là JSON.' }, { status: 400 });
  }

  const skill = body.skill as Skill;
  const id = Number(body.id);
  if (!skill || !(skill in TABLES) || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Tham số không hợp lệ.' }, { status: 400 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ error: 'Chưa kết nối database.' }, { status: 503 });
  }

  try {
    // Table name comes from a fixed allowlist above — never from raw user input.
    let deleted = 0;
    if (skill === 'writing') {
      const r = await sql`DELETE FROM writing_sessions WHERE id = ${id} AND user_id = ${session.user.id}`;
      deleted = r.length;
    } else if (skill === 'speaking') {
      const r = await sql`DELETE FROM speaking_sessions WHERE id = ${id} AND user_id = ${session.user.id}`;
      deleted = r.length;
    } else if (skill === 'listening') {
      const r = await sql`DELETE FROM listening_sessions WHERE id = ${id} AND user_id = ${session.user.id}`;
      deleted = r.length;
    } else {
      const r = await sql`DELETE FROM reading_sessions WHERE id = ${id} AND user_id = ${session.user.id}`;
      deleted = r.length;
    }
    if (deleted === 0) {
      return NextResponse.json({ error: 'Không tìm thấy bản ghi.' }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('history/delete failed:', err);
    return NextResponse.json({ error: 'Xóa thất bại.' }, { status: 500 });
  }
}
