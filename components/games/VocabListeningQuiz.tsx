'use client';

// Vocab game 3 — Listening: hear the pronunciation, pick the word.

import { useEffect, useState } from 'react';

export interface ListeningRound {
  word: string;
  audio: string;
  options: string[];
}

interface VocabListeningQuizProps {
  words: ListeningRound[];
  onAnswer: (word: string, correct: boolean) => void;
  onFinish: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export default function VocabListeningQuiz({ words, onAnswer, onFinish }: VocabListeningQuizProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const round = words[index];

  const playAudio = () => {
    if (!round?.audio) return;
    const audio = new Audio(round.audio);
    void audio.play().catch(() => {});
  };

  // Auto-play when the round changes (browsers may block it until the
  // user interacts — the replay button always works).
  useEffect(() => {
    if (round?.audio) {
      const audio = new Audio(round.audio);
      void audio.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const pick = (w: string) => {
    if (picked !== null) return;
    setPicked(w);
    const correct = w === round.word;
    onAnswer(round.word, correct);
    setFeedback(correct ? 'Đúng!' : `Sai. Từ đúng là: ${round.word}`);
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
        if (n >= 1 && n <= round.options.length) pick(round.options[n - 1]);
      } else if (e.key === 'Enter') {
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, index, words]);

  if (!round) return <p>Không có câu hỏi nào.</p>;

  return (
    <div>
      <p aria-live="polite" style={{ minHeight: '1.4em', fontSize: '0.88rem', color: 'var(--muted)' }}>
        {feedback}
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
        Câu {index + 1}/{words.length}
      </p>
      <div style={{ margin: '12px 0 18px', textAlign: 'center' }}>
        <button type="button" className="btn primary" onClick={playAudio} aria-label="Nghe lại phát âm">
          ▶ Nghe lại
        </button>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 8 }}>
          Nghe kỹ rồi chọn từ bạn nghe được.
        </p>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {round.options.map((opt, i) => {
          const isCorrect = picked !== null && opt === round.word;
          const isWrongPick = picked === opt && opt !== round.word;
          const cls = `opt-card${isCorrect ? ' correct' : ''}${isWrongPick ? ' wrong-pick' : ''}`;
          return (
            <button
              key={opt}
              type="button"
              className={cls}
              disabled={picked !== null}
              onClick={() => pick(opt)}
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
