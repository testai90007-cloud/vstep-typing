'use client';

// SwapText — ported from Animata (https://animata.design/docs/text/swap-text).
// Original mechanics kept: relative overflow-hidden container, initial text
// slides up -100% on hover while the final text (absolute, top-full) slides
// into view; invisible zero-height copy of the longer string reserves height;
// 200ms ease-slow transition. Converted to TypeScript + vanilla CSS.
// Adaptation: the original wraps the swap in a <button> for click-toggle;
// here the hover target is the parent card (pure CSS :hover), so no button
// is rendered — avoids nested-interactive HTML inside the card link.

import './SwapText.css';

interface SwapTextProps {
  initialText: string;
  finalText: string;
  className?: string;
  initialTextClassName?: string;
  finalTextClassName?: string;
}

export function SwapText({
  initialText,
  finalText,
  className = '',
  initialTextClassName = '',
  finalTextClassName = '',
}: SwapTextProps) {
  const longWord = finalText.length > initialText.length ? finalText : null;
  return (
    <div className={`swap-text ${className}`}>
      <span className={`swap-initial ${initialTextClassName}`}>
        {initialText}
        {/* reserve height for the longer string after transition */}
        {longWord ? <span className="swap-sizer">{longWord}</span> : null}
      </span>
      <span className={`swap-final ${finalTextClassName}`}>{finalText}</span>
    </div>
  );
}
