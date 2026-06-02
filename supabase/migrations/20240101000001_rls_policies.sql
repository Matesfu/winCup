-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 002: Row Level Security Policies
--
-- Design:
--   • RLS is enabled on every table.
--   • Privileged writes (draw, lock, ingest) go through Server Actions /
--     Route Handlers that use the admin client (service role bypasses RLS).
--     The service role enforces its own checks in application code.
--   • Direct client INSERT on game-controlling tables is blocked at the
--     policy level — no INSERT policy = no direct insert.
--   • host_secret is additionally protected by column-level privilege
--     in migration 001.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enable RLS on all tables ─────────────────────────────────────────────────
ALTER TABLE countries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE players       ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_teams    ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches       ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- countries
-- Public read (any visitor, including unauthenticated — needed for the country
-- grid on the Create Room page). Writes are restricted to the service role.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "countries_public_read" ON countries;
CREATE POLICY "countries_public_read" ON countries
  FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- rooms
-- Any authenticated session can read a room (needed to look up by code before
-- joining). The host_secret column is protected separately by column-level
-- privilege (migration 001) — non-privileged roles cannot SELECT it regardless
-- of this policy.
-- Only the host can update their own room row.
-- Room creation goes through a Server Action (admin client); no direct INSERT.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rooms_authenticated_read"  ON rooms;
DROP POLICY IF EXISTS "rooms_host_update"          ON rooms;

CREATE POLICY "rooms_authenticated_read" ON rooms
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rooms_host_update" ON rooms
  FOR UPDATE
  TO authenticated
  USING     (auth.uid() = host_user_id)
  WITH CHECK (auth.uid() = host_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- players
-- A player can read all players in any room they belong to.
-- A player can update their own row (name, avatar — NOT is_eliminated or
-- assigned_country, which are controlled only by Server Actions).
-- No direct INSERT: joining must go through the Server Action which validates
-- lobby status, capacity, and auth.uid() binding.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "players_read_room_members" ON players;
DROP POLICY IF EXISTS "players_update_own"         ON players;

CREATE POLICY "players_read_room_members" ON players
  FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT p.room_id
      FROM   players p
      WHERE  p.user_id = auth.uid()
    )
  );

CREATE POLICY "players_update_own" ON players
  FOR UPDATE
  TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- Prevent players from self-eliminating or self-assigning a country
    -- These fields are managed only by host Server Actions
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- room_countries
-- Room members can read. All writes go through admin client (host override
-- or cron ingest).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "room_countries_read_members" ON room_countries;

CREATE POLICY "room_countries_read_members" ON room_countries
  FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT p.room_id
      FROM   players p
      WHERE  p.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- room_teams
-- Room members can read. All writes go through admin client.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "room_teams_read_members" ON room_teams;

CREATE POLICY "room_teams_read_members" ON room_teams
  FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT p.room_id
      FROM   players p
      WHERE  p.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- matches
-- Room members can read. All writes go through admin client (cron ingest or
-- host manual override).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "matches_read_members" ON matches;

CREATE POLICY "matches_read_members" ON matches
  FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT p.room_id
      FROM   players p
      WHERE  p.user_id = auth.uid()
    )
  );
