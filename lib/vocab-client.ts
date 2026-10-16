// ---------------------------------------------------------------------------
// Client-side vocabulary helpers: localStorage (guest mode) + API calls.
// Signed-in users save to the server; guests (API answers 401) or offline
// users fall back to localStorage, using the exact same progress math
// (applyProgressUpdate) so the two paths can never drift apart.
// ---------------------------------------------------------------------------

import type { VocabDefinition, VocabEtymology, VocabLevel } from './vocab';
import {
  applyProgressUpdate,
  defaultStats,
  type VocabAnswerKind,
  type VocabProgressEntry,
  type VocabStats,
} from './vocab-gamification';

const PROGRESS_KEY = 'vstep_vocab_progress';
const STATS_KEY = 'vstep_vocab_stats';

export type VocabProgressMap = Record<string, VocabProgressEntry>;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full/blocked — progress just won't persist locally */
  }
}

export function loadLocalProgress(): VocabProgressMap {
  return readJson<VocabProgressMap>(PROGRESS_KEY, {});
}

export function saveLocalProgress(progress: VocabProgressMap): void {
  writeJson(PROGRESS_KEY, progress);
}

export function loadLocalStats(): VocabStats {
  const stored = readJson<Partial<VocabStats>>(STATS_KEY, {});
  return {
    ...defaultStats(),
    ...stored,
    framesUnlocked: stored.framesUnlocked ?? ['wood'],
    awardedStreakMilestones: stored.awardedStreakMilestones ?? [],
    awardedConquered: stored.awardedConquered ?? [],
  };
}

export function saveLocalStats(stats: VocabStats): void {
  writeJson(STATS_KEY, stats);
}

/** Local date 'YYYY-MM-DD' in the user's timezone. */
export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function fetchDefine(word: string): Promise<VocabDefinition> {
  const res = await fetch(`/api/vocab/define?word=${encodeURIComponent(word)}`);
  if (!res.ok) throw new Error('Không tải được nghĩa của từ.');
  return (await res.json()) as VocabDefinition;
}

/**
 * Resolve many words in ONE request (game decks). Returns a map keyed by
 * the lowercased word. Throws on HTTP/network failure — callers fall back
 * to per-word fetchDefine so one failed batch never breaks a game.
 */
export async function fetchDefineBatch(words: string[]): Promise<Map<string, VocabDefinition>> {
  const res = await fetch('/api/vocab/define', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words }),
  });
  if (!res.ok) throw new Error('Không tải được nghĩa của các từ.');
  const data = (await res.json()) as { results: Record<string, VocabDefinition> };
  return new Map(Object.entries(data.results ?? {}));
}

// ---------------------------------------------------------------------------
// Static definition packs (public/vocab-defs/{level}-{i}.json, built by
// scripts/build-vocab-packs.py). Decks used to resolve every word through
// POST /api/vocab/define at game time — cold words hit the flaky Dictionary
// API + Wiktionary fallback, so a 100-word wave took ~25s and multi-wave
// games multiplied that. Packs let the game shell build decks locally with
// zero API calls; the API remains as fallback for words missing from a pack.
// ---------------------------------------------------------------------------

/** Compact pack entry: d=definition, e=example, a=audio, p=phonetic, o=pos, s=synonyms, t=antonyms. */
export interface VocabPackEntry {
  d: string;
  e: string;
  a: string;
  p: string;
  o: string;
  s: string[];
  t: string[];
}

export type VocabPack = Map<string, VocabDefinition>;

const packPromises = new Map<string, Promise<VocabPack | null>>();

function packEntryToDefinition(word: string, e: VocabPackEntry): VocabDefinition {
  return {
    word,
    phonetic: e.p,
    audio: e.a,
    meanings: [
      {
        pos: e.o,
        definitions: [
          { definition: e.d, example: e.e, synonyms: e.s, antonyms: e.t },
        ],
      },
    ],
    synonyms: e.s,
    antonyms: e.t,
    found: true,
  };
}

/**
 * Load one level's static pack (index + chunks fetched in parallel, merged).
 * Memoized per level so a start-screen prefetch and the later startGame
 * share one load. Returns null when packs aren't deployed yet or a load
 * fails — callers fall back to the API batch path.
 */
