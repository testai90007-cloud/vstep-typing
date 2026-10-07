-- ---------------------------------------------------------------------------
-- VSTEP practice app schema (v2 — Google OAuth identity).
-- Idempotent: safe to run multiple times.
-- Apply with:  psql "$DATABASE_URL" -f schema.sql
-- (or paste into the Neon SQL editor)
--
-- users.id = Google `sub` (stable per Google account).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT,
  name       TEXT,
  image      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS writing_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT REFERENCES users(id),
  template_id  TEXT,
  mode         TEXT,          -- 'whole' | 'sections' | 'exam'
  accuracy     REAL,          -- 0-100
  duration_sec INT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS speaking_sessions (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT REFERENCES users(id),
  part       INT,             -- 1 | 2 | 3
  prompt     TEXT,            -- the prompt/questions the user answered
  transcript TEXT,            -- Whisper transcription
  scores     JSONB,           -- {grammar, vocabulary, pronunciation, fluency, discourse_management}
  overall    REAL,            -- 0-10, mean rounded to nearest 0.5
  feedback   TEXT,            -- Vietnamese feedback
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writing_user ON writing_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speaking_user ON speaking_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS listening_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT REFERENCES users(id),
  test_id      TEXT,
  score        INT,
  total        INT,
  duration_sec INT,
  answers      JSONB,          -- {"1": 0, "2": 3, ...} question num -> chosen option
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listening_user ON listening_sessions(user_id, created_at DESC);
