-- ============================================================
-- Chess Advisor: Google Auth + One-time Chess ID Edit Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Allow password_hash to be null (Google-only users have no password)
ALTER TABLE public.app_users
  ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Add Google subject identifier (nullable, unique)
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;

-- 3. Add one-time-edit counters on players (0 = never edited, 1 = locked)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS chess_username_changes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS lichess_username_changes INTEGER NOT NULL DEFAULT 0;
