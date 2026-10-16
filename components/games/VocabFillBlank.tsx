'use client';

// Vocab game 4 — Fill in the blank: type the missing word in the example sentence.

import { useState } from 'react';

export interface FillRound {
  word: string;
  sentence: string; // example sentence with the word blanked as ______
  completed: string; // original example sentence, shown when wrong
}

interface VocabFillBlankProps {
  words: FillRound[];
  onAnswer: (word: string, correct: boolean) => void;
  onFinish: () => void;
}

export default function VocabFillBlank({ words, onAnswer, onFinish }: VocabFillBlankProps) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState('');

  const round = words[index];

  const submit = () => {
    if (checked !== null) return;
    const correct = value.trim().toLowerCase() === round.word.toLowerCase();
    setChecked(correct);
    onAnswer(round.word, correct);
    setFeedback(correct ? 'Đúng!' : `Sai. Từ đúng là: ${round.word}`);
  };

  const next = () => {
    if (index + 1 >= words.length) {
      onFinish();
    } else {
      setIndex(index + 1);
      setValue('');
      setChecked(null);
      setFeedback('');
    }
  };

  if (!round) return <p>Không có câu hỏi nào.</p>;

  return (
    <div>
      <p aria-live="polite" style={{ minHeight: '1.4em', fontSize: '0.88rem', color: 'var(--muted)' }}>
        {feedback}
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
        Câu {index + 1}/{words.length}
      </p>
      <p style={{ fontSize: '1.1rem', lineHeight: 1.8, margin: '12px 0 16px' }}>{round.sentence}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (checked === null) submit();
          else next();
        }}
      >
        <label className="section-label" htmlFor="fill-blank-input">
          Điền từ còn thiếu
        </label>
        <input
          id="fill-blank-input"
          className="input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={checked !== null}
          placeholder="Gõ từ…"
          autoComplete="off"
          aria-label="Điền từ còn thiếu"
        />
        {checked === null ? (
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button type="submit" className="btn primary" disabled={!value.trim()}>
              Kiểm tra (Enter)
            </button>
          </div>
        ) : (
          <>
            {checked === false && (
              <p style={{ marginTop: 14, lineHeight: 1.8 }}>
                Câu hoàn chỉnh: <strong style={{ color: 'var(--correct)' }}>{round.completed}</strong>
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button type="submit" className="btn primary">
                {index + 1 >= words.length ? 'Xem kết quả' : 'Câu tiếp theo (Enter)'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
