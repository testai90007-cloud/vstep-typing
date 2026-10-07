import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ensureUser, getSql } from '@/lib/db';

export const runtime = 'nodejs';

interface SaveBody {
  templateId?: string;
  mode?: string;
  accuracy?: number;
  durationSec?: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Bạn cần đăng nhập bằng Google để lưu tiến bộ.' },
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
    // App still works without a database; the client shows a notice.
    return NextResponse.json({ saved: false, reason: 'no-database' });
  }

  try {
    await ensureUser(sql, {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    });
    await sql`INSERT INTO writing_sessions (user_id, template_id, mode, accuracy, duration_sec)
              VALUES (${session.user.id}, ${body.templateId || null}, ${body.mode || null},
                      ${body.accuracy ?? null}, ${body.durationSec ?? null})`;
    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error('writing/save failed:', err);
    return NextResponse.json({ saved: false, reason: 'db-error' }, { status: 500 });
  }
}
