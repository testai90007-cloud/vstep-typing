import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/health — liveness / deploy-verification check.
 * Returns booleans and status strings only — never secret values.
 * Unauthenticated on purpose (uptime monitors can't sign in).
 */
export async function GET() {
  let db: 'up' | 'down' | 'unconfigured';
  const sql = getSql();
  if (!sql) {
    db = 'unconfigured';
  } else {
    try {
      await sql`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
  }

  const authConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_SECRET
  );

  return NextResponse.json({
    ok: db !== 'down',
    db,
    env: { auth: authConfigured },
  });
}
