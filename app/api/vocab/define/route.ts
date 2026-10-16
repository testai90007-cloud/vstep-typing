import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import type { VocabDefinition } from '@/lib/vocab';

export const runtime = 'nodejs';

const NOT_FOUND_TTL_MS = 24 * 3600 * 1000;
const BATCH_MAX_WORDS = 100;
const BATCH_CONCURRENCY = 16;

type Sql = NonNullable<ReturnType<typeof getSql>>;

/** Self-healing DDL: same tables as migrations/005_vocab.sql. */
async function ensureVocabTables(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS vocab_cache (word TEXT PRIMARY KEY, payload JSONB NOT NULL, fetched_at TIMESTAMPTZ DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS vocab_progress (user_id TEXT NOT NULL, word TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'learning', correct INT NOT NULL DEFAULT 0, wrong INT NOT NULL DEFAULT 0, last_seen TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, word))`;
  await sql`CREATE TABLE IF NOT EXISTS vocab_user_stats (user_id TEXT PRIMARY KEY, xp INT NOT NULL DEFAULT 0, level INT NOT NULL DEFAULT 1, streak INT NOT NULL DEFAULT 0, last_played_date DATE, frames_unlocked JSONB NOT NULL DEFAULT '["wood"]', active_frame TEXT NOT NULL DEFAULT 'wood', awarded_streak_milestones JSONB NOT NULL DEFAULT '[]', awarded_conquered JSONB NOT NULL DEFAULT '[]')`;
}

function notFound(word: string): VocabDefinition {
  return {
    word,
    phonetic: '',
    audio: '',
    meanings: [],
    synonyms: [],
    antonyms: [],
    found: false,
  };
}

function isValidWord(word: string): boolean {
  return !!word && word.length <= 80 && /^[a-z][a-z'’\-. ]*$/.test(word);
}

function dedupeKeepFirst(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

interface DictEntry {
  word?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: {
      definition?: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }[];
    synonyms?: string[];
    antonyms?: string[];
  }[];
}

function normalize(entry: DictEntry, word: string): VocabDefinition {
  const phonetics = entry.phonetics ?? [];
  const withAudio = phonetics.filter((p) => p.audio);
  // Prefer UK audio, then US, then any audio.
  const pick =
    withAudio.find((p) => p.audio!.includes('-uk')) ??
    withAudio.find((p) => p.audio!.includes('-us')) ??
    withAudio[0];
  const audio = pick?.audio ?? '';
  const phonetic = pick?.text ?? phonetics.find((p) => p.text)?.text ?? '';

  const meanings = (entry.meanings ?? [])
    .map((m) => ({
      pos: String(m.partOfSpeech ?? ''),
      definitions: (m.definitions ?? []).slice(0, 2).map((d) => ({
        definition: String(d.definition ?? ''),
        example: String(d.example ?? ''),
        synonyms: Array.isArray(d.synonyms) ? d.synonyms.map(String) : [],
        antonyms: Array.isArray(d.antonyms) ? d.antonyms.map(String) : [],
      })),
    }))
    .filter((m) => m.pos && m.definitions.length > 0);

  const allSynonyms: string[] = [];
  const allAntonyms: string[] = [];
  for (const m of entry.meanings ?? []) {
    if (Array.isArray(m.synonyms)) allSynonyms.push(...m.synonyms.map(String));
    if (Array.isArray(m.antonyms)) allAntonyms.push(...m.antonyms.map(String));
    for (const d of m.definitions ?? []) {
      if (Array.isArray(d.synonyms)) allSynonyms.push(...d.synonyms.map(String));
      if (Array.isArray(d.antonyms)) allAntonyms.push(...d.antonyms.map(String));
    }
  }

  return {
    word,
    phonetic,
    audio,
    meanings,
    synonyms: dedupeKeepFirst(allSynonyms).slice(0, 12),
    antonyms: dedupeKeepFirst(allAntonyms).slice(0, 12),
    found: true,
  };
}

type FetchResult =
  | { status: 'ok'; def: VocabDefinition }
  | { status: 'not-found' }
  | { status: 'error' };

async function fetchDictionary(word: string): Promise<FetchResult> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.status === 404) return { status: 'not-found' };
    if (!res.ok) return { status: 'error' };
    const data = (await res.json()) as DictEntry[];
    if (!Array.isArray(data) || data.length === 0) return { status: 'not-found' };
    return { status: 'ok', def: normalize(data[0], word) };
  } catch {
    return { status: 'error' };
  }
}

interface WiktionaryEntry {
  language?: string;
  partOfSpeech?: string;
  definitions?: { definition?: string; examples?: string[] }[];
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Wiktionary REST definitions as a fallback when Dictionary API fails.
 * No phonetic/audio/synonyms here — listening/synant games skip words
 * without audio/synonyms anyway, and the other games only need meanings.
 */
function normalizeWiktionary(data: unknown, word: string): VocabDefinition | null {
  // REST shape is {"en": [entries...]}, not a bare array.
  const entries: WiktionaryEntry[] = Array.isArray(data)
    ? (data as WiktionaryEntry[])
    : Object.values((data ?? {}) as Record<string, unknown>).flat() as WiktionaryEntry[];
  const meanings: VocabDefinition['meanings'] = [];
  for (const entry of entries) {
    if (entry.language !== 'English') continue;
    const pos = String(entry.partOfSpeech ?? '').trim();
    if (!pos) continue;
    const definitions = (entry.definitions ?? [])
      .map((d) => ({
        definition: stripHtml(String(d.definition ?? '')),
        example: stripHtml(String(d.examples?.[0] ?? '')),
        synonyms: [] as string[],
        antonyms: [] as string[],
      }))
      .filter((d) => d.definition)
      .slice(0, 2);
    if (definitions.length > 0) meanings.push({ pos, definitions });
    if (meanings.length >= 4) break;
  }
  if (meanings.length === 0) return null;
  return { word, phonetic: '', audio: '', meanings, synonyms: [], antonyms: [], found: true };
}

async function fetchWiktionary(word: string): Promise<FetchResult> {
  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'vstep-typing/1.0 (vocabulary practice)' },
      }
    );
    if (res.status === 404) return { status: 'not-found' };
    if (!res.ok) return { status: 'error' };
    const def = normalizeWiktionary(await res.json(), word);
    return def ? { status: 'ok', def } : { status: 'not-found' };
  } catch {
    return { status: 'error' };
  }
}

/** Cache write (merged with any cached etymology). Failures never throw. */
async function writeCache(sql: Sql | null, word: string, def: VocabDefinition): Promise<void> {
  if (!sql) return;
  try {
    // Merge with any cached etymology so the two routes never clobber
    // each other's fields.
    const rows = await sql`SELECT payload FROM vocab_cache WHERE word = ${word}`;
    const existing = (rows[0]?.payload ?? {}) as Record<string, unknown>;
    const merged = { ...existing, ...def };
    await sql`INSERT INTO vocab_cache (word, payload) VALUES (${word}, ${JSON.stringify(merged)}::jsonb)
              ON CONFLICT (word) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()`;
  } catch {
    /* cache write failure must not fail the lookup */
  }
}
/**
 * Resolve one word: cache-first, Dictionary API, Wiktionary fallback.
 * A miss is cached ONLY when both sources definitively say not-found —
 * transient errors (5xx/timeout) are never cached as misses, so a degraded
 * upstream can't poison the cache and decks retry those words next time.
 * Cache failures never break the lookup. Callers run ensureVocabTables first.
 */
async function resolveWord(sql: Sql | null, word: string): Promise<VocabDefinition> {
  if (sql) {
    try {
      const rows = await sql`SELECT payload, fetched_at FROM vocab_cache WHERE word = ${word}`;
      if (rows.length > 0) {
        const payload = rows[0].payload as Record<string, unknown>;
        const age = Date.now() - new Date(String(rows[0].fetched_at)).getTime();
        // A cached not-found entry is only trusted for 24h; a found
        // definition is trusted until the row is replaced.
        if (payload && (payload.found === true || age < NOT_FOUND_TTL_MS)) {
          return payload as unknown as VocabDefinition;
        }
      }
    } catch {
      /* cache unavailable — fall through to a live fetch */
    }
  }

  const primary = await fetchDictionary(word);
  if (primary.status === 'ok') {
    await writeCache(sql, word, primary.def);
    return primary.def;
  }
  const fallback = await fetchWiktionary(word);
  if (fallback.status === 'ok') {
    await writeCache(sql, word, fallback.def);
    return fallback.def;
  }
  if (primary.status === 'not-found' && fallback.status === 'not-found') {
    await writeCache(sql, word, notFound(word));
  }
  return notFound(word);
}

/** Run fn over items in concurrent chunks, preserving input order. */
async function mapChunks<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/**
 * GET /api/vocab/define?word=...
 * Definition + phonetic + audio + synonyms/antonyms for one word.
 * Cache-first (vocab_cache). No sign-in required.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = checkRateLimit(`vocab-define:${ip}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const raw = req.nextUrl.searchParams.get('word') ?? '';
  const word = raw.trim().toLowerCase();
  if (!isValidWord(word)) {
    return NextResponse.json({ error: 'Từ không hợp lệ.' }, { status: 400 });
  }

  const sql = getSql();
  if (sql) {
    try {
      await ensureVocabTables(sql);
    } catch {
      /* tables may already exist — resolution tolerates cache failures */
    }
  }
  return NextResponse.json(await resolveWord(sql, word));
}