export function loadVocabPack(level: VocabLevel): Promise<VocabPack | null> {
  const cached = packPromises.get(level);
  if (cached) return cached;
  const p = (async (): Promise<VocabPack | null> => {
    try {
      // Pack files are keyed by lowercase level (a1-0.json), while the game
      // uses uppercase (A1) — normalize or the index lookup misses and the
      // game silently falls back to the slow API path.
      const key = level.toLowerCase();
      const idxRes = await fetch('/vocab-defs/index.json');
      if (!idxRes.ok) return null;
      const index = (await idxRes.json()) as Record<string, number>;
      const count = index[key];
      if (!count || count <= 0) return null;
      const chunkResults = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          fetch(`/vocab-defs/${key}-${i}.json`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      );
      const map: VocabPack = new Map();
      for (const chunk of chunkResults) {
        const words = (chunk as { words?: Record<string, VocabPackEntry> } | null)?.words;
        if (!words) continue;
        for (const [w, entry] of Object.entries(words)) {
          if (entry?.d) map.set(w.toLowerCase(), packEntryToDefinition(w.toLowerCase(), entry));
        }
      }
      return map.size > 0 ? map : null;
    } catch {
      return null;
    }
  })();
  packPromises.set(level, p);
  return p;
}

export async function fetchEtymology(word: string): Promise<VocabEtymology> {
  const res = await fetch(`/api/vocab/etymology?word=${encodeURIComponent(word)}`);
  if (!res.ok) throw new Error('Không tải được gốc từ.');
  return (await res.json()) as VocabEtymology;
}

export interface SaveAnswerResult {
  xp: number;
  gained: number;
  leveledUp: boolean;
  newLevel: number;
  unlockedFrame: string | null;
  bonuses: { label: string; xp: number }[];
  /** True when the answer was saved locally (guest or offline). */
  local: boolean;
}

/**
 * Save one answer. Signed-in: POST to the server. Guest (401) or network
 * failure: update localStorage with the same math. Other HTTP errors throw.
 */
export async function saveAnswer(
  word: string,
  correct: boolean,
  kind: VocabAnswerKind,
  opts?: { perfect?: boolean; reviewCleared?: boolean; conqueredLevel?: VocabLevel | null }
): Promise<SaveAnswerResult> {
  const input = {
    word: word.trim().toLowerCase(),
    correct,
    kind,
    perfect: opts?.perfect,
    reviewCleared: opts?.reviewCleared,
    conqueredLevel: opts?.conqueredLevel ?? null,
  };
  let res: Response | null = null;
  try {
    res = await fetch('/api/vocab/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    res = null; // network failure → local fallback below
  }
  if (res?.ok) {
    const data = (await res.json()) as Omit<SaveAnswerResult, 'local'>;
    return { ...data, local: false };
  }
  if (res && res.status !== 401) {
    throw new Error('Không lưu được tiến độ. Thử lại sau.');
  }

  // Guest / offline path: same math, localStorage only.
  const stats = loadLocalStats();
  const progress = loadLocalProgress();
  const result = applyProgressUpdate(stats, progress[input.word] ?? null, {
    ...input,
    today: localToday(),
  });
  progress[input.word] = result.entry;
  saveLocalProgress(progress);
  saveLocalStats(result.stats);
  return {
    xp: result.stats.xp,
    gained: result.gained,
    leveledUp: result.leveledUp,
    newLevel: result.newLevel,
    unlockedFrame: result.unlockedFrame,
    bonuses: result.bonuses,
    local: true,
  };
}

/**
 * Load server progress + stats for a signed-in user.
 * Returns null on 401 (guest) or network failure.
 */
export async function fetchServerState(): Promise<{
  progress: VocabProgressMap;
  stats: VocabStats;
} | null> {
  try {
    const res = await fetch('/api/vocab/progress');
    if (!res.ok) return null;
    return (await res.json()) as { progress: VocabProgressMap; stats: VocabStats };
  } catch {
    return null;
  }
}
