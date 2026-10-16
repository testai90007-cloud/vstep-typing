// ---------------------------------------------------------------------------
// Vocabulary gamification: XP, learner levels, frames, bonuses.
// All progress math lives here — the /api/vocab/progress route and the
// offline client path both use applyProgressUpdate, so server and local
// storage can never drift apart.
//
// Two "levels" exist in the app and must not be confused:
// - VocabLevel (A1–C1): difficulty of a WORD.
// - Learner level (1–10): rank of the USER, derived from total XP.
// ---------------------------------------------------------------------------

import type { VocabLevel } from './vocab';

export const XP_PER_CORRECT = 10;
export const XP_PER_PAIR = 5;
export const XP_PER_FLASHCARD = 5;

export interface LearnerLevel {
  level: number;
  name: string;
  /** Cumulative XP required to reach this level. */
  xp: number;
}

export const LEVELS: LearnerLevel[] = [
  { level: 1, name: 'Mới bắt đầu', xp: 0 },
  { level: 2, name: 'Tập sự', xp: 200 },
  { level: 3, name: 'Chăm chỉ', xp: 500 },
  { level: 4, name: 'Vững vàng', xp: 900 },
  { level: 5, name: 'Thành thạo', xp: 1500 },
  { level: 6, name: 'Nâng cao', xp: 2300 },
  { level: 7, name: 'Chuyên gia', xp: 3300 },
  { level: 8, name: 'Xuất sắc', xp: 4600 },
  { level: 9, name: 'Kiệt xuất', xp: 6200 },
  { level: 10, name: 'Bậc thầy từ vựng', xp: 8000 },
];

export type FrameUnlock = 'level' | 'streak' | 'conquer';

export interface Frame {
  id: string;
  name: string;
  unlock: FrameUnlock;
  /** Learner level, streak days, or conquered VocabLevel. */
  value: number | VocabLevel;
}

export const FRAMES: Frame[] = [
  { id: 'wood', name: 'Khung Gỗ', unlock: 'level', value: 1 },
  { id: 'bronze', name: 'Khung Đồng', unlock: 'level', value: 3 },
  { id: 'silver', name: 'Khung Bạc', unlock: 'level', value: 5 },
  { id: 'gold', name: 'Khung Vàng', unlock: 'level', value: 7 },
  { id: 'platinum', name: 'Khung Bạch kim', unlock: 'level', value: 9 },
  { id: 'diamond', name: 'Khung Kim cương', unlock: 'level', value: 10 },
  { id: 'fire', name: 'Khung Lửa', unlock: 'streak', value: 7 },
  { id: 'crown', name: 'Khung Vương miện', unlock: 'conquer', value: 'C1' },
];

export const BONUSES = {
  daily: 20,
  streak3: 30,
  streak7: 100,
  streak30: 500,
  perfect: 50,
  conquerLevel: 500,
  clearReview: 30,
  levelUpPerLevel: 50,
};

export type VocabAnswerKind = 'flashcard' | 'quiz' | 'listening' | 'fill' | 'matching' | 'synant';

export interface VocabProgressEntry {
  status: 'new' | 'learning' | 'mastered';
  correct: number;
  wrong: number;
  /** ISO timestamp of the last answer, or null when never answered. */
  last_seen: string | null;
}

export interface VocabStats {
  xp: number;
  level: number;
  streak: number;
  /** Local date 'YYYY-MM-DD' of the last day the user played, or null. */
  lastPlayedDate: string | null;
  framesUnlocked: string[];
  activeFrame: string;
  /** Streak milestones already awarded in the current streak (3, 7, 30). */
  awardedStreakMilestones?: number[];
  /** CEFR levels whose conquer bonus was already awarded (once ever). */
  awardedConquered?: VocabLevel[];
}

export function defaultStats(): VocabStats {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    lastPlayedDate: null,
    framesUnlocked: ['wood'],
    activeFrame: 'wood',
    awardedStreakMilestones: [],
    awardedConquered: [],
  };
}

/** Learner level for a total XP amount. */
export function levelForXp(xp: number): number {
  let level = 1;
  for (const l of LEVELS) {
    if (xp >= l.xp) level = l.level;
  }
  return level;
}

/** XP awarded for one correct answer of the given game kind. */
export function xpForKind(kind: VocabAnswerKind): number {
  if (kind === 'flashcard') return XP_PER_FLASHCARD;
  if (kind === 'matching') return XP_PER_PAIR;
  return XP_PER_CORRECT;
}