/**
 * POST /api/vocab/define — resolve many words in ONE request.
 * Body: { words: string[] } (max 100, invalid entries skipped).
 * The game shell used to fire one GET per word sequentially — a 50-word
 * deck meant 50+ round trips. This endpoint resolves the batch server-side
 * with capped concurrency and returns { results: Record<word, definition> }.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = checkRateLimit(`vocab-define-batch:${ip}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body phải là JSON.' }, { status: 400 });
  }
  const rawWords = (body as { words?: unknown })?.words;
  if (!Array.isArray(rawWords) || rawWords.length === 0) {
    return NextResponse.json({ error: 'Cần danh sách từ.' }, { status: 400 });
  }
  const words = dedupeKeepFirst(rawWords.map((w) => String(w).trim().toLowerCase()))
    .filter(isValidWord)
    .slice(0, BATCH_MAX_WORDS);
  if (words.length === 0) {
    return NextResponse.json({ error: 'Không có từ hợp lệ.' }, { status: 400 });
  }

  const sql = getSql();
  if (sql) {
    try {
      await ensureVocabTables(sql);
    } catch {
      /* resolution tolerates cache failures */
    }
  }
  const defs = await mapChunks(words, BATCH_CONCURRENCY, (w) => resolveWord(sql, w));
  const results: Record<string, VocabDefinition> = {};
  words.forEach((w, i) => {
    results[w] = defs[i];
  });
  return NextResponse.json({ results });
}
