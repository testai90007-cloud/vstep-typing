-- Migration 002: listening practice sessions (idempotent).
CREATE TABLE IF NOT EXISTS listening_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT REFERENCES users(id),
  test_id      TEXT,
  score        INT,
  total        INT,
  duration_sec INT,
  answers      JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listening_user ON listening_sessions(user_id, created_at DESC);
