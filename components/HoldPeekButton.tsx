'use client';

// HoldPeekButton — press-and-hold button in the spirit of KokonutUI's Hold
// Button (https://kokonutui.com/docs/buttons/hold-button): while the pointer
// is down, a fill layer sweeps across as tactile feedback.
// Adaptation: the site's "Xem gợi ý" is a momentary peek (reveal while held,
// hide on release), not a hold-to-confirm — so this keeps the exact peek
// semantics and only borrows the hold visual language.

import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import './HoldPeekButton.css';

interface HoldPeekButtonProps {
  onDown: () => void;
  onUp: () => void;
  className?: string;
  ariaLabel: string;
  children: ReactNode;
}

export function HoldPeekButton({
  onDown,
  onUp,
  className = '',
  ariaLabel,
  children,
}: HoldPeekButtonProps) {
  const [holding, setHolding] = useState(false);
  const held = useRef(false);

  const down = () => {
    if (held.current) return;
    held.current = true;
    setHolding(true);
    onDown();
  };
  const up = () => {
    if (!held.current) return;
    held.current = false;
    setHolding(false);
    onUp();
  };

  return (
    <button
      type="button"
      className={`hold-peek ${className}`}
      aria-label={ariaLabel}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <AnimatePresence>
        {holding && (
          <motion.span
            className="hold-fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'linear' }}
          />
        )}
      </AnimatePresence>
      <span className="hold-label">{children}</span>
    </button>
  );
}
