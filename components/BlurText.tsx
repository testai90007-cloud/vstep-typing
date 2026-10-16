'use client';

// BlurText — ported from React Bits (https://reactbits.dev/text-animations/blur-text).
// Original engine kept: words/letters split, IntersectionObserver one-shot trigger,
// per-segment staggered keyframes blur(10px)/opacity 0/y ±50 → blur(0)/opacity 1/y 0.
// Converted to TypeScript + vanilla CSS. The original ships no
// prefers-reduced-motion handling; this port renders the final state
// immediately (no animation) when reduced motion is requested.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, type Transition } from 'motion/react';
import './BlurText.css';

type AnimSnapshot = Record<string, string | number>;

interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  threshold?: number;
  rootMargin?: string;
  animationFrom?: AnimSnapshot;
  animationTo?: AnimSnapshot[];
  easing?: (t: number) => number;
  onAnimationComplete?: () => void;
  stepDuration?: number;
}

const buildKeyframes = (
  from: AnimSnapshot,
  steps: AnimSnapshot[],
): Record<string, (string | number)[]> => {
  const keys = new Set<string>([
    ...Object.keys(from),
    ...steps.flatMap((s) => Object.keys(s)),
  ]);
  const keyframes: Record<string, (string | number)[]> = {};
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])];
  });
  return keyframes;
};

export default function BlurText({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = (t: number) => t,
  onAnimationComplete,
  stepDuration = 0.35,
}: BlurTextProps) {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  // Read after mount so SSR and the first client render agree (no
  // hydration mismatch); the segments start at the blurred "from" state
  // anyway, so nothing animated flashes before this effect runs.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPrefersReducedMotion(true);
    }
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (ref.current) observer.unobserve(ref.current);
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom = useMemo<AnimSnapshot>(
    () =>
      direction === 'top'
        ? { filter: 'blur(10px)', opacity: 0, y: -50 }
        : { filter: 'blur(10px)', opacity: 0, y: 50 },
    [direction],
  );

  const defaultTo = useMemo<AnimSnapshot[]>(
    () => [
      {
        filter: 'blur(5px)',
        opacity: 0.5,
        y: direction === 'top' ? 5 : -5,
      },
      { filter: 'blur(0px)', opacity: 1, y: 0 },
    ],
    [direction],
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;
  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) =>
    stepCount === 1 ? 0 : i / (stepCount - 1),
  );

  // Reduced motion: render the final text with no animation at all.
  if (prefersReducedMotion) {
    return (
      <span ref={ref} className={`blur-text ${className}`}>
        {text}
      </span>
    );
  }

  return (
    <span ref={ref} className={`blur-text ${className}`}>
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);
        const spanTransition: Transition = {
          duration: totalDuration,
          times,
          delay: (index * delay) / 1000,
          ease: easing,
        };
        return (
          <span key={`${segment}-${index}`} className="blur-text-mask">
            <motion.span
              className="blur-text-seg"
              initial={fromSnapshot}
              animate={inView ? animateKeyframes : fromSnapshot}
              transition={spanTransition}
              onAnimationComplete={
                index === elements.length - 1 ? onAnimationComplete : undefined
              }
            >
              {segment === ' ' ? ' ' : segment}
            </motion.span>
            {animateBy === 'words' && index < elements.length - 1 && ' '}
          </span>
        );
      })}
    </span>
  );
}
