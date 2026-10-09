'use client';

// SpellBadge — minimal badge in the spirit of Spell UI
// (https://spell.sh/docs/badge): small pill, color variants, two sizes.
// Vanilla CSS, theme-aware via site vars.

import type { ReactNode } from 'react';
import './SpellBadge.css';

interface SpellBadgeProps {
  variant?: 'violet' | 'neutral';
  size?: 'sm' | 'xs';
  className?: string;
  children: ReactNode;
}

export function SpellBadge({
  variant = 'violet',
  size = 'sm',
  className = '',
  children,
}: SpellBadgeProps) {
  return (
    <span className={`spell-badge ${variant} ${size} ${className}`.trim()}>
      {children}
    </span>
  );
}
