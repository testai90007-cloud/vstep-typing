'use client';

// AnimatedThemeToggler — adapted from Magic UI
// (https://magicui.design/docs/components/animated-theme-toggler).
// Theme switch with a View Transitions API clip-path reveal expanding from
// the button (default: circle).
//
// Adapted for this project:
// - no Tailwind / lucide: vanilla CSS + heroicons (already a dependency)
// - theme keyed off html[data-theme] + localStorage 'vstep_theme'
//   (the original toggles a .dark class + localStorage 'theme')
// - Vietnamese aria-labels; keeps the header's `icon-btn` styling

import { useCallback, useEffect, useRef, useState } from 'react';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

export type TransitionVariant =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'rectangle'
  | 'star';

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<'button'> {
  duration?: number;
  variant?: TransitionVariant;
  /** When true, the transition expands from the viewport center instead of the button center. */
  fromCenter?: boolean;
}

const THEME_KEY = 'vstep_theme';

function polygonCollapsed(point: string, vertexCount: number): string {
  const pairs = Array.from({ length: vertexCount }, () => point).join(', ');
  return `polygon(${pairs})`;
}

// All coordinates are percentages of the snapshot reference box: Chrome 150
// renders absolute px clip-path coordinates on ::view-transition-new(root)
// unscaled on fractional display scales (e.g. Windows 150%) for the first
// transition after load, so px values land at the wrong position (#989).
function getThemeTransitionClipPaths(
  variant: TransitionVariant,
  cx: number,
  cy: number,
  maxRadius: number,
  viewportWidth: number,
  viewportHeight: number
): [string, string] {
  const toX = (x: number) => `${(x / viewportWidth) * 100}%`;
  const toY = (y: number) => `${(y / viewportHeight) * 100}%`;
  const point = (x: number, y: number) => `${toX(x)} ${toY(y)}`;
  // circle() percentage radii resolve against hypot(w, h) / sqrt(2) of the reference box.
  const toRadius = (r: number) =>
    `${(r / (Math.hypot(viewportWidth, viewportHeight) / Math.SQRT2)) * 100}%`;

  switch (variant) {
    case 'circle':
      return [`circle(0% at ${point(cx, cy)})`, `circle(${toRadius(maxRadius)} at ${point(cx, cy)})`];
    case 'square': {
      const halfW = Math.max(cx, viewportWidth - cx);
      const halfH = Math.max(cy, viewportHeight - cy);
      const halfSide = Math.max(halfW, halfH) * 1.05;
      const end = [
        point(cx - halfSide, cy - halfSide),
        point(cx + halfSide, cy - halfSide),
        point(cx + halfSide, cy + halfSide),
        point(cx - halfSide, cy + halfSide),
      ].join(', ');
      return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`];
    }
    case 'triangle': {
      const scale = maxRadius * 2.2;
      const dx = (Math.sqrt(3) / 2) * scale;
      const verts = [
        point(cx, cy - scale),
        point(cx + dx, cy + 0.5 * scale),
        point(cx - dx, cy + 0.5 * scale),
      ].join(', ');
      return [polygonCollapsed(point(cx, cy), 3), `polygon(${verts})`];
    }
    case 'diamond': {
      // Slightly larger than the view-transition circle radius so axis-aligned coverage matches the circle reveal.
      const R = maxRadius * Math.SQRT2;
      const end = [point(cx, cy - R), point(cx + R, cy), point(cx, cy + R), point(cx - R, cy)].join(
        ', '
      );
      return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`];
    }
    case 'hexagon': {
      const R = maxRadius * Math.SQRT2;
      const verts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        verts.push(point(cx + R * Math.cos(a), cy + R * Math.sin(a)));
      }
      return [polygonCollapsed(point(cx, cy), 6), `polygon(${verts.join(', ')})`];
    }
    case 'rectangle': {
      const halfW = Math.max(cx, viewportWidth - cx);
      const halfH = Math.max(cy, viewportHeight - cy);
      const end = [
        point(cx - halfW, cy - halfH),
        point(cx + halfW, cy - halfH),
        point(cx + halfW, cy + halfH),
        point(cx - halfW, cy + halfH),
      ].join(', ');
      return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`];
    }
    case 'star': {
      // Small overscan so the last frames never leave a 1px seam before the transition group ends.
      const R = maxRadius * Math.SQRT2 * 1.03;
      const innerRatio = 0.42;
      const starPolygon = (radius: number) => {
        const verts: string[] = [];
        for (let i = 0; i < 5; i++) {
          const outerA = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          verts.push(point(cx + radius * Math.cos(outerA), cy + radius * Math.sin(outerA)));
          const innerA = outerA + Math.PI / 5;
          verts.push(
            point(cx + radius * innerRatio * Math.cos(innerA), cy + radius * innerRatio * Math.sin(innerA))
          );
        }
        return `polygon(${verts.join(', ')})`;
      };
      const startR = Math.max(2, R * 0.025);
      return [starPolygon(startR), starPolygon(R)];
    }
    default:
      return [`circle(0% at ${point(cx, cy)})`, `circle(${toRadius(maxRadius)} at ${point(cx, cy)})`];
  }
}

/**
 * Flip the site theme with the Magic UI View Transitions reveal.
 * Shared by <AnimatedThemeToggler> and the homepage dock's theme item.
 * The reveal expands from (cx, cy) — pass the clicked button's center, or
 * omit to expand from the viewport center.
 */
let flipLock = false;
let flipAnim: Animation | null = null;

export function flipThemeAnimated(
  cx?: number,
  cy?: number,
  duration = 400,
  variant: TransitionVariant = 'circle'
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (flipLock || root.dataset.magicuiThemeVt === 'active') return;

  // innerWidth/innerHeight (not visualViewport): percentages must resolve
  // against the snapshot reference box, which includes classic scrollbars.
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const x = cx ?? viewportWidth / 2;
  const y = cy ?? viewportHeight / 2;
  const maxRadius = Math.hypot(Math.max(x, viewportWidth - x), Math.max(y, viewportHeight - y));

  const applyTheme = () => {
    // Read the live DOM (not React state) so concurrent callers agree.
    const nextDark = root.getAttribute('data-theme') !== 'dark';
    if (nextDark) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
    try {
      window.localStorage.setItem(THEME_KEY, nextDark ? 'dark' : 'light');
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
    // NOTE: no React setState here — <AnimatedThemeToggler> syncs its icon
    // via its data-theme MutationObserver, so no flushSync is needed.
  };

  if (typeof document.startViewTransition !== 'function') {
    applyTheme();
    return;
  }

  const clipPath = getThemeTransitionClipPaths(variant, x, y, maxRadius, viewportWidth, viewportHeight);

  root.dataset.magicuiThemeVt = 'active';
  root.style.setProperty('--magicui-theme-toggle-vt-duration', `${duration}ms`);
  // Pin the collapsed clip-path via CSS so Firefox does not paint the new
  // theme unclipped between snapshot and the ready.then() JS animation.
  root.style.setProperty('--magicui-theme-vt-clip-from', clipPath[0]);
  const cleanup = () => {
    flipLock = false;
    delete root.dataset.magicuiThemeVt;
    root.style.removeProperty('--magicui-theme-toggle-vt-duration');
    root.style.removeProperty('--magicui-theme-vt-clip-from');
    flipAnim?.cancel();
    flipAnim = null;
  };

  flipLock = true;
  const transition = document.startViewTransition(() => {
    applyTheme();
  });
  if (typeof transition?.finished?.finally === 'function') {
    transition.finished.finally(cleanup).catch(() => {});
  } else {
    cleanup();
  }

  const ready = transition?.ready;
  if (ready && typeof ready.then === 'function') {
    ready
      .then(() => {
        flipAnim = root.animate(
          { clipPath },
          {
            duration,
            // Star: linear avoids easing overshoot that fights polygon interpolation at t→1; VT group duration is synced above.
            easing: variant === 'star' ? 'linear' : 'ease-in-out',
            fill: 'forwards',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      })
      .catch(() => {});
  }
}

export function AnimatedThemeToggler({
  className,
  duration = 400,
  variant,
  fromCenter = false,
  ...props
}: AnimatedThemeTogglerProps) {
  const shape = variant ?? 'circle';
  // NOTE: intentionally NOT reading the DOM in the initializer — the page is
  // prerendered, so that would hydrate with a mismatched icon. The real theme
  // is picked up in the mount effect below (same pattern as the old
  // ThemeToggle, which was verified to persist correctly across reloads).
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Stay in sync with the real theme. Reads localStorage after mount (belt
  // and suspenders: also re-applies the data-theme attribute in case the
  // layout's pre-paint script hasn't run), then observes the attribute for
  // external changes.
  useEffect(() => {
    setMounted(true);
    let dark = false;
    try {
      dark = window.localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      /* storage unavailable — stay on light */
    }
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    setIsDark(dark);
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = useCallback(() => {
    const button = buttonRef.current;
    // innerWidth/innerHeight (not visualViewport): percentages must resolve
    // against the snapshot reference box, which includes classic scrollbars.
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let x = viewportWidth / 2;
    let y = viewportHeight / 2;
    if (!fromCenter && button) {
      const { top, left, width, height } = button.getBoundingClientRect();
      x = left + width / 2;
      y = top + height / 2;
    }
    flipThemeAnimated(x, y, duration, shape);
  }, [shape, fromCenter, duration]);

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={toggleTheme}
      className={className || 'icon-btn'}
      title={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      {...props}
    >
      {mounted && isDark ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
    </button>
  );
}

export default AnimatedThemeToggler;