/** Frame ids the given stats have unlocked. */
export function unlockedFrames(stats: VocabStats): string[] {
  const conquered = stats.awardedConquered ?? [];
  return FRAMES.filter((f) => {
    if (f.unlock === 'level') return stats.level >= (f.value as number);
    if (f.unlock === 'streak') return stats.streak >= (f.value as number);
    return conquered.includes(f.value as VocabLevel);
  }).map((f) => f.id);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ProgressInput {
  word: string;
  correct: boolean;
  kind: VocabAnswerKind;
  perfect?: boolean;
  reviewCleared?: boolean;
  conqueredLevel?: VocabLevel | null;
  /** Current date 'YYYY-MM-DD' (server UTC or client local — caller decides). */
  today: string;
}

export interface ProgressUpdateResult {
  stats: VocabStats;
  gained: number;
  leveledUp: boolean;
  newLevel: number;
  /** First newly unlocked frame, or null. */
  unlockedFrame: string | null;
  bonuses: { label: string; xp: number }[];
  entry: VocabProgressEntry;
}

/**
 * Pure progress update: given current stats + previous per-word entry and
 * one answer, return the new stats, the updated entry, XP gained and the
 * bonus breakdown. Used by both the server route and the offline client.
 */
export function applyProgressUpdate(
  stats: VocabStats,
  prevEntry: VocabProgressEntry | null,
  input: ProgressInput
): ProgressUpdateResult {
  const entry: VocabProgressEntry = {
    status: prevEntry?.status ?? 'new',
    correct: (prevEntry?.correct ?? 0) + (input.correct ? 1 : 0),
    wrong: (prevEntry?.wrong ?? 0) + (input.correct ? 0 : 1),
    last_seen: new Date().toISOString(),
  };
  if (input.correct) {
    entry.status = entry.correct >= 3 ? 'mastered' : 'learning';
  } else {
    entry.status = 'learning';
  }

  const bonuses: { label: string; xp: number }[] = [];
  let gained = 0;
  const addBonus = (label: string, xp: number) => {
    if (xp > 0) {
      bonuses.push({ label, xp });
      gained += xp;
    }
  };

  if (input.correct) addBonus('Trả lời đúng', xpForKind(input.kind));
  if (input.perfect) addBonus('Ván hoàn hảo', BONUSES.perfect);
  if (input.reviewCleared) addBonus('Xóa sạch hàng đợi ôn', BONUSES.clearReview);

  // Daily check-in + streak. A new streak cycle resets awarded milestones.
  let streak = stats.streak;
  let lastPlayedDate = stats.lastPlayedDate;
  let awardedStreak = [...(stats.awardedStreakMilestones ?? [])];
  if (lastPlayedDate !== input.today) {
    if (lastPlayedDate === shiftDate(input.today, -1)) {
      streak = streak + 1;
    } else {
      streak = 1;
      awardedStreak = [];
    }
    lastPlayedDate = input.today;
    addBonus('Điểm danh hằng ngày', BONUSES.daily);
  }
  const streakBonus: Record<number, number> = {
    3: BONUSES.streak3,
    7: BONUSES.streak7,
    30: BONUSES.streak30,
  };
  if (streakBonus[streak] && !awardedStreak.includes(streak)) {
    awardedStreak.push(streak);
    addBonus(`Chuỗi ${streak} ngày`, streakBonus[streak]);
  }

  // Conquer bonus: once ever per CEFR level.
  let awardedConquered = [...(stats.awardedConquered ?? [])];
  if (input.conqueredLevel && !awardedConquered.includes(input.conqueredLevel)) {
    awardedConquered.push(input.conqueredLevel);
    addBonus(`Chinh phục ${input.conqueredLevel}`, BONUSES.conquerLevel);
  }

  // Level-up: awarded once per crossing, on the level computed before the
  // level-up bonus itself (no chained level-up bonuses in one update).
  const levelBefore = levelForXp(stats.xp);
  let xp = stats.xp + gained;
  let leveledUp = false;
  let newLevel = levelBefore;
  const computed = levelForXp(xp);
  if (computed > levelBefore) {
    leveledUp = true;
    newLevel = computed;
    const lvlBonus = BONUSES.levelUpPerLevel * computed;
    addBonus(`Lên cấp ${computed}`, lvlBonus);
    xp += lvlBonus;
    newLevel = levelForXp(xp);
  }

  const nextStats: VocabStats = {
    ...stats,
    xp,
    level: newLevel,
    streak,
    lastPlayedDate,
    awardedStreakMilestones: awardedStreak,
    awardedConquered,
  };
  const framesUnlocked = Array.from(new Set([...stats.framesUnlocked, ...unlockedFrames(nextStats)]));
  nextStats.framesUnlocked = framesUnlocked;
  const unlockedFrame = framesUnlocked.find((f) => !stats.framesUnlocked.includes(f)) ?? null;

  return { stats: nextStats, gained, leveledUp, newLevel, unlockedFrame, bonuses, entry };
}
