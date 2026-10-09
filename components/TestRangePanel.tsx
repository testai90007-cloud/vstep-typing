'use client';

// TestRangePanel — adapted from the Cult UI side-panel component
// (https://www.cult-ui.com/docs/components/side-panel, MIT licensed).
// A slim tab fixed in the empty left margin (wide screens only) that expands
// with a motion width animation to reveal quick-jump test ranges
// ("Tất cả", "291 – 300", ...). Converted to TypeScript + vanilla CSS,
// theme-aware via the site's CSS variables. No react-use-measure — the width
// animates between two fixed values instead.

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListBulletIcon, XMarkIcon } from '@heroicons/react/24/outline';
import './TestRangePanel.css';

export interface TestRange {
  key: string;
  label: string;
  from: number;
  to: number;
}

/** Extract the first number from a test title ("Đề 300" → 300, "Đề 001" → 1). NaN when none. */
export function parseTestNum(title: string): number {
  const m = title.match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
}

/** Build descending ranges of `size` covering the max number ("291 – 300" … "1 – 10"). */
export function buildRanges(nums: number[], size = 10): TestRange[] {
  const valid = nums.filter((n) => !isNaN(n));
  if (!valid.length) return [];
  const max = Math.max(...valid);
  const ranges: TestRange[] = [];
  for (let top = Math.ceil(max / size) * size; top >= size; top -= size) {
    const from = top - size + 1;
    ranges.push({ key: `${from}-${top}`, label: `${from} – ${top}`, from, to: top });
  }
  return ranges;
}

/** Shared range-filter state for the 4 test list pages. */
export function useTestRangeFilter<T extends { id: string; title: string }>(tests: T[]) {
  const [rangeKey, setRangeKey] = useState<string | null>(null);
  const nums = useMemo(() => tests.map((t) => parseTestNum(t.title)), [tests]);
  const ranges = useMemo(() => buildRanges(nums, 10), [nums]);
  const active = ranges.find((r) => r.key === rangeKey) ?? null;
  const visible = useMemo(
    () =>
      active
        ? tests.filter((_, i) => {
            const n = nums[i];
            return n >= active.from && n <= active.to;
          })
        : tests,
    [tests, nums, active]
  );
  return { rangeKey, setRangeKey, ranges, active, visible, nums };
}

interface TestRangePanelProps {
  nums: number[];
  total: number;
  activeKey: string | null;
  onSelect: (key: string | null) => void;
}

export default function TestRangePanel({ nums, total, activeKey, onSelect }: TestRangePanelProps) {
  const [open, setOpen] = useState(false);
  const ranges = useMemo(() => buildRanges(nums, 10), [nums]);
  if (!ranges.length) return null;

  return (
    <div className="trp-wrap" aria-hidden={false}>
      <motion.aside
        className="test-range-panel"
        initial={false}
        animate={{ width: open ? 236 : 54 }}
        transition={{ duration: 0.32, ease: [0.42, 0, 0.58, 1] }}
        aria-label="Chọn khoảng đề"
      >
        <button
          type="button"
          className="trp-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Đóng bảng chọn khoảng đề' : 'Mở bảng chọn khoảng đề'}
          title={open ? 'Đóng' : 'Chọn khoảng đề'}
        >
          {open ? (
            <XMarkIcon width={20} height={20} />
          ) : (
            <ListBulletIcon width={20} height={20} />
          )}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              className="trp-body"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.22, delay: 0.06 }}
            >
              <button
                type="button"
                className={`trp-range${activeKey === null ? ' active' : ''}`}
                onClick={() => onSelect(null)}
              >
                Tất cả · {total}
              </button>
              <div className="trp-ranges">
                {ranges.map((r) => (
                  <button
                    type="button"
                    key={r.key}
                    className={`trp-range${activeKey === r.key ? ' active' : ''}`}
                    onClick={() => onSelect(r.key)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </div>
  );
}
