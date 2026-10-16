'use client';

// Vocab game shell: /tu-vung/choi?game=&level=&review=
// Builds the deck per game (all data fetching lives here), owns the score,
// saves every answer via saveAnswer, and renders the result screen.

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { VocabDefinition, VocabLevel } from '@/lib/vocab';
import { VOCAB_COUNTS, VOCAB_LEVELS, getVocabWords, randomVocabWords } from '@/lib/vocab';
import { fetchDefine, fetchDefineBatch, loadLocalProgress, loadVocabPack, saveAnswer } from '@/lib/vocab-client';
import type { VocabPack } from '@/lib/vocab-client';
import type { VocabAnswerKind, VocabProgressEntry } from '@/lib/vocab-gamification';
import VocabFlashcards, { type FlashcardItem } from '@/components/games/VocabFlashcards';
import VocabMeaningQuiz, { type MeaningRound } from '@/components/games/VocabMeaningQuiz';
import VocabListeningQuiz, { type ListeningRound } from '@/components/games/VocabListeningQuiz';
import VocabFillBlank, { type FillRound } from '@/components/games/VocabFillBlank';
import VocabMatching, { type MatchingItem } from '@/components/games/VocabMatching';
import VocabSynAntQuiz, { type SynAntRound } from '@/components/games/VocabSynAntQuiz';
import VocabGameCards from '@/components/games/VocabGameCards';

type GameId = 'flashcards' | 'meaning' | 'listening' | 'fill' | 'matching' | 'synant';

const GAMES: Record<GameId, { title: string; howto: string }> = {
  flashcards: { title: 'Thẻ ghi nhớ', howto: 'Bấm để lật thẻ, vuốt phải nếu đã nhớ, vuốt trái nếu chưa nhớ.' },
  meaning: { title: 'Chọn nghĩa đúng', howto: 'Đọc từ, chọn nghĩa đúng trong 4 đáp án.' },
  listening: { title: 'Nghe → chọn từ', howto: 'Nghe phát âm, chọn từ bạn nghe được.' },
  fill: { title: 'Điền từ vào câu', howto: 'Điền từ còn thiếu vào câu ví dụ.' },
  matching: { title: 'Nối từ – nghĩa', howto: 'Nối mỗi từ với nghĩa đúng của nó.' },
  synant: { title: 'Đồng nghĩa – Trái nghĩa', howto: 'Chọn từ đồng nghĩa hoặc trái nghĩa theo yêu cầu.' },
};

const POINTS: Record<GameId, number> = {
  flashcards: 5,
  matching: 5,
  meaning: 10,
  listening: 10,
  fill: 10,
  synant: 10,
};

// Game ids used in the URL vs the answer kinds Agent A defined.
const KIND_TO_ANSWER: Record<GameId, VocabAnswerKind> = {
  flashcards: 'flashcard',
  meaning: 'quiz',
  listening: 'listening',
  fill: 'fill',
  matching: 'matching',
  synant: 'synant',
};

type Deck =
  | { kind: 'flashcards'; items: FlashcardItem[] }
  | { kind: 'meaning'; items: MeaningRound[] }
  | { kind: 'listening'; items: ListeningRound[] }
  | { kind: 'fill'; items: FillRound[] }
  | { kind: 'matching'; items: MatchingItem[] }
  | { kind: 'synant'; items: SynAntRound[] };

type Phase = 'loading' | 'playing' | 'result' | 'insufficient' | 'error';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** fetchDefine throws on HTTP errors — deck building must survive one bad word. */
async function safeDefine(word: string): Promise<VocabDefinition | null> {
  try {
    return await fetchDefine(word);
  } catch {
    return null;
  }
}

/**
 * Resolve one wave of candidates. With a static pack, words in the pack
 * resolve locally (instant); only words missing from the pack go to the API.
 * Without a pack, one batch request per wave (API fallback).
 */
