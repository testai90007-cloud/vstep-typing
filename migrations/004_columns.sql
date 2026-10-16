-- Migration 004: columns added after the initial schema (idempotent).
-- Brings databases created from an older schema.sql up to the complete
-- schema in schema.sql. Safe to run multiple times.
--
-- NOTE: 003_reading.sql already created reading_sessions without `mode`;
-- the CREATE TABLE below is a no-op there and the ALTER adds `mode`.

CREATE TABLE IF NOT EXISTS reading_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT REFERENCES users(id),
  test_id      TEXT,
  score        INT,
  total        INT,
  duration_sec INT,
  answers      JSONB,
  mode         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reading_user ON reading_sessions(user_id, created_at DESC);

ALTER TABLE writing_sessions ADD COLUMN IF NOT EXISTS ai_score REAL;
ALTER TABLE writing_sessions ADD COLUMN IF NOT EXISTS ai_part1 REAL;
ALTER TABLE writing_sessions ADD COLUMN IF NOT EXISTS ai_part2 REAL;
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS mode TEXT;
ALTER TABLE listening_sessions ADD COLUMN IF NOT EXISTS mode TEXT;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS mode TEXT;
