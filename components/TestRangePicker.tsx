'use client';

// TestRangePicker — inline collapsible test browser replacing the always-visible
// 300-cell grid. Shows compact range pills ("Tất cả · 300", "291 – 300" … "1 – 10");
// clicking a pill reveals just that range's tests. Clicking the active pill again
// collapses. TypeScript + vanilla CSS, theme-aware via the site's CSS variables.

import { useMemo, useState } from 'react';
import './TestRangePicker.css';

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

/**
 * Shared collapsible range state for the 4 test list pages.
 * sel: 'all' → every test, range key → that range's tests, null → collapsed.
 */
export function useTestRangeFilter<T extends { id: string; title: string }>(tests: T[]) {
  const [sel, setSel] = useState<string | null>(null);
  const nums = useMemo(() => tests.map((t) => parseTestNum(t.title)), [tests]);
  const ranges = useMemo(() => buildRanges(nums, 10), [nums]);
  const visible = useMemo(() => {
    if (sel === 'all') return tests;
    const r = ranges.find((x) => x.key === sel);
    if (!r) return [];
    return tests.filter((_, i) => {
      const n = nums[i];
      return n >= r.from && n <= r.to;
    });
  }, [tests, nums, ranges, sel]);
  const toggle = (key: string) => {
    setSel((prev) => (prev === key ? null : key));
  };
  return { sel, toggle, ranges, visible, total: tests.length };
}

interface TestRangePickerProps {
  ranges: TestRange[];
  total: number;
  sel: string | null;
  onToggle: (key: string) => void;
}

export default function TestRangePicker({ ranges, total, sel, onToggle }: TestRangePickerProps) {
  if (!ranges.length) return null;
  return (
    <div className="range-pills" role="group" aria-label="Chọn khoảng đề">
      <button
        type="button"
        className={`range-pill${sel === 'all' ? ' active' : ''}`}
        onClick={() => onToggle('all')}
        aria-pressed={sel === 'all'}
      >
        Tất cả · {total}
      </button>
      {ranges.map((r) => (
        <button
          type="button"
          key={r.key}
          className={`range-pill${sel === r.key ? ' active' : ''}`}
          onClick={() => onToggle(r.key)}
          aria-pressed={sel === r.key}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
