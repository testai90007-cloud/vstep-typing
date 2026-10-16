import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import type { VocabEtymology } from '@/lib/vocab';

export const runtime = 'nodejs';

const NOT_FOUND_TTL_MS = 24 * 3600 * 1000;
const WIKTIONARY_UA = 'vstep-typing/1.0 (vocab learning)';

/** Self-healing DDL: same tables as migrations/005_vocab.sql. */
async function ensureVocabTables(sql: NonNullable<ReturnType<typeof getSql>>) {
  await sql`CREATE TABLE IF NOT EXISTS vocab_cache (word TEXT PRIMARY KEY, payload JSONB NOT NULL, fetched_at TIMESTAMPTZ DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS vocab_progress (user_id TEXT NOT NULL, word TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'learning', correct INT NOT NULL DEFAULT 0, wrong INT NOT NULL DEFAULT 0, last_seen TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, word))`;
  await sql`CREATE TABLE IF NOT EXISTS vocab_user_stats (user_id TEXT PRIMARY KEY, xp INT NOT NULL DEFAULT 0, level INT NOT NULL DEFAULT 1, streak INT NOT NULL DEFAULT 0, last_played_date DATE, frames_unlocked JSONB NOT NULL DEFAULT '["wood"]', active_frame TEXT NOT NULL DEFAULT 'wood', awarded_streak_milestones JSONB NOT NULL DEFAULT '[]', awarded_conquered JSONB NOT NULL DEFAULT '[]')`;
}

function notFound(): VocabEtymology {
  return { chain: [], text: '', source: 'wiktionary', found: false };
}

/** Language code → Vietnamese display name (unknown codes pass through). */
const LANG_NAMES: Record<string, string> = {
  en: 'tiếng Anh',
  enm: 'tiếng Anh Trung cổ',
  ang: 'tiếng Anh cổ',
  frm: 'tiếng Pháp cổ',
  fro: 'tiếng Pháp cổ',
  fr: 'tiếng Pháp',
  la: 'Latin',
  'la-med': 'Latin Trung cổ',
  'la-vul': 'Latin bình dân',
  grc: 'Hy Lạp cổ',
  el: 'Hy Lạp',
  gem: 'Germanic',
  'gem-pro': 'Germanic nguyên thủy',
  ine: 'Ấn-Âu',
  'ine-pro': 'Ấn-Âu nguyên thủy',
  de: 'tiếng Đức',
  goh: 'tiếng Đức cổ cao',
  gmh: 'tiếng Đức Trung cổ cao',
  it: 'tiếng Ý',
  es: 'tiếng Tây Ban Nha',
  pt: 'tiếng Bồ Đào Nha',
  nl: 'tiếng Hà Lan',
  non: 'Norse cổ',
  ar: 'tiếng Ả Rập',
  sa: 'tiếng Phạn',
  zh: 'tiếng Trung',
  ja: 'tiếng Nhật',
  ru: 'tiếng Nga',
  cu: 'tiếng Slavơ Nhà thờ cổ',
  he: 'tiếng Hebrew',
  tr: 'tiếng Thổ Nhĩ Kỳ',
  fa: 'tiếng Ba Tư',
  hi: 'tiếng Hindi',
};

/**
 * Parse {{bor|en|frm|term}}, {{der|en|la-med|term}}, {{inh|en|...|term}}
 * templates in order of appearance into an origin chain.
 * Template shape: {{type|destination-lang|origin-lang|term|...}}.
 */
function parseChain(wikitext: string): { lang: string; term: string }[] {
  const chain: { lang: string; term: string }[] = [];
  const re = /\{\{(?:bor|der|inh)\|([^}]*)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext)) !== null) {
    // Capture group excludes the "bor|" prefix, so parts are
    // [destination-lang, origin-lang, term, ...].
    const parts = m[1].split('|').map((s) => s.trim());
    if (parts.length < 3) continue;
    const originLang = parts[1];
    const term = parts[2].replace(/^\[\[|\]\]$/g, '').trim();
    if (!originLang || !term) continue;
    chain.push({ lang: LANG_NAMES[originLang] ?? originLang, term });
  }
  return chain;
}

