'use client';

// Vocab game 5 — Matching: click a word, then its meaning. Rounds of 6 pairs.
// Click-to-select (no drag) so it works on mobile. Count-up timer.

import { useEffect, useMemo, useState } from 'react';

export interface MatchingItem {
  word: string;
  meaning: string;
}

interface VocabMatchingProps {
  words: MatchingItem[];
  onAnswer: (word: string, correct: boolean) => void;
  onFinish: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function truncate(s: string, max = 60): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default function VocabMatching({ words, onAnswer, onFinish }: VocabMatchingProps) {
  const totalRounds = Math.max(1, Math.ceil(words.length / 6));
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ word: string; meaning: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [feedback, setFeedback] = useState('');

  const roundItems = useMemo(() => words.slice(round * 6, round * 6 + 6), [words, round]);
  const [shuffledMeanings, setShuffledMeanings] = useState<string[]>(() =>
    shuffle(roundItems.map((i) => i.meaning)),
  );

  // Reshuffle the meaning column when the round changes.
  useEffect(() => {
    setShuffledMeanings(shuffle(words.slice(round * 6, round * 6 + 6).map((i) => i.meaning)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Count-up timer.
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Clear the wrong-pair flash after a moment.
  useEffect(() => {
    if (!wrongPair) return;
    const id = setTimeout(() => setWrongPair(null), 650);
    return () => clearTimeout(id);
  }, [wrongPair]);

  const mm = String(Math.floor(elapsed / 60)).padStart(1, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const clickWord = (word: string) => {
    if (matched.has(word)) return;
    setSelected(word);
  };

  const clickMeaning = (meaning: string) => {
    if (selected === null) return;
    const owner = roundItems.find((i) => i.meaning === meaning);
    if (!owner) return;
    if (owner.word === selected) {
      const nextMatched = new Set(matched);
      nextMatched.add(selected);
      setMatched(nextMatched);
      setSelected(null);
      setFeedback(`Đúng! “${selected}” — ${truncate(owner.meaning)}`);
      onAnswer(selected, true);
      if (nextMatched.size >= roundItems.length) {
        if (round + 1 >= totalRounds) {
          onFinish();
        } else {
          setRound(round + 1);
          setMatched(new Set());
          setFeedback('');
        }
      }
    } else {
      setWrongPair({ word: selected, meaning });
      setMistakes((m) => m + 1);
      setFeedback(`Chưa đúng — “${selected}” không khớp với nghĩa đó. Thử lại.`);
      onAnswer(selected, false);
      setSelected(null);
    }
  };

  if (words.length === 0) return <p>Không có cặp nào để nối.</p>;

  return (
    <div>
      <p aria-live="polite" style={{ minHeight: '1.4em', fontSize: '0.88rem', color: 'var(--muted)' }}>
        {feedback}
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
        Lượt {round + 1}/{totalRounds} · Đã nối {matched.size}/{roundItems.length} · Lỗi: {mistakes} ·
        Đã dùng: {mm}:{ss}
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '6px 0 14px' }}>
        Bấm 1 từ bên trái (Tab + Enter cũng được), rồi bấm nghĩa đúng bên phải.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {roundItems.map((item) => {
            const isMatched = matched.has(item.word);
            const isSelected = selected === item.word;
            const isWrong = wrongPair?.word === item.word;
            return (
              <button
                key={item.word}
                type="button"
                className={`opt-card${isMatched ? ' correct' : ''}${isWrong ? ' wrong-pick vocab-shake' : ''}${
                  isSelected ? ' selected' : ''
                }`}
                disabled={isMatched}
                onClick={() => clickWord(item.word)}
                aria-pressed={isSelected}
                aria-label={`Từ: ${item.word}`}
                style={{ minHeight: 44, fontSize: '0.88rem' }}
              >
                <span>{item.word}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {shuffledMeanings.map((meaning) => {
            const owner = roundItems.find((i) => i.meaning === meaning);
            const isMatched = owner ? matched.has(owner.word) : false;
            const isWrong = wrongPair?.meaning === meaning;
            return (
              <button
                key={meaning}
                type="button"
                className={`opt-card${isMatched ? ' correct' : ''}${isWrong ? ' wrong-pick vocab-shake' : ''}`}
                disabled={isMatched}
                onClick={() => clickMeaning(meaning)}
                aria-label={`Nghĩa: ${meaning}`}
                style={{ minHeight: 44, fontSize: '0.82rem' }}
              >
                <span>{truncate(meaning)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <style jsx>{`
        @keyframes vocab-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-3px);
          }
          75% {
            transform: translateX(3px);
          }
        }
        .vocab-shake {
          animation: vocab-shake 0.18s ease 2;
        }
      `}</style>
    </div>
  );
}
