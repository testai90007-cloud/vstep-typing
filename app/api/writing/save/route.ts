import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ensureUser, getSql } from '@/lib/db';

export const runtime = 'nodejs';

interface SaveBody {
  templateId?: string;
  mode?: string;
  accuracy?: number;
  durationSec?: number;
  /** When present, update the AI score columns of this existing row instead of inserting. */
  id?: number;
  aiScore?: number;
  aiPart1?: number;
  aiPart2?: number;
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
    // Self-healing columns for AI scores (0–10 scale, like speaking).
    await sql`ALTER TABLE writing_sessions ADD COLUMN IF NOT EXISTS ai_score REAL`;
    await sql`ALTER TABLE writing_sessions ADD COLUMN IF NOT EXISTS ai_part1 REAL`;
    await sql`ALTER TABLE writing_sessions ADD COLUMN IF NOT EXISTS ai_part2 REAL`;

    if (body.id) {
      // Attach AI scores to the row created when the exam was submitted.
      // Scoped to the user so one user can never touch another's rows.
      const rows = await sql`UPDATE writing_sessions
              SET ai_score = ${body.aiScore ?? null},
                  ai_part1 = ${body.aiPart1 ?? null},
                  ai_part2 = ${body.aiPart2 ?? null}
              WHERE id = ${body.id} AND user_id = ${session.user.id}
              RETURNING id`;
      if (rows.length === 0) {
        return NextResponse.json({ saved: false, reason: 'not-found' }, { status: 404 });
      }
      return NextResponse.json({ saved: true, id: rows[0].id });
    }

    const rows = await sql`INSERT INTO writing_sessions (user_id, template_id, mode, accuracy, duration_sec)
              VALUES (${session.user.id}, ${body.templateId || null}, ${body.mode || null},
                      ${body.accuracy ?? null}, ${body.durationSec ?? null})
              RETURNING id`;
    return NextResponse.json({ saved: true, id: rows[0]?.id ?? null });
  } catch (err) {
    console.error('writing/save failed:', err);
    return NextResponse.json({ saved: false, reason: 'db-error' }, { status: 500 });
  }
}
