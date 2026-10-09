'use client';

// SmoothTab — segmented control in the spirit of KokonutUI's Smooth Tab
// (https://kokonutui.com/docs/navigation/smooth-tab): the active pill is
// measured from the real button rects and glides between tabs with a spring;
// full keyboard support (roving tabindex, arrows/Home/End, automatic
// activation) with tablist/tab ARIA semantics.
// Converted to TypeScript + vanilla CSS; motion is already in the project.

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import './SmoothTab.css';

export interface SmoothTabDef {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface SmoothTabProps {
  tabs: SmoothTabDef[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

export function SmoothTab({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  className = '',
}: SmoothTabProps) {
  const pillId = useId().replaceAll(':', '');
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (idx: number) => {
    const n = tabs.length;
    const next = ((idx % n) + n) % n;
    const t = tabs[next];
    btnRefs.current[next]?.focus();
    if (!t.disabled) onChange(t.id);
  };

  const onKeyDown = (e: KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusTab(idx + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusTab(idx - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <div className={`smooth-tab ${className}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map((t, i) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={t.disabled}
            className={`st-btn${active ? ' active' : ''}`}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {active && (
              <motion.span
                layoutId={`st-pill-${pillId}`}
                className="st-pill"
                transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
              />
            )}
            <span className="st-label">
              {t.icon}
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