async function fetchWave(
  words: string[],
  pack: VocabPack | null,
): Promise<[string, VocabDefinition | null][]> {
  if (pack) {
    const missing = words.filter((w) => !pack.has(w.toLowerCase()));
    const api = new Map<string, VocabDefinition>();
    if (missing.length > 0) {
      try {
        const batch = await fetchDefineBatch(missing);
        batch.forEach((v, k) => api.set(k, v));
      } catch {
        for (const w of missing) {
          const d = await safeDefine(w);
          if (d) api.set(w.toLowerCase(), d);
        }
      }
    }
    return words.map(
      (w) => [w, pack.get(w.toLowerCase()) ?? api.get(w.toLowerCase()) ?? null] as [string, VocabDefinition | null],
    );
  }
  try {
    const batch = await fetchDefineBatch(words);
    return words.map((w) => [w, batch.get(w.toLowerCase()) ?? null]);
  } catch {
    const out: [string, VocabDefinition | null][] = [];
    for (const w of words) out.push([w, await safeDefine(w)]);
    return out;
  }
}

function getProgress(): Record<string, VocabProgressEntry> {
  try {
    return (loadLocalProgress() as Record<string, VocabProgressEntry>) ?? {};
  } catch {
    return {};
  }
}

function getReviewQueue(progress: Record<string, VocabProgressEntry>): string[] {
  return Object.entries(progress)
    .filter(([, p]) => p && (p.status === 'learning' || (p.wrong ?? 0) > 0))
    .map(([w]) => w);
}

function hasDefinition(def: VocabDefinition | null | undefined): def is VocabDefinition {
  return !!def && def.found !== false && def.meanings.some((m) => m.definitions.length > 0);
}

function firstDefinitionText(def: VocabDefinition): string {
  return def.meanings[0]?.definitions[0]?.definition ?? '';
}

function firstExample(def: VocabDefinition): string {
  for (const m of def.meanings) {
    for (const d of m.definitions) {
      if (d.example) return d.example;
    }
  }
  return '';
}

function pickCandidates(
  level: VocabLevel,
  progress: Record<string, VocabProgressEntry>,
  allowed?: Set<string>,
): string[] {
  const priority: string[] = [];
  const rest: string[] = [];
  for (const w of getVocabWords(level)) {
    if (allowed && !allowed.has(w)) continue;
    const p = progress[w];
    if (p && (p.status === 'learning' || (p.wrong ?? 0) > 0)) priority.push(w);
    else rest.push(w);
  }
  return [...shuffle(priority), ...shuffle(rest)];
}

function deckWordCount(deck: Deck): number {
  return deck.items.length;
}

