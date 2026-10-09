'use client';

// AnimatedList — adapted from the Magic UI Animated List component
// (https://magicui.design/docs/components/animated-list, ISC licensed).
// The original loops forever as a notification demo; this adaptation adds a
// `loop` prop (default false) for a one-pass staggered reveal: items spring
// in one after another when scrolled into view, then stay put — matching the
// site's understated taste. Converted to TypeScript + vanilla CSS.

import { Children, isValidElement, type ReactNode } from 'react';
import { motion } from 'motion/react';
import './AnimatedList.css';

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  /** ms between each item's reveal */
  delay?: number;
  /** when true, restarts the reveal after the last item (original behavior) */
  loop?: boolean;
}

export default function AnimatedList({
  children,
  className = '',
  delay = 120,
  loop = false,
}: AnimatedListProps) {
  const items = Children.toArray(children).filter(isValidElement);

  return (
    <div className={`animated-list${className ? ` ${className}` : ''}`}>
      {items.map((child, i) => (
        <motion.div
          key={child.key ?? i}
          initial={{ opacity: 0, y: 16, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: !loop, margin: '-32px' }}
          transition={{
            type: 'spring',
            stiffness: 280,
            damping: 28,
            delay: (i * delay) / 1000,
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
