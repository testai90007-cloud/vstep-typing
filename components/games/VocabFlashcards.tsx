'use client';

// Vocab game 1 — Flashcards, Quizlet-style swipe deck.
// Tap/click the card to flip it. Swipe right = Đã nhớ, swipe left = Chưa nhớ.
// Buttons + keyboard (Space flip, ←/→ grade) work the same as swiping.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VocabDefinition } from '@/lib/vocab';
import { getVocabLevel } from '@/lib/vocab';

export interface FlashcardItem {
  word: string;
  definition: VocabDefinition;
}

interface VocabFlashcardsProps {
  words: FlashcardItem[];
  onAnswer: (word: string, correct: boolean) => void;
  onFinish: () => void;
}

const SWIPE_THRESHOLD = 110;
const EXIT_MS = 260;

export default function VocabFlashcards({ words, onAnswer, onFinish }: VocabFlashcardsProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<0 | 1 | -1>(0);

  const startXRef = useRef(0);
  const movedRef = useRef(false);
  const draggingRef = useRef(false);
  const dragXRef = useRef(0);
  const animatingRef = useRef(false);
  const indexRef = useRef(0);
  indexRef.current = index;

  const grade = useCallback(
    (correct: boolean) => {
      if (animatingRef.current) return;
      const item = words[indexRef.current];
      if (!item) return;
      animatingRef.current = true;
      setExiting(correct ? 1 : -1);
      onAnswer(item.word, correct);
      setFeedback(
        correct ? `Đã ghi nhận: đã nhớ “${item.word}”.` : `Đã ghi nhận: chưa nhớ “${item.word}”.`,
      );
      window.setTimeout(() => {
        animatingRef.current = false;
        setExiting(0);
        dragXRef.current = 0;
        setDragX(0);
        setFlipped(false);
        if (indexRef.current + 1 >= words.length) {
          onFinish();
        } else {
          setIndex(indexRef.current + 1);
        }
      }, EXIT_MS);
    },
    [words, onAnswer, onFinish],
  );

  // Keyboard: Space flips, ← = chưa nhớ, → = đã nhớ.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowLeft') {
        grade(false);
      } else if (e.key === 'ArrowRight') {
        grade(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grade]);

  if (words.length === 0) {
    return <p>Không có thẻ nào để học.</p>;
  }

  const item = words[index];
  const def = item.definition;
  const level = getVocabLevel(item.word);
  const meanings = def.meanings.slice(0, 2);
  const example = def.meanings.flatMap((m) => m.definitions).find((d) => d.example)?.example;
  const next = words[index + 1];

  const playAudio = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (!def.audio) return;
    const audio = new Audio(def.audio);
    void audio.play().catch(() => {});
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (animatingRef.current) return;
    startXRef.current = e.clientX;
    movedRef.current = false;
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 8) movedRef.current = true;
    dragXRef.current = dx;
    setDragX(dx);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (Math.abs(dragXRef.current) >= SWIPE_THRESHOLD) {
      grade(dragXRef.current > 0);
    } else {
      dragXRef.current = 0;
      setDragX(0);
    }
  };

  const onCardClick = () => {
    // A drag that ends on the card also fires click — ignore it.
    if (movedRef.current || animatingRef.current) return;
    setFlipped((f) => !f);
  };

  const swipeHint =
    dragX > 8 ? 'Đã nhớ →' : dragX < -8 ? '← Chưa nhớ' : '';

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <p aria-live="polite" style={{ minHeight: '1.4em', fontSize: '0.88rem', color: 'var(--muted)' }}>
        {feedback}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          Thẻ {index + 1}/{words.length}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          Vuốt phải = đã nhớ · Vuốt trái = chưa nhớ
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: 'var(--line)',
          overflow: 'hidden',
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: `${(index / words.length) * 100}%`,
            height: '100%',
            background: 'var(--accent)',
            transition: 'width 0.25s ease',
          }}
        />
      </div>

      {/* Deck: next card peeking behind the current one. */}
      <div style={{ position: 'relative', height: 320 }}>
        {next && (
          <div
            aria-hidden
            className="card"
            style={{
              position: 'absolute',
              inset: 0,
              transform: 'translateY(14px) scale(0.94)',
              opacity: 0.55,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <strong style={{ fontSize: '1.6rem', color: 'var(--muted)' }}>{next.word}</strong>
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Thẻ ${item.word}, bấm để lật`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={onCardClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
          style={{
            position: 'absolute',
            inset: 0,
            transform:
              exiting !== 0
                ? `translateX(${exiting * 120}%) rotate(${exiting * 12}deg)`
                : `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`,
            opacity: exiting !== 0 ? 0 : 1,
            transition: dragging ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
            cursor: dragging ? 'grabbing' : 'grab',
            touchAction: 'pan-y',
            userSelect: 'none',
            perspective: 1000,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform 0.45s ease',
            }}
          >
            {/* Front: word */}
            <div
              className="card"
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                textAlign: 'center',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {level && <span className="chip">{level}</span>}
              <strong style={{ fontSize: '2.2rem' }}>{item.word}</strong>
              {def.phonetic && <span style={{ color: 'var(--muted)' }}>{def.phonetic}</span>}
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Bấm để lật</span>
            </div>
            {/* Back: meaning */}
            <div
              className="card"
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '1.5rem' }}>{item.word}</strong>
                {level && <span className="chip">{level}</span>}
                {def.phonetic && <span style={{ color: 'var(--muted)' }}>{def.phonetic}</span>}
                {def.audio && (
                  <button
                    type="button"
                    className="btn sm"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={playAudio}
                    aria-label={`Nghe phát âm từ ${item.word}`}
                  >
                    Nghe
                  </button>
                )}
              </div>
              {meanings.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>Chưa có nghĩa cho từ này.</p>
              ) : (
                <ul style={{ margin: '14px 0', paddingLeft: 18, lineHeight: 1.7 }}>
                  {meanings.map((m, i) => (
                    <li key={i}>
                      <em style={{ color: 'var(--muted)' }}>{m.pos}</em> — {m.definitions[0]?.definition}
                    </li>
                  ))}
                </ul>
              )}
              {example && (
                <p style={{ fontStyle: 'italic', color: 'var(--muted)', lineHeight: 1.7 }}>“{example}”</p>
              )}
            </div>
          </div>
          {/* Swipe direction hint */}
          {swipeHint && (
            <span
              style={{
                position: 'absolute',
                top: 14,
                left: dragX > 0 ? undefined : 14,
                right: dragX > 0 ? 14 : undefined,
                fontWeight: 700,
                fontSize: '0.95rem',
                color: dragX > 0 ? 'var(--correct)' : 'var(--wrong)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {swipeHint}
            </span>
          )}
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 22, justifyContent: 'center' }}>
        <button type="button" className="btn" onClick={() => grade(false)}>
          ← Chưa nhớ
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => grade(true)}
        >
          Đã nhớ →
        </button>
      </div>
    </div>
  );
}
