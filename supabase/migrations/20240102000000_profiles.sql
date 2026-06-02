-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 004: Profiles
-- One row per auth user. Stores the username chosen at sign-up.
-- Email lives only in auth.users — not exposed in any public table.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text        UNIQUE NOT NULL
               CHECK (char_length(trim(username)) BETWEEN 3 AND 30)
               CHECK (username ~ '^[a-zA-Z0-9_]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  profiles           IS 'Public profile for each auth user. Username is permanent in Phase 1.';
COMMENT ON COLUMN profiles.username  IS 'Unique, alphanumeric+underscore, 3–30 chars. Stored lower-cased for lookups.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for username-uniqueness check on sign-up page)
CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

-- A user can only insert their own profile row
CREATE POLICY "profiles_own_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Usernames are permanent in Phase 1 — no UPDATE policy

-- ── Index ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON profiles (lower(username));

-- ── Username → email lookup function ─────────────────────────────────────────
-- SECURITY DEFINER: executes as the DB owner so it can access auth.users.
-- Called only by the service role from the signIn Server Action.
-- Revoked from anon/authenticated to prevent direct browser queries.
CREATE OR REPLACE FUNCTION lookup_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM   auth.users u
  JOIN   profiles   p ON p.id = u.id
  WHERE  lower(p.username) = lower(trim(p_username))
  LIMIT  1;
$$;

REVOKE EXECUTE ON FUNCTION lookup_email_by_username(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION lookup_email_by_username(text) TO service_role;
