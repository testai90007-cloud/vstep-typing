'use client';

// SegProgress — adapted from the Animata Progress component
// (https://animata.design/docs/graphs/progress, MIT licensed).
// The original renders one row of 2px bars that light up left-to-right with a
// stagger. This adaptation makes it a *stacked* distribution bar: each bar is
// colored by the skill whose proportional range it falls in, so the bar reads
// as 4 colored blocks that still reveal with the original stagger. Converted
// to TypeScript + vanilla CSS, theme-aware via CSS variables. Remount (via
// key) to replay the reveal.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import './SegProgress.css';

export interface Seg {
  color: string;
  value: number;
  label: string;
}

interface SegProgressProps {
  segments: Seg[];
  ariaLabel?: string;
}

export default function SegProgress({ segments, ariaLabel }: SegProgressProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [lit, setLit] = useState(false);

  useLayoutEffect(() => {
    const measure = () => setWidth(ref.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLit(true), 250);
    return () => clearTimeout(t);
  }, []);

  const total = segments.reduce((a, s) => a + s.value, 0);
  const bars = Math.max(8, Math.floor(width / 4));

  // cumulative proportional bounds per segment, e.g. [0.4, 0.7, 0.85, 1]
  const bounds: number[] = [];
  let acc = 0;
  for (const s of segments) {
    acc += total > 0 ? s.value / total : 0;
    bounds.push(acc);
  }
  const segIndexFor = (i: number) => {
    const p = (i + 0.5) / bars;
    const idx = bounds.findIndex((b) => p <= b);
    return idx === -1 ? segments.length - 1 : idx;
  };

  return (
    <div ref={ref} className="segbar" role="img" aria-label={ariaLabel}>
      {width > 0 &&
        Array.from({ length: bars }, (_, i) => {
          const s = segments[segIndexFor(i)];
          return (
            <i
              key={i}
              className={lit ? 'on' : ''}
              style={
                {
                  '--c': s.color,
                  transitionDelay: lit ? `${i * 6}ms` : '0ms',
                } as CSSProperties
              }
            />
          );
        })}
    </div>
  );
}
