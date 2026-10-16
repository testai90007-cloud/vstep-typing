'use client';

// FlowingMenu — adapted from the React Bits FlowingMenu component
// (https://reactbits.dev/components/flowing-menu), converted to TypeScript
// and wired to Next.js <Link> so each row navigates directly to its skill
// page. Hovering a row sweeps in a marquee band (edge-aware via GSAP:
// enters from the edge the cursor came from).

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';

import './FlowingMenu.css';

export interface FlowingMenuItem {
  link: string;
  text: string;
  image: string;
}

interface FlowingMenuProps {
  items?: FlowingMenuItem[];
  speed?: number;
  textColor?: string;
  bgColor?: string;
  marqueeBgColor?: string;
  marqueeTextColor?: string;
  borderColor?: string;
}

export default function FlowingMenu({
  items = [],
  speed = 15,
  textColor = 'var(--ink)',
  bgColor = 'transparent',
  marqueeBgColor = 'var(--ink)',
  marqueeTextColor = 'var(--paper)',
  borderColor = 'var(--line)',
}: FlowingMenuProps) {
  return (
    <div className="menu-wrap" style={{ backgroundColor: bgColor }}>
      <nav className="menu" aria-label="Kỹ năng VSTEP">
        {items.map((item, idx) => (
          <MenuItem
            key={idx}
            {...item}
            speed={speed}
            textColor={textColor}
            marqueeBgColor={marqueeBgColor}
            marqueeTextColor={marqueeTextColor}
            borderColor={borderColor}
          />
        ))}
      </nav>
    </div>
  );
}

interface MenuItemProps extends FlowingMenuItem {
  speed: number;
  textColor: string;
  marqueeBgColor: string;
  marqueeTextColor: string;
  borderColor: string;
}

function MenuItem({
  link,
  text,
  image,
  speed,
  textColor,
  marqueeBgColor,
  marqueeTextColor,
  borderColor,
}: MenuItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const marqueeInnerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<gsap.core.Tween | null>(null);
  const [repetitions, setRepetitions] = useState(4);

  const animationDefaults = { duration: 0.6, ease: 'expo' as const };

  const distMetric = (x: number, y: number, x2: number, y2: number) => {
    const xDiff = x - x2;
    const yDiff = y - y2;
    return xDiff * xDiff + yDiff * yDiff;
  };

  const findClosestEdge = (mouseX: number, mouseY: number, width: number, height: number) => {
    const topEdgeDist = distMetric(mouseX, mouseY, width / 2, 0);
    const bottomEdgeDist = distMetric(mouseX, mouseY, width / 2, height);
    return topEdgeDist < bottomEdgeDist ? 'top' : 'bottom';
  };

  useEffect(() => {
    const calculateRepetitions = () => {
      if (!marqueeInnerRef.current) return;
      const marqueeContent = marqueeInnerRef.current.querySelector('.marquee__part');
      if (!marqueeContent) return;
      const contentWidth = (marqueeContent as HTMLElement).offsetWidth;
      // Guard: if the marquee part measures 0 (e.g. hidden by CSS),
      // innerWidth/0 = Infinity would make [...Array(Infinity)] throw
      // RangeError and crash the page.
      if (!contentWidth) return;
      const viewportWidth = window.innerWidth;
      const needed = Math.ceil(viewportWidth / contentWidth) + 2;
      if (!Number.isFinite(needed)) return;
      setRepetitions(Math.min(24, Math.max(4, needed)));
    };

    calculateRepetitions();
    window.addEventListener('resize', calculateRepetitions);
    return () => window.removeEventListener('resize', calculateRepetitions);
  }, [text, image]);

  useEffect(() => {
    // The infinite marquee tween is created lazily on first hover/focus
    // (ensureMarquee) and paused on leave/blur — it never runs while the
    // marquee is hidden off-screen. Under prefers-reduced-motion no tween
    // is created at all (static marquee).
    return () => {
      if (animationRef.current) animationRef.current.kill();
      animationRef.current = null;
    };
  }, []);

  // If the marquee content width changes (resize → new repetition count),
  // drop the tween so the next hover rebuilds it with the fresh width.
  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.kill();
      animationRef.current = null;
    }
  }, [repetitions]);

  const ensureMarquee = () => {
    if (animationRef.current) {
      animationRef.current.play();
      return;
    }
    if (!marqueeInnerRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const marqueeContent = marqueeInnerRef.current.querySelector('.marquee__part');
    if (!marqueeContent) return;
    const contentWidth = (marqueeContent as HTMLElement).offsetWidth;
    if (contentWidth === 0) return;

    animationRef.current = gsap.to(marqueeInnerRef.current, {
      x: -contentWidth,
      duration: speed,
      ease: 'none',
      repeat: -1,
    });
  };

  const pauseMarquee = () => {
    animationRef.current?.pause();
  };

  const handleMouseEnter = (ev: React.MouseEvent) => {
    if (!itemRef.current || !marqueeRef.current || !marqueeInnerRef.current) return;
    ensureMarquee();
    const rect = itemRef.current.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const edge = findClosestEdge(x, y, rect.width, rect.height);

    gsap
      .timeline({ defaults: animationDefaults })
      .set(marqueeRef.current, { y: edge === 'top' ? '-101%' : '101%' }, 0)
      .set(marqueeInnerRef.current, { y: edge === 'top' ? '101%' : '-101%' }, 0)
      .to([marqueeRef.current, marqueeInnerRef.current], { y: '0%' }, 0);
  };

  const handleMouseLeave = (ev: React.MouseEvent) => {
    if (!itemRef.current || !marqueeRef.current || !marqueeInnerRef.current) return;
    pauseMarquee();
    const rect = itemRef.current.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const edge = findClosestEdge(x, y, rect.width, rect.height);

    gsap
      .timeline({ defaults: animationDefaults })
      .to(marqueeRef.current, { y: edge === 'top' ? '-101%' : '101%' }, 0)
      .to(marqueeInnerRef.current, { y: edge === 'top' ? '101%' : '-101%' }, 0);
  };

  const handleFocus = () => {
    if (!marqueeRef.current || !marqueeInnerRef.current) return;
    ensureMarquee();
    gsap
      .timeline({ defaults: animationDefaults })
      .set(marqueeRef.current, { y: '-101%' }, 0)
      .set(marqueeInnerRef.current, { y: '101%' }, 0)
      .to([marqueeRef.current, marqueeInnerRef.current], { y: '0%' }, 0);
  };

  const handleBlur = () => {
    if (!marqueeRef.current || !marqueeInnerRef.current) return;
    pauseMarquee();
    gsap
      .timeline({ defaults: animationDefaults })
      .to(marqueeRef.current, { y: '-101%' }, 0)
      .to(marqueeInnerRef.current, { y: '101%' }, 0);
  };

  return (
    <div className="menu__item" ref={itemRef} style={{ borderColor }}>
      <Link
        className="menu__item-link"
        href={link}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{ color: textColor }}
      >
        {text}
      </Link>
      <div className="marquee" ref={marqueeRef} style={{ backgroundColor: marqueeBgColor }}>
        <div className="marquee__inner-wrap">
          <div className="marquee__inner" ref={marqueeInnerRef} aria-hidden="true">
            {[...Array(repetitions)].map((_, idx) => (
              <div className="marquee__part" key={idx} style={{ color: marqueeTextColor }}>
                <span>{text}</span>
                <div className="marquee__img" style={{ backgroundImage: `url(${image})` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
