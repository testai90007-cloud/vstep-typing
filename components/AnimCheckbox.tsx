'use client';

// AnimCheckbox — animated checkbox in the spirit of Spell UI's Animated
// Checkbox (https://spell.sh/docs/animated-checkbox): the tick draws with a
// spring and a strike-through line sweeps across the label when checked.
// Used here as a drill-progress readout (checked = word already drilled),
// so it renders non-interactive by default; pass onCheckedChange to make it
// a real toggle.

import { motion } from 'motion/react';
import './AnimCheckbox.css';

interface AnimCheckboxProps {
  title: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  small?: boolean;
}

export function AnimCheckbox({
  title,
  checked,
  onCheckedChange,
  small = false,
}: AnimCheckboxProps) {
  const interactive = typeof onCheckedChange === 'function';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={title}
      tabIndex={interactive ? 0 : -1}
      className={`anim-cb${checked ? ' checked' : ''}${small ? ' sm' : ''}${
        interactive ? '' : ' static'
      }`}
      onClick={() => onCheckedChange?.(!checked)}
    >
      <span className="cb-box" aria-hidden="true">
        <motion.svg
          viewBox="0 0 16 16"
          className="cb-tick"
          initial={false}
          animate={checked ? 'checked' : 'unchecked'}
        >
          <motion.path
            d="M3.5 8.5l3.2 3.2L12.5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              checked: { pathLength: 1, opacity: 1 },
              unchecked: { pathLength: 0, opacity: 0 },
            }}
            transition={{ type: 'spring', bounce: 0.35, duration: 0.45 }}
          />
        </motion.svg>
      </span>
      <span className="cb-title">
        <span className="cb-word">{title}</span>
        <span className="cb-strike" aria-hidden="true" />
      </span>
    </button>
  );
}
