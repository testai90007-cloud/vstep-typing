'use client';

// FluidTabs — adapted from the Animata Fluid Tabs component
// (https://animata.design/docs/tabs/fluid-tabs, MIT licensed).
// Segmented control where the active pill slides between tabs with a spring
// (motion layoutId). Simplified for a fixed tab list: controlled
// activeId + onChange, full keyboard support (←/→/Home/End, roving tabindex),
// focus-visible ring. Converted to TypeScript + vanilla CSS, theme-aware via
// the site's CSS variables.

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import './FluidTabs.css';

export interface FluidTabDef {
  id: string;
  label: ReactNode;
}

interface FluidTabsProps {
  tabs: FluidTabDef[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}

const INDICATOR_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 34,
  mass: 0.75,
};

export default function FluidTabs({
  tabs,
  activeId,
  onChange,
  ariaLabel = 'Tabs',
  className = '',
}: FluidTabsProps) {
  const indicatorId = `fluid-pill-${useId().replace(/:/g, '')}`;
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeId)
  );

  const focusTab = (index: number) => {
    listRef.current
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [index]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.matches?.('[role="tab"]')) return;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (activeIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (activeIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(tabs[next].id);
    focusTab(next);
  };

  return (
    <div
      ref={listRef}
      className={`fluid-tabs${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {tabs.map((t) => {
        const selected = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`fluid-tab${selected ? ' selected' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {selected && (
              <motion.span
                layoutId={indicatorId}
                className="fluid-pill"
                transition={INDICATOR_SPRING}
                aria-hidden="true"
              />
            )}
            <span className="fluid-label">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
