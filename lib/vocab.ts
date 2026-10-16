// ---------------------------------------------------------------------------
// Vocabulary word lists + lookup types.
// Words come from the Kaggle CEFR-labelled dataset (cleaned): 8,842 unique
// words split by CEFR level. Definitions/etymology are NOT bundled — they
// are fetched on demand from the Dictionary API / Wiktionary and cached.
// ---------------------------------------------------------------------------

import a1Words from './vocab/words-a1.json';
import a2Words from './vocab/words-a2.json';
import b1Words from './vocab/words-b1.json';
import b2Words from './vocab/words-b2.json';
import c1Words from './vocab/words-c1.json';

export type VocabLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export const VOCAB_LEVELS: VocabLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export const VOCAB_COUNTS: Record<VocabLevel, number> = {
  A1: 1081,
  A2: 1272,
  B1: 2174,
  B2: 2490,
  C1: 1825,
};

const WORDS_BY_LEVEL: Record<VocabLevel, string[]> = {
  A1: a1Words,
  A2: a2Words,
  B1: b1Words,
  B2: b2Words,
  C1: c1Words,
};

/** All words of a level, in alphabetical order (as stored in the JSON). */
export function getVocabWords(level: VocabLevel): string[] {
  return WORDS_BY_LEVEL[level];
}

let levelByWord: Map<string, VocabLevel> | null = null;

function getLevelByWord(): Map<string, VocabLevel> {
  if (!levelByWord) {
    levelByWord = new Map();
    for (const level of VOCAB_LEVELS) {
      for (const word of WORDS_BY_LEVEL[level]) {
        if (!levelByWord.has(word)) levelByWord.set(word, level);
      }
    }
  }
  return levelByWord;
}

/** CEFR level of a word, or null when the word is not in the lists. */
export function getVocabLevel(word: string): VocabLevel | null {
  return getLevelByWord().get(word.trim().toLowerCase()) ?? null;
}

/**
 * Search words: prefix matches first (alphabetical within each group),
 * then substring matches. Case-insensitive.
 */
export function searchVocab(q: string, limit = 20): { word: string; level: VocabLevel }[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const prefix: { word: string; level: VocabLevel }[] = [];
  const contains: { word: string; level: VocabLevel }[] = [];
  for (const level of VOCAB_LEVELS) {
    for (const word of WORDS_BY_LEVEL[level]) {
      if (word.startsWith(query)) prefix.push({ word, level });
      else if (word.includes(query)) contains.push({ word, level });
    }
  }
  return [...prefix, ...contains].slice(0, Math.max(0, limit));
}

/** `n` random words from a level, excluding `exclude`. Fisher-Yates shuffle. */
export function randomVocabWords(level: VocabLevel, n: number, exclude: Set<string>): string[] {
  const pool = WORDS_BY_LEVEL[level].filter((w) => !exclude.has(w));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, n));
}

// --- Lookup payloads (served by /api/vocab/define and /api/vocab/etymology) ---

export interface VocabDefinition {
  word: string;
  phonetic: string;
  audio: string;
  meanings: {
    pos: string;
    definitions: {
      definition: string;
      example: string;
      synonyms: string[];
      antonyms: string[];
    }[];
  }[];
  synonyms: string[];
  antonyms: string[];
  found: boolean;
}

export interface VocabEtymology {
  chain: { lang: string; term: string }[];
  text: string;
  source: 'wiktionary';
  found: boolean;
}