/** Strip Wiktionary markup to readable plain text, capped ~600 chars. */
function stripMarkup(wikitext: string): string {
  let t = wikitext;
  t = t.replace(/^==+[^=]+==+\s*/gm, '');
  // Origin/mention templates keep their term (last segment); other
  // templates (surf, IPA, audio...) are dropped entirely.
  t = t.replace(/\{\{(?:bor|der|inh|m)\|[^}]*\}\}/g, (match) => {
    const parts = match.slice(2, -2).split('|').map((s) => s.trim());
    const last = parts[parts.length - 1] ?? '';
    return last.includes('=') ? '' : last;
  });
  t = t.replace(/\{\{[^}]*\}\}/g, '');
  t = t.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1');
  t = t.replace(/\[\[([^\]]+)\]\]/g, '$1');
  t = t.replace(/'''?/g, '');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/^\s*\*\s*/gm, '');
  t = t.replace(/\s+/g, ' ').trim();
  // Tidy punctuation left behind by removed templates: "word . ." → "word."
  t = t.replace(/\s+([,.])/g, '$1').replace(/\.(\s*\.)+/g, '.');
  if (t.length > 600) {
    const cut = t.slice(0, 600);
    const lastSpace = cut.lastIndexOf(' ');
    t = (lastSpace > 400 ? cut.slice(0, lastSpace) : cut) + '…';
  }
  return t;
}

interface WiktionarySections {
  parse?: {
    sections?: { index: string; level: string; line: string }[];
    error?: { info?: string };
  };
}

interface WiktionaryWikitext {
  parse?: {
    /** formatversion=2 returns a plain string; older format returns {'*': string}. */
    wikitext?: string | { '*': string };
    error?: { info?: string };
  };
}

async function fetchLiveEtymology(word: string): Promise<VocabEtymology> {
  const base = 'https://en.wiktionary.org/w/api.php';
  const headers = { 'User-Agent': WIKTIONARY_UA };

  const secRes = await fetch(
    `${base}?action=parse&page=${encodeURIComponent(word)}&prop=sections&format=json&formatversion=2`,
    { headers, signal: AbortSignal.timeout(10000) }
  );
  if (!secRes.ok) return notFound();
  const secData = (await secRes.json()) as WiktionarySections;
  const sections = secData.parse?.sections ?? [];
  const section =
    sections.find((s) => s.line.toLowerCase() === 'etymology' && s.level === '3') ??
    sections.find((s) => s.line.toLowerCase().startsWith('etymology'));
  if (!section) return notFound();

  const textRes = await fetch(
    `${base}?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&section=${encodeURIComponent(section.index)}&format=json&formatversion=2`,
    { headers, signal: AbortSignal.timeout(10000) }
  );
  if (!textRes.ok) return notFound();
  const textData = (await textRes.json()) as WiktionaryWikitext;
  const rawWikitext = textData.parse?.wikitext;
  const wikitext = typeof rawWikitext === 'string' ? rawWikitext : (rawWikitext?.['*'] ?? '');
  if (!wikitext) return notFound();

  const chain = parseChain(wikitext);
  const text = stripMarkup(wikitext);
  if (chain.length === 0 && !text) return notFound();
  return { chain, text, source: 'wiktionary', found: true };
}

/**
 * GET /api/vocab/etymology?word=...
 * Origin chain + short etymology narrative from Wiktionary.
 * Cache-first (vocab_cache payload.etymology). No sign-in required.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = checkRateLimit(`vocab-etymology:${ip}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const raw = req.nextUrl.searchParams.get('word') ?? '';
  const word = raw.trim().toLowerCase();
  if (!word || word.length > 80 || !/^[a-z][a-z'’\-. ]*$/.test(word)) {
    return NextResponse.json({ error: 'Từ không hợp lệ.' }, { status: 400 });
  }

  const sql = getSql();
  if (sql) {
    try {
      await ensureVocabTables(sql);
      const rows = await sql`SELECT payload, fetched_at FROM vocab_cache WHERE word = ${word}`;
      if (rows.length > 0) {
        const payload = rows[0].payload as Record<string, unknown>;
        const cached = payload.etymology as VocabEtymology | undefined;
        const age = Date.now() - new Date(String(rows[0].fetched_at)).getTime();
        if (cached && (cached.found === true || age < NOT_FOUND_TTL_MS)) {
          return NextResponse.json(cached);
        }
      }
    } catch {
      /* cache unavailable — fall through to a live fetch */
    }
  }

  let etymology: VocabEtymology;
  try {
    etymology = await fetchLiveEtymology(word);
  } catch {
    return NextResponse.json(notFound());
  }

  if (sql) {
    try {
      // Merge with any cached definition so the two routes never clobber
      // each other's fields.
      const rows = await sql`SELECT payload FROM vocab_cache WHERE word = ${word}`;
      const existing = (rows[0]?.payload ?? {}) as Record<string, unknown>;
      const merged = { ...existing, etymology };
      await sql`INSERT INTO vocab_cache (word, payload) VALUES (${word}, ${JSON.stringify(merged)}::jsonb)
                ON CONFLICT (word) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()`;
    } catch {
      /* cache write failure must not fail the lookup */
    }
  }

  return NextResponse.json(etymology);
}
