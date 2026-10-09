'use client';

// FoldedCard — adapted from Cult UI (https://www.cult-ui.com/docs/components/folded-card).
// Original mechanics kept: the card's top-right corner is cut by a 40px fold
// via clip-path polygon (8px corner notches elsewhere); the 1px border is
// faked by an outer clipped layer in the border color wrapping an inner
// clipped layer in the card color (clip-path would cut a real border);
// a gradient triangle sits in the cut corner as the paper "fold".
// Converted to TypeScript + vanilla CSS, theme-aware via site vars.

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import './FoldedCard.css';

const FOLDED_CLIP =
  'polygon(0 8px, 8px 0, calc(100% - 40px) 0, 100% 40px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))';

export function FoldedCardFold() {
  return (
    <span className="folded-fold" aria-hidden="true">
      <span className="folded-fold-shade" />
    </span>
  );
}

interface FoldedCardProps {
  href?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function FoldedCard({ href, className = '', style, children }: FoldedCardProps) {
  const cls = `folded-card ${className}`.trim();
  const merged: CSSProperties = { ...style, ['--fold-clip' as string]: FOLDED_CLIP };
  const body = (
    <span className="folded-card-inner">
      <FoldedCardFold />
      {children}
    </span>
  );
  if (href) {
    return (
      <Link href={href} className={cls} style={merged}>
        {body}
      </Link>
    );
  }
  return (
    <div className={cls} style={merged}>
      {body}
    </div>
  );
}
