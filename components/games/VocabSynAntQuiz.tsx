'use client';

// Vocab game 6 — Synonym / Antonym: alternating rounds pick the synonym
// (odd rounds) or antonym (even rounds) of the prompt word.

import { useEffect, useState } from 'react';

export interface SynAntRound {
  word: string;
  mode: 'syn' | 'ant';
  options: string[];
  correctIndex: number;
}

interface VocabSynAntQuizProps {
  words: SynAntRound[];
  onAnswer: (word: string, correct: boolean) => void;
  onFinish: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export default function VocabSynAntQuiz({ words, onAnswer, onFinish }: VocabSynAntQuizProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');

  const round = words[index];

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === round.correctIndex;
    onAnswer(round.word, correct);
    setFeedback(
      correct
        ? 'Đúng!'
        : `Sai. Đáp án đúng là: ${round.options[round.correctIndex]}`,
    );
  };

  const next = () => {
    if (index + 1 >= words.length) {
      onFinish();
    } else {
      setIndex(index + 1);
      setPicked(null);
      setFeedback('');
    }
  };

  // Keys 1–4 pick an answer; Enter advances after answering.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (picked === null) {
        const n = Number(e.key);
        if (n >= 1 && n <= round.options.length) pick(n - 1);
      } else if (e.key === 'Enter') {
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, index, words]);

  if (!round) return <p>Không có câu hỏi nào.</p>;

  const isSyn = round.mode === 'syn';
  const modeLabel = isSyn ? 'ĐỒNG NGHĨA' : 'TRÁI NGHĨA';
  const modeColor = isSyn ? 'var(--correct)' : 'var(--wrong)';

  return (
    <div>
      <p aria-live="polite" style={{ minHeight: '1.4em', fontSize: '0.88rem', color: 'var(--muted)' }}>
        {feedback}
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
        Câu {index + 1}/{words.length}
      </p>
      <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: '8px 0 4px' }}>
        Chọn từ <span style={{ color: modeColor }}>{modeLabel}</span> với “{round.word}”
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 16px' }}>
        {isSyn
          ? 'Từ đồng nghĩa = nghĩa giống hoặc gần giống.'
          : 'Từ trái nghĩa = nghĩa ngược lại.'}
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {round.options.map((opt, i) => {
          const isCorrect = picked !== null && i === round.correctIndex;
          const isWrongPick = picked === i && i !== round.correctIndex;
          const cls = `opt-card${isCorrect ? ' correct' : ''}${isWrongPick ? ' wrong-pick' : ''}`;
          return (
            <button
              key={opt}
              type="button"
              className={cls}
              disabled={picked !== null}
              onClick={() => pick(i)}
              aria-label={`Đáp án ${LETTERS[i]}: ${opt}`}
              style={{ minHeight: 44 }}
            >
              <span className="letter">{LETTERS[i]}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button type="button" className="btn primary" onClick={next}>
            {index + 1 >= words.length ? 'Xem kết quả' : 'Câu tiếp theo (Enter)'}
          </button>
        </div>
      )}
    </div>
  );
}
