'use client';

// LevelUpModal — THE ONLY place in the app allowed a small celebration
// effect (one scale-in on open). Respects prefers-reduced-motion (no
// animation). Focus goes to the close button on open and returns to the
// trigger on close. Esc closes; clicking the backdrop does NOT close, to
// avoid accidental dismissal mid-celebration.

import { useEffect, useRef } from 'react';
import { LEVELS } from '@/lib/vocab-gamification';
import { FrameAvatar } from '@/components/VocabFramePicker';

interface LevelUpModalProps {
  open: boolean;
  newLevel: number;
  gainedXp: number;
  unlockedFrame: { id: string; name: string } | null;
  onClose: () => void;
}

export default function LevelUpModal({
  open,
  newLevel,
  gainedXp,
  unlockedFrame,
  onClose,
}: LevelUpModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const levelName = LEVELS.find((l) => l.level === newLevel)?.name ?? '';

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal card vx-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vx-levelup-title"
      >
        <h2 id="vx-levelup-title" style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 800 }}>
          Lên cấp {newLevel}!
        </h2>
        <p style={{ margin: '0 0 6px', color: 'var(--muted)' }}>
          {levelName} · <strong style={{ color: 'var(--ink)' }}>+{gainedXp} XP</strong>
        </p>
        {unlockedFrame && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 4px' }}>
            <FrameAvatar frameId={unlockedFrame.id} size={56} />
            <p style={{ margin: 0, fontWeight: 600 }}>Mở khóa {unlockedFrame.name}</p>
          </div>
        )}
        <button
          ref={closeRef}
          type="button"
          className="btn primary"
          onClick={onClose}
          style={{ minHeight: 44, width: '100%', marginTop: 18 }}
        >
          Tuyệt vời
        </button>
        <style jsx>{`
          .vx-modal {
            animation: vx-pop 0.18s ease-out;
          }
          @keyframes vx-pop {
            from {
              transform: scale(0.94);
              opacity: 0.6;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .vx-modal {
              animation: none;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
