import { NextRequest, NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { ensureUser, getSql, userExists } from '@/lib/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { VOCAB_LEVELS, type VocabLevel } from '@/lib/vocab';
import {
  applyProgressUpdate,
  defaultStats,
  FRAMES,
  type VocabAnswerKind,
  type VocabProgressEntry,
  type VocabStats,
} from '@/lib/vocab-gamification';

export const runtime = 'nodejs';

const ANSWER_KINDS: VocabAnswerKind[] = ['flashcard', 'quiz', 'listening', 'fill', 'matching', 'synant'];

/** Self-healing DDL: same tables as migrations/005_vocab.sql. */
async function ensureVocabTables(sql: NonNullable<ReturnType<typeof getSql>>) {
  await sql`CREATE TABLE IF NOT EXISTS vocab_cache (word TEXT PRIMARY KEY, payload JSONB NOT NULL, fetched_at TIMESTAMPTZ DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS vocab_progress (user_id TEXT NOT NULL, word TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'learning', correct INT NOT NULL DEFAULT 0, wrong INT NOT NULL DEFAULT 0, last_seen TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, word))`;
  await sql`CREATE TABLE IF NOT EXISTS vocab_user_stats (user_id TEXT PRIMARY KEY, xp INT NOT NULL DEFAULT 0, level INT NOT NULL DEFAULT 1, streak INT NOT NULL DEFAULT 0, last_played_date DATE, frames_unlocked JSONB NOT NULL DEFAULT '["wood"]', active_frame TEXT NOT NULL DEFAULT 'wood', awarded_streak_milestones JSONB NOT NULL DEFAULT '[]', awarded_conquered JSONB NOT NULL DEFAULT '[]')`;
}

function parseJsonArray<T>(value: unknown, fallback: T[]): T[] {
  try {
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'string') {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

/**
 * GET /api/vocab/progress — signed-in user's per-word progress + stats.
 * Read-only: never creates a user row (mirrors history endpoints).
 */
export async function GET() {
  let session: Session | null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập bằng Google.' }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ progress: {}, stats: defaultStats() });
  }

  try {
    await ensureVocabTables(sql);
    if (!(await userExists(sql, session.user.id))) {
      return NextResponse.json({ progress: {}, stats: defaultStats() });
    }

    const rows = await sql`SELECT word, status, correct, wrong, last_seen
                           FROM vocab_progress WHERE user_id = ${session.user.id}`;
    const progress: Record<string, VocabProgressEntry> = {};
    for (const r of rows) {
      progress[String(r.word)] = {
        status: r.status === 'mastered' ? 'mastered' : r.status === 'new' ? 'new' : 'learning',
        correct: Number(r.correct) || 0,
        wrong: Number(r.wrong) || 0,
        last_seen: r.last_seen ? new Date(String(r.last_seen)).toISOString() : null,
      };
    }

    const srows = await sql`SELECT xp, level, streak, last_played_date, frames_unlocked,
                                   active_frame, awarded_streak_milestones, awarded_conquered
                            FROM vocab_user_stats WHERE user_id = ${session.user.id}`;
    const stats: VocabStats =
      srows.length > 0
        ? {
            xp: Number(srows[0].xp) || 0,
            level: Number(srows[0].level) || 1,
            streak: Number(srows[0].streak) || 0,
            lastPlayedDate: srows[0].last_played_date
              ? String(srows[0].last_played_date).slice(0, 10)
              : null,
            framesUnlocked: parseJsonArray<string>(srows[0].frames_unlocked, ['wood']),
            activeFrame: String(srows[0].active_frame ?? 'wood'),
            awardedStreakMilestones: parseJsonArray<number>(srows[0].awarded_streak_milestones, []),
            awardedConquered: parseJsonArray<VocabLevel>(srows[0].awarded_conquered, []),
          }
        : defaultStats();

    return NextResponse.json({ progress, stats });
  } catch {
    return NextResponse.json({ error: 'Không tải được tiến độ. Thử lại sau.' }, { status: 500 });
  }
}

/**
 * POST /api/vocab/progress — save one answer.
 * body: { word, correct, kind, perfect?, reviewCleared?, conqueredLevel? }
 * All XP/streak/level/frame math lives in applyProgressUpdate.
 */
export async function POST(req: NextRequest) {
  let session: Session | null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập bằng Google.' }, { status: 401 });
  }

  const rl = checkRateLimit(`vocab-progress:${session.user.id}`, 120, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Body phải là JSON.' }, { status: 400 });
  }

  const word = String(body.word ?? '').trim().toLowerCase();
  const correct = body.correct === true;
  const kind = String(body.kind ?? '');

  // Frame selection: { action: 'setFrame', frameId }. Only unlocked frames
  // may become active. Kept in this route so the picker has one endpoint.
  if (body.action === 'setFrame') {
    const frameId = String(body.frameId ?? '');
    const frame = FRAMES.find((f) => f.id === frameId);
    if (!frame) {
      return NextResponse.json({ error: 'Khung không hợp lệ.' }, { status: 400 });
    }
    const sqlFrame = getSql();
    if (!sqlFrame) {
      return NextResponse.json({ error: 'Chưa có cơ sở dữ liệu. Thử lại sau.' }, { status: 503 });
    }
    try {
      await ensureVocabTables(sqlFrame);
      await ensureUser(sqlFrame, {
        id: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
      });
      const frows = await sqlFrame`SELECT frames_unlocked FROM vocab_user_stats WHERE user_id = ${session.user.id}`;
      const unlocked = frows.length > 0 ? parseJsonArray<string>(frows[0].frames_unlocked, ['wood']) : ['wood'];
      if (!unlocked.includes(frameId)) {
        return NextResponse.json({ error: 'Khung này chưa được mở khóa.' }, { status: 403 });
      }
      await sqlFrame`INSERT INTO vocab_user_stats (user_id, xp, level, streak, last_played_date, frames_unlocked, active_frame, awarded_streak_milestones, awarded_conquered)
                VALUES (${session.user.id}, 0, 1, 0, NULL, ${JSON.stringify(unlocked)}::jsonb, ${frameId}, '[]'::jsonb, '[]'::jsonb)
                ON CONFLICT (user_id) DO UPDATE SET active_frame = EXCLUDED.active_frame`;
      return NextResponse.json({ ok: true, activeFrame: frameId });
    } catch {
      return NextResponse.json({ error: 'Không lưu được khung. Thử lại sau.' }, { status: 500 });
    }
  }

  if (!word || word.length > 80 || !ANSWER_KINDS.includes(kind as VocabAnswerKind)) {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }
  const conqueredLevel =
    typeof body.conqueredLevel === 'string' &&
    (VOCAB_LEVELS as string[]).includes(body.conqueredLevel)
      ? (body.conqueredLevel as VocabLevel)
      : null;

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ error: 'Chưa có cơ sở dữ liệu. Thử lại sau.' }, { status: 503 });
  }

  try {
    await ensureVocabTables(sql);
    await ensureUser(sql, {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
    });

    const today = new Date().toISOString().slice(0, 10);

    const prows = await sql`SELECT status, correct, wrong, last_seen FROM vocab_progress
                            WHERE user_id = ${session.user.id} AND word = ${word}`;
    const prevEntry: VocabProgressEntry | null =
      prows.length > 0
        ? {
            status: prows[0].status === 'mastered' ? 'mastered' : 'learning',
            correct: Number(prows[0].correct) || 0,
            wrong: Number(prows[0].wrong) || 0,
            last_seen: prows[0].last_seen ? new Date(String(prows[0].last_seen)).toISOString() : null,
          }
        : null;

    const srows = await sql`SELECT xp, level, streak, last_played_date, frames_unlocked,
                                   active_frame, awarded_streak_milestones, awarded_conquered
                            FROM vocab_user_stats WHERE user_id = ${session.user.id}`;
    const stats: VocabStats =
      srows.length > 0
        ? {
            xp: Number(srows[0].xp) || 0,
            level: Number(srows[0].level) || 1,
            streak: Number(srows[0].streak) || 0,
            lastPlayedDate: srows[0].last_played_date
              ? String(srows[0].last_played_date).slice(0, 10)
              : null,
            framesUnlocked: parseJsonArray<string>(srows[0].frames_unlocked, ['wood']),
            activeFrame: String(srows[0].active_frame ?? 'wood'),
            awardedStreakMilestones: parseJsonArray<number>(srows[0].awarded_streak_milestones, []),
            awardedConquered: parseJsonArray<VocabLevel>(srows[0].awarded_conquered, []),
          }
        : defaultStats();

    const result = applyProgressUpdate(stats, prevEntry, {
      word,
      correct,
      kind: kind as VocabAnswerKind,
      perfect: body.perfect === true,
      reviewCleared: body.reviewCleared === true,
      conqueredLevel,
      today,
    });

    await sql`INSERT INTO vocab_progress (user_id, word, status, correct, wrong, last_seen)
              VALUES (${session.user.id}, ${word}, ${result.entry.status}, ${result.entry.correct}, ${result.entry.wrong}, now())
              ON CONFLICT (user_id, word) DO UPDATE
              SET status = EXCLUDED.status, correct = EXCLUDED.correct, wrong = EXCLUDED.wrong, last_seen = now()`;

    const s = result.stats;
    await sql`INSERT INTO vocab_user_stats (user_id, xp, level, streak, last_played_date, frames_unlocked, active_frame, awarded_streak_milestones, awarded_conquered)
              VALUES (${session.user.id}, ${s.xp}, ${s.level}, ${s.streak}, ${s.lastPlayedDate}, ${JSON.stringify(s.framesUnlocked)}::jsonb, ${s.activeFrame}, ${JSON.stringify(s.awardedStreakMilestones ?? [])}::jsonb, ${JSON.stringify(s.awardedConquered ?? [])}::jsonb)
              ON CONFLICT (user_id) DO UPDATE
              SET xp = EXCLUDED.xp, level = EXCLUDED.level, streak = EXCLUDED.streak,
                  last_played_date = EXCLUDED.last_played_date, frames_unlocked = EXCLUDED.frames_unlocked,
                  active_frame = EXCLUDED.active_frame,
                  awarded_streak_milestones = EXCLUDED.awarded_streak_milestones,
                  awarded_conquered = EXCLUDED.awarded_conquered`;

    return NextResponse.json({
      xp: s.xp,
      gained: result.gained,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      unlockedFrame: result.unlockedFrame,
      bonuses: result.bonuses,
    });
  } catch {
    return NextResponse.json({ error: 'Không lưu được tiến độ. Thử lại sau.' }, { status: 500 });
  }
}
