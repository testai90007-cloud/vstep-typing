// Shared formatting / label constants — SINGLE SOURCE OF TRUTH.
// Previously MODE_LABEL, fmtDur and the speaking-criteria labels were
// duplicated in components/ProgressDashboard.tsx and
// components/HistoryTable.tsx with CONFLICTING mappings (the same session
// showed different mode text on /progress vs /lich-su). Import from here.

/**
 * Human-readable label for a session's `mode` value.
 *
 * Mapping choice: this is the mapping previously used in ProgressDashboard
 * (kept over HistoryTable's flatter one) because it preserves real
 * distinctions — 'whole' (Toàn bài) vs 'sections' (Từng phần) for typing
 * practice, and 'practice' (Đề thi · Luyện tập) vs 'mock' (Đề thi · Thi thử)
 * for mock tests — instead of collapsing them all to 'Luyện tập'/'Thi thử'.
 */
export const MODE_LABEL: Record<string, string> = {
  whole: 'Toàn bài',
  sections: 'Từng phần',
  exam: 'Thi thử',
  practice: 'Đề thi · Luyện tập',
  mock: 'Đề thi · Thi thử',
};

/** "m:ss" duration; null/undefined renders as an en dash. */
export function fmtDur(sec?: number | null): string {
  if (sec == null) return '–';
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

/** The 5 Speaking scoring criteria, in display order: [key, label]. */
export const SPEAK_CRIT: [string, string][] = [
  ['grammar', 'Ngữ pháp'],
  ['vocabulary', 'Từ vựng'],
  ['pronunciation', 'Phát âm'],
  ['fluency', 'Trôi chảy'],
  ['discourse_management', 'Mạch lạc'],
];

/** Same criteria as a key → label record (for components that index by key). */
export const SPEAK_LABEL: Record<string, string> = Object.fromEntries(SPEAK_CRIT);
