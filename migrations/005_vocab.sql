-- Migration 005: vocabulary learning (idempotent).
-- vocab_cache: shared definition/etymology payloads, keyed by word.
-- vocab_progress: per-user per-word learning state.
-- vocab_user_stats: per-user XP, learner level, streak, unlocked frames.

CREATE TABLE IF NOT EXISTS vocab_cache (
  word TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vocab_progress (
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'learning',
  correct INT NOT NULL DEFAULT 0,
  wrong INT NOT NULL DEFAULT 0,
  last_seen TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, word)
);

CREATE TABLE IF NOT EXISTS vocab_user_stats (
  user_id TEXT PRIMARY KEY,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  streak INT NOT NULL DEFAULT 0,
  last_played_date DATE,
  frames_unlocked JSONB NOT NULL DEFAULT '["wood"]',
  active_frame TEXT NOT NULL DEFAULT 'wood',
  awarded_streak_milestones JSONB NOT NULL DEFAULT '[]',
  awarded_conquered JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_vocab_progress_user ON vocab_progress(user_id);
