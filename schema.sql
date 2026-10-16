-- ---------------------------------------------------------------------------
-- VSTEP practice app schema (v2 — Google OAuth identity).
-- Idempotent: safe to run multiple times.
-- Apply with:  psql "$DATABASE_URL" -f schema.sql
-- (or paste into the Neon SQL editor)
--
-- users.id = Google `sub` (stable per Google account).
--
-- This file is the COMPLETE desired schema: it includes every table and
-- column the API routes query (reading_sessions, the `mode` columns, the
-- writing `ai_score` columns). Existing databases created from an older
-- version of this file should instead apply migrations/004_columns.sql,
-- which adds just the delta.
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
  mode         TEXT,          -- 'whole' | 'sections' | 'exam' | 'practice' | 'mock'
  accuracy     REAL,          -- 0-100
  duration_sec INT,
  ai_score     REAL,          -- AI essay score, 0-10 (set by a later update)
  ai_part1     REAL,          -- AI Task 1 score, 0-10
  ai_part2     REAL,          -- AI Task 2 score, 0-10
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
  mode       TEXT,            -- 'practice' | 'mock' | null
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listening_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT REFERENCES users(id),
  test_id      TEXT,
  score        INT,
  total        INT,
  duration_sec INT,
  answers      JSONB,          -- {"1": 0, "2": 3, ...} question num -> chosen option
  mode         TEXT,           -- 'practice' | 'mock' | null
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reading_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT REFERENCES users(id),
  test_id      TEXT,
  score        INT,
  total        INT,
  duration_sec INT,
  answers      JSONB,          -- {"1": 0, "2": 3, ...} question num -> chosen option
  mode         TEXT,           -- 'practice' | 'mock' | null
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writing_user ON writing_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speaking_user ON speaking_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listening_user ON listening_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_user ON reading_sessions(user_id, created_at DESC);
