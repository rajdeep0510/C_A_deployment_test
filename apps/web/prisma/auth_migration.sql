-- ============================================================
-- Chess Advisor: Custom Auth Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Central auth identity (replaces auth.users for this app)
CREATE TABLE IF NOT EXISTS public.app_users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL,
  email_lower    TEXT UNIQUE GENERATED ALWAYS AS (lower(email)) STORED,
  password_hash  TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Server-side sessions (raw token goes in cookie; only hash stored here)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  user_agent   TEXT,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days',
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON public.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON public.user_sessions (expires_at);

-- 3. Email verification tokens (single-use, 24h TTL)
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evt_user_id_idx ON public.email_verification_tokens (user_id);

-- 4. Password reset tokens (single-use, 1h TTL)
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '1 hour',
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Seed app_users from existing auth.users (for all current staff profiles)
--    password_hash '[MIGRATED]' is a placeholder — these users must reset their password on first login.
--    email_lower is a generated column, do not include it in the INSERT.
INSERT INTO public.app_users (id, email, password_hash, email_verified, created_at)
SELECT
  u.id,
  u.email,
  '[MIGRATED]',
  true,
  COALESCE(u.created_at, now())
FROM auth.users u
INNER JOIN public.profiles p ON p.id = u.id
ON CONFLICT (id) DO NOTHING;

-- 6. Re-point profiles FK from auth.users → app_users
--    Now safe because app_users has been seeded above.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_app_user_fkey
    FOREIGN KEY (id) REFERENCES public.app_users(id) ON DELETE CASCADE;

-- 7. Add invite_code to profiles (was missing from schema)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- 8. Add email + user_id to players for new auth
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES public.app_users(id) ON DELETE SET NULL;
