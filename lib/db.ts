// ---------------------------------------------------------------------------
// Neon Postgres client. Returns null when DATABASE_URL is not set so the app
// still runs (practice UI works, saving is skipped with a clear message).
// ---------------------------------------------------------------------------

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let cached: NeonQueryFunction<false, false> | null | undefined;

export function getSql(): NeonQueryFunction<false, false> | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    cached = null;
    return null;
  }
  cached = neon(url);
  return cached;
}

/** True when the app can persist data. */
export function hasDatabase(): boolean {
  return getSql() !== null;
}

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

/** Upsert the signed-in Google user (id = stable Google `sub`). No-op without a DB. */
export async function ensureUser(sql: NeonQueryFunction<false, false>, user: SessionUser) {
  await sql`INSERT INTO users (id, email, name, image)
            VALUES (${user.id}, ${user.email ?? null}, ${user.name ?? null}, ${user.image ?? null})
            ON CONFLICT (id) DO UPDATE
            SET email = EXCLUDED.email, name = EXCLUDED.name, image = EXCLUDED.image`;
  // Self-healing: before the auth fix, logins minted a random user id, so old
  // sessions sit under throwaway user rows. Same Google account = same email,
  // so re-key those sessions to the stable id once and drop the dupes.
  if (user.email) {
    const dupes = await sql`SELECT id FROM users WHERE email = ${user.email} AND id <> ${user.id}`;
    for (const d of dupes as { id: string }[]) {
      await sql`UPDATE writing_sessions SET user_id = ${user.id} WHERE user_id = ${d.id}`;
      await sql`UPDATE speaking_sessions SET user_id = ${user.id} WHERE user_id = ${d.id}`;
      await sql`UPDATE listening_sessions SET user_id = ${user.id} WHERE user_id = ${d.id}`;
      await sql`UPDATE reading_sessions SET user_id = ${user.id} WHERE user_id = ${d.id}`;
      await sql`DELETE FROM users WHERE id = ${d.id}`;
    }
  }
}
