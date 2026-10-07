-- Migration 003: reading practice sessions (idempotent).
CREATE TABLE IF NOT EXISTS reading_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT REFERENCES users(id),
  test_id      TEXT,
  score        INT,
  total        INT,
  duration_sec INT,
  answers      JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reading_user ON reading_sessions(user_id, created_at DESC);