async function buildDeck(
  game: GameId,
  level: VocabLevel,
  review: boolean,
  customWords: string[] | undefined,
  progress: Record<string, VocabProgressEntry>,
  count: number,
  pack: VocabPack | null,
): Promise<Deck | 'insufficient' | null> {
  const reviewQueue = getReviewQueue(progress);
  const candidates = customWords
    ? shuffle(customWords)
    : review
      ? shuffle(reviewQueue)
      : pickCandidates(level, progress, pack ? new Set(pack.keys()) : undefined);
  // "Ôn từ sai" chơi toàn bộ từ sai được truyền vào, không cắt theo count.
  const target = customWords ? customWords.length : count;

  if (game === 'flashcards') {
    const items: FlashcardItem[] = [];
    let idx = 0;
    while (items.length < target && idx < candidates.length) {
      const wave = candidates.slice(idx, idx + Math.min((target - items.length) * 2, 100));
      idx += wave.length;
      for (const [w, def] of await fetchWave(wave, pack)) {
        if (items.length >= target) break;
        if (hasDefinition(def)) items.push({ word: w, definition: def });
      }
    }
    return items.length > 0 ? { kind: 'flashcards', items } : null;
  }

  if (game === 'meaning') {
    const prompts: { word: string; def: VocabDefinition }[] = [];
    let idx = 0;
    while (prompts.length < target && idx < candidates.length) {
      const wave = candidates.slice(idx, idx + Math.min((target - prompts.length) * 2, 100));
      idx += wave.length;
      for (const [w, def] of await fetchWave(wave, pack)) {
        if (prompts.length >= target) break;
        if (hasDefinition(def)) prompts.push({ word: w, def });
      }
    }
    if (prompts.length === 0) return null;
    // Distractor meanings: with a pack, sample from pack keys so this needs
    // zero API calls; without a pack, random level words resolved via API.
    const poolWords = pack
      ? shuffle(Array.from(pack.keys()).filter((w) => !prompts.some((p) => p.word === w))).slice(0, 20)
      : randomVocabWords(
          level,
          20,
          new Set(prompts.map((p) => p.word)),
        );
    const poolMeanings: string[] = [];
    for (const [, def] of await fetchWave(poolWords, pack)) {
      if (hasDefinition(def)) {
        const text = firstDefinitionText(def);
        if (text && !poolMeanings.includes(text)) poolMeanings.push(text);
      }
    }
    const items: MeaningRound[] = [];
    for (const { word, def } of prompts) {
      const correct = firstDefinitionText(def);
      if (!correct) continue;
      const distractors = shuffle(poolMeanings.filter((m) => m !== correct)).slice(0, 3);
      if (distractors.length < 3) continue;
      const options = shuffle([correct, ...distractors]);
      items.push({ word, options, correctIndex: options.indexOf(correct) });
    }
    return items.length > 0 ? { kind: 'meaning', items } : null;
  }

  if (game === 'listening') {
    const items: ListeningRound[] = [];
    const pool = candidates.filter((x) => !x.includes(' '));
    let idx = 0;
    while (items.length < target && idx < pool.length) {
      const wave = pool.slice(idx, idx + Math.min((target - items.length) * 2, 100));
      idx += wave.length;
      for (const [w, def] of await fetchWave(wave, pack)) {
        if (items.length >= target) break;
        if (!def || !def.audio) continue;
        const distractors = shuffle(
          randomVocabWords(level, 8, new Set([w])).filter((x) => !x.includes(' ') && x !== w),
        ).slice(0, 3);
        if (distractors.length < 3) continue;
        items.push({ word: w, audio: def.audio, options: shuffle([w, ...distractors]) });
      }
    }
    return items.length > 0 ? { kind: 'listening', items } : null;
  }

  if (game === 'fill') {
    const items: FillRound[] = [];
    let idx = 0;
    while (items.length < target && idx < candidates.length) {
      const wave = candidates.slice(idx, idx + Math.min((target - items.length) * 2, 100));
      idx += wave.length;
      for (const [w, def] of await fetchWave(wave, pack)) {
        if (items.length >= target) break;
        if (!hasDefinition(def)) continue;
        const example = firstExample(def);
        if (!example) continue;
        const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, 'gi');
        if (!re.test(example)) continue;
        items.push({
          word: w,
          sentence: example.replace(new RegExp(`\\b${escapeRegExp(w)}\\b`, 'gi'), '______'),
          completed: example,
        });
      }
    }
    return items.length > 0 ? { kind: 'fill', items } : null;
  }

  if (game === 'matching') {
    const items: MatchingItem[] = [];
    let idx = 0;
    while (items.length < target && idx < candidates.length) {
      const wave = candidates.slice(idx, idx + Math.min((target - items.length) * 2, 100));
      idx += wave.length;
      for (const [w, def] of await fetchWave(wave, pack)) {
        if (items.length >= target) break;
        if (!hasDefinition(def)) continue;
        const text = firstDefinitionText(def);
        if (text) items.push({ word: w, meaning: text });
      }
    }
    return items.length >= 6 ? { kind: 'matching', items } : null;
  }

  // synant
  const usable: { word: string; syns: string[]; ants: string[] }[] = [];
  let idx = 0;
  while (usable.length < target && idx < candidates.length) {
    const wave = candidates.slice(idx, idx + Math.min((target - usable.length) * 2, 100));
    idx += wave.length;
    for (const [w, def] of await fetchWave(wave, pack)) {
      if (!def) continue;
      const syns = Array.from(new Set(def.synonyms ?? [])).filter(Boolean);
      const ants = Array.from(new Set(def.antonyms ?? [])).filter(Boolean);
      if (syns.length > 0 || ants.length > 0) usable.push({ word: w, syns, ants });
    }
  }
  const items: SynAntRound[] = [];
  for (let i = 0; i < target; i++) {
    const mode: 'syn' | 'ant' = i % 2 === 0 ? 'syn' : 'ant';
    const entry = usable.find((u) => (mode === 'syn' ? u.syns.length > 0 : u.ants.length > 0));
    if (!entry) continue;
    usable.splice(usable.indexOf(entry), 1);
    const correct = (mode === 'syn' ? entry.syns : entry.ants)[0];
    const known = new Set([...entry.syns, ...entry.ants, entry.word]);
    const distractors = shuffle(
      randomVocabWords(level, 8, new Set([entry.word])).filter(
        (x) => !known.has(x) && x !== correct,
      ),
    ).slice(0, 3);
    if (distractors.length < 3) continue;
    const options = shuffle([correct, ...distractors]);
    items.push({ word: entry.word, mode, options, correctIndex: options.indexOf(correct) });
  }
  if (items.length < 5) return 'insufficient';
  return { kind: 'synant', items };
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function VocabGameInner() {
  const searchParams = useSearchParams();
  const rawGame = searchParams.get('game') ?? 'flashcards';
  const urlGame: GameId = rawGame in GAMES ? (rawGame as GameId) : 'flashcards';
  const rawLevel = searchParams.get('level') ?? 'A1';
  const urlLevel: VocabLevel = (VOCAB_LEVELS as readonly string[]).includes(rawLevel)
    ? (rawLevel as VocabLevel)
    : 'A1';
  const rawCount = Number(searchParams.get('count'));
  const WORD_COUNTS = [10, 20, 30, 50] as const;
  const urlCount = WORD_COUNTS.includes(rawCount as (typeof WORD_COUNTS)[number])
    ? rawCount
    : 10;
  const reviewMode = searchParams.get('review') === '1';

  const [progress, setProgress] = useState<Record<string, VocabProgressEntry>>({});
  const [phase, setPhase] = useState<Phase>('loading');
  const [deck, setDeck] = useState<Deck | null>(null);
  const [session, setSession] = useState<{ game: GameId; level: VocabLevel; review: boolean }>({
    game: urlGame,
    level: urlLevel,
    review: reviewMode,
  });
  const [lastStart, setLastStart] = useState<{ game: GameId; words?: string[] } | undefined>(
    undefined,
  );
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [wrongWords, setWrongWords] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');

  const startTimeRef = useRef(0);
  const reviewTotalRef = useRef(0);
  const wrongAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setProgress(getProgress());
  }, []);

  // Bấm vào game là bắt đầu ngay — không còn màn hình chờ + nút Bắt đầu.
  // Guard theo bộ tham số để không build deck 2 lần khi effect chạy lại.
  const startedKeyRef = useRef('');
  useEffect(() => {
    const key = `${urlGame}|${urlLevel}|${urlCount}|${reviewMode}`;
    if (startedKeyRef.current === key) return;
    startedKeyRef.current = key;
    void startGame();
    // startGame đọc các tham số URL hiện tại — chạy lại khi chúng đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlGame, urlLevel, urlCount, reviewMode]);

  const startGame = async (override?: { game: GameId; words?: string[] }) => {
    const game = override?.game ?? urlGame;
    const useReview = override ? false : reviewMode;
    setPhase('loading');
    setError('');
    setScore(0);
    setCorrectCount(0);
    setFirstTry(0);
    setAnswered(0);
    setWrongWords([]);
    wrongAttemptedRef.current = new Set();
    setSession({ game, level: urlLevel, review: useReview });
    setLastStart(override ?? undefined);
    const fresh = getProgress();
    const queue = getReviewQueue(fresh);
    reviewTotalRef.current = queue.length;
    if (useReview && queue.length === 0) {
      setPhase('error');
      setError('Hàng đợi ôn đang trống — chơi một ván bất kỳ để bắt đầu.');
      return;
    }
    const built = await buildDeck(
      game,
      urlLevel,
      useReview,
      override?.words,
      fresh,
      urlCount,
      await loadVocabPack(urlLevel).catch(() => null),
    );
    if (built === 'insufficient') {
      setPhase('insufficient');
      return;
    }
    if (!built || deckWordCount(built) === 0) {
      setPhase('error');
      setError('Không tạo được ván chơi — thử lại hoặc chọn cấp độ khác.');
      return;
    }
    setDeck(built);
    startTimeRef.current = Date.now();
    setPhase('playing');
  };

  const handleAnswer = (word: string, correct: boolean, kind: GameId) => {
    const total = deck ? deckWordCount(deck) : 0;
    const isMatching = kind === 'matching';
    const newCorrect = correctCount + (correct ? 1 : 0);
    const firstTryNow = correct && !wrongAttemptedRef.current.has(word);
    if (!correct) wrongAttemptedRef.current.add(word);

    let perfect = false;
    if (kind !== 'flashcards' && total > 0) {
      if (isMatching) {
        perfect = correct && newCorrect === total && wrongAttemptedRef.current.size === 0;
      } else {
        perfect = correct && newCorrect === total;
      }
    }
    // Review cleared: review session, last answer, no wrong answers at all,
    // and the deck covered the whole review queue present at start.
    let reviewCleared = false;
    if (session.review && total > 0) {
      const isLast = isMatching
        ? correct && newCorrect === total
        : answered + 1 === total;
      const noWrong = correct ? wrongWords.length === 0 : false;
      reviewCleared = isLast && noWrong && reviewTotalRef.current <= total;
    }

    // saveAnswer is fire-and-forget here: a failed save must never break
    // gameplay (guest fallback already covers the 401 case inside it).
    const answerKind = KIND_TO_ANSWER[kind];
    if (perfect || reviewCleared) {
      void saveAnswer(word, correct, answerKind, { perfect, reviewCleared }).catch(() => {});
    } else {
      void saveAnswer(word, correct, answerKind).catch(() => {});
    }

    if (correct) {
      setScore((s) => s + POINTS[kind]);
      setCorrectCount(newCorrect);
      if (firstTryNow) setFirstTry((f) => f + 1);
    } else {
      setWrongWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
    }
    setAnswered((a) => a + 1);
  };

  const handleFinish = () => {
    setElapsed((Date.now() - startTimeRef.current) / 1000);
    setPhase('result');
    setProgress(getProgress());
  };

  const activeGame = deck ? (deck.kind as GameId) : session.game;
  const total = deck ? deckWordCount(deck) : 0;
  const accuracy = total > 0 ? Math.round((firstTry / total) * 100) : 0;

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/tu-vung" className="back">
          ← Từ vựng
        </Link>
      </div>
      <p className="page-eyebrow">Từ vựng — Trò chơi</p>
      <h1 className="page-title">{GAMES[activeGame].title}</h1>
      <p className="page-sub">{GAMES[activeGame].howto}</p>

      {phase === 'loading' && <p style={{ marginTop: 18 }}>Đang chuẩn bị ván chơi…</p>}

      {phase === 'playing' && deck && (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <strong>{GAMES[deck.kind as GameId].title}</strong>
            <span aria-live="polite">Điểm: {score}</span>
            <Link href="/tu-vung" className="btn sm">
              Thoát
            </Link>
          </div>
          {deck.kind === 'flashcards' && (
            <VocabFlashcards
              words={deck.items}
              onAnswer={(w, c) => handleAnswer(w, c, 'flashcards')}
              onFinish={handleFinish}
            />
          )}
          {deck.kind === 'meaning' && (
            <VocabMeaningQuiz
              words={deck.items}
              onAnswer={(w, c) => handleAnswer(w, c, 'meaning')}
              onFinish={handleFinish}
            />
          )}
          {deck.kind === 'listening' && (
            <VocabListeningQuiz
              words={deck.items}
              onAnswer={(w, c) => handleAnswer(w, c, 'listening')}
              onFinish={handleFinish}
            />
          )}
          {deck.kind === 'fill' && (
            <VocabFillBlank
              words={deck.items}
              onAnswer={(w, c) => handleAnswer(w, c, 'fill')}
              onFinish={handleFinish}
            />
          )}
          {deck.kind === 'matching' && (
            <VocabMatching
              words={deck.items}
              onAnswer={(w, c) => handleAnswer(w, c, 'matching')}
              onFinish={handleFinish}
            />
          )}
          {deck.kind === 'synant' && (
            <VocabSynAntQuiz
              words={deck.items}
              onAnswer={(w, c) => handleAnswer(w, c, 'synant')}
              onFinish={handleFinish}
            />
          )}
        </div>
      )}

      {phase === 'result' && (
        <div className="card" style={{ marginTop: 18 }}>
          <h2 className="section-title">Hoàn thành!</h2>
          <p>
            Điểm: <strong>{score}</strong> · Đúng: <strong>{firstTry}/{total}</strong> · Độ chính
            xác: <strong>{accuracy}%</strong> · Thời gian: <strong>{formatTime(elapsed)}</strong>
          </p>
          {wrongWords.length > 0 ? (
            <>
              <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Từ sai — bấm để xem chi tiết:</p>
              <ul style={{ lineHeight: 2 }}>
                {wrongWords.map((w) => (
                  <li key={w}>
                    <Link href={`/tu-vung/tu/${encodeURIComponent(w)}`}>{w}</Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Không có từ sai — tuyệt vời!</p>
          )}
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="button" className="btn primary" onClick={() => void startGame(lastStart)}>
              Chơi lại
            </button>
            {wrongWords.length > 0 && (
              <button
                type="button"
                className="btn"
                onClick={() => void startGame({ game: 'flashcards', words: wrongWords })}
              >
                Ôn từ sai
              </button>
            )}
            <Link href="/tu-vung" className="btn">
              Về hub
            </Link>
          </div>
          {/* Ván tiếp theo: bấm là chơi ngay (không nút Bắt đầu). */}
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '22px 0 8px' }}>
            Đổi cấp độ:
          </p>
          <div className="btn-row" role="group" aria-label="Chọn cấp độ">
            {(VOCAB_LEVELS as readonly VocabLevel[]).map((lv) => (
              <Link
                key={lv}
                href={`/tu-vung/choi?game=${activeGame}&level=${lv}&count=${urlCount}`}
                className={`btn${lv === urlLevel ? ' primary' : ''}`}
                aria-pressed={lv === urlLevel}
              >
                {lv} · {VOCAB_COUNTS[lv]} từ
              </Link>
            ))}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '14px 0 8px' }}>
            Đổi số từ mỗi ván:
          </p>
          <div className="btn-row" role="group" aria-label="Chọn số từ">
            {WORD_COUNTS.map((n) => (
              <Link
                key={n}
                href={`/tu-vung/choi?game=${activeGame}&level=${urlLevel}&count=${n}`}
                className={`btn${n === urlCount ? ' primary' : ''}`}
                aria-pressed={n === urlCount}
              >
                {n} từ
              </Link>
            ))}
          </div>
          <VocabGameCards
            level={urlLevel}
            count={urlCount}
            review={false}
            currentGame={activeGame}
            heading="Đổi game"
          />
        </div>
      )}

      {phase === 'insufficient' && (
        <div className="card" style={{ marginTop: 18 }}>
          <p>Cấp độ này chưa đủ dữ liệu đồng/trái nghĩa, thử cấp độ khác hoặc game khác.</p>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <Link href="/tu-vung" className="btn primary">
              Về hub
            </Link>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="card" style={{ marginTop: 18 }}>
          <p style={{ color: 'var(--wrong)' }}>{error || 'Đã có lỗi xảy ra.'}</p>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button type="button" className="btn primary" onClick={() => void startGame(lastStart)}>
              Thử lại
            </button>
            <Link href="/tu-vung" className="btn">
              Về hub
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

export default function VocabGamePage() {
  return (
    <Suspense fallback={<main className="page"><p>Đang tải…</p></main>}>
      <VocabGameInner />
    </Suspense>
  );
}
