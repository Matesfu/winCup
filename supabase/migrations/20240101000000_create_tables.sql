-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 001: Create Tables
-- Run once per Supabase project. Idempotent via IF NOT EXISTS guards.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Countries (shared reference table, seeded once) ─────────────────────────
CREATE TABLE IF NOT EXISTS countries (
  code             text PRIMARY KEY,
  name             text NOT NULL,
  flag_emoji       text NOT NULL,
  external_team_id integer          -- football-data.org team id; populated via admin sync
);

COMMENT ON TABLE  countries                   IS 'All playable nations. Shared across all rooms. Seeded once.';
COMMENT ON COLUMN countries.external_team_id  IS 'football-data.org team identifier for automated match ingestion.';

-- ─── Rooms ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    text        UNIQUE NOT NULL,
  host_user_id            uuid        NOT NULL,             -- = auth.uid() of the host
  host_name               text        NOT NULL,
  host_secret             text,                             -- optional secondary share-link guard
  status                  text        NOT NULL DEFAULT 'lobby'
                            CHECK (status IN ('lobby', 'drawn', 'group_stage', 'knockout', 'finished')),
  win_rule                text        NOT NULL DEFAULT 'last_standing'
                            CHECK (win_rule IN ('strict', 'last_standing')),
  stake_amount            numeric,                          -- display only; no payment processing
  external_competition_id integer,                          -- football-data.org competition id
  external_season_id      integer,                          -- football-data.org season id
  winner_player_id        uuid,                             -- null until resolved
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  rooms                         IS 'One room per game session. Host-owned.';
COMMENT ON COLUMN rooms.host_secret             IS 'Secondary share-link guard. Never expose to non-host clients.';
COMMENT ON COLUMN rooms.stake_amount            IS 'Display only. WinCup does not process payments.';

-- Block host_secret from non-privileged roles at the column level.
-- RLS policies apply on top of this; this is a belt-and-suspenders layer.
REVOKE SELECT (host_secret) ON rooms FROM authenticated, anon;
GRANT  SELECT (host_secret) ON rooms TO service_role;

-- ─── Players ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id          uuid,                                    -- auth.uid() of this player's session
  name             text        NOT NULL
                     CHECK (char_length(trim(name)) BETWEEN 1 AND 40),
  avatar_emoji     text,
  assigned_country text        REFERENCES countries(code),  -- set at draw time
  is_eliminated    boolean     NOT NULL DEFAULT false,
  joined_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  players                    IS 'One row per player per room.';
COMMENT ON COLUMN players.user_id            IS 'auth.uid() — anonymous sessions are allowed.';
COMMENT ON COLUMN players.assigned_country   IS 'Set once by the secure draw. Never re-assigned.';

-- ─── Room Countries (the host-selected group-stage pool) ──────────────────────
CREATE TABLE IF NOT EXISTS room_countries (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      uuid    NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  country_code text    NOT NULL REFERENCES countries(code),
  qualified    boolean,                                     -- null=undecided | true=qualified | false=eliminated
  UNIQUE (room_id, country_code)
);

COMMENT ON TABLE  room_countries           IS 'Countries selected by the host for the draw pool.';
COMMENT ON COLUMN room_countries.qualified IS 'null until group stage resolves. true = went to knockout; false = eliminated in groups.';

-- ─── Room Teams (knockout bracket slots) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_teams (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          uuid    NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  country_code     text    NOT NULL REFERENCES countries(code),
  player_id        uuid    REFERENCES players(id),          -- NULL = filler (no player attached)
  bracket_position int     NOT NULL,                        -- 1..16 for Round of 16
  current_stage    text    NOT NULL DEFAULT 'r16'
                     CHECK (current_stage IN ('r16', 'qf', 'sf', 'final', 'champion', 'out')),
  is_eliminated    boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE  room_teams                  IS 'Knockout bracket slots. Mix of player-owned and filler teams.';
COMMENT ON COLUMN room_teams.player_id        IS 'NULL = filler team (no player). Non-null = player owns this country.';
COMMENT ON COLUMN room_teams.bracket_position IS '1-based position in the bracket (1..16 for R16).';

-- ─── Matches ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           uuid    NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  external_match_id integer,                                -- football-data.org match id (idempotency key)
  stage             text    NOT NULL
                      CHECK (stage IN ('r16', 'qf', 'sf', 'final')),
  team_a_code       text    REFERENCES countries(code),
  team_b_code       text    REFERENCES countries(code),
  winner_code       text    REFERENCES countries(code),     -- null until decided
  bracket_position  int,                                    -- slot the winner advances into
  match_order       int,                                    -- ordering within a stage
  UNIQUE (room_id, external_match_id)
);

COMMENT ON TABLE  matches                   IS 'Knockout match records. Upserted idempotently by the cron ingest.';
COMMENT ON COLUMN matches.external_match_id IS 'football-data.org match id. UNIQUE per room for idempotent ingest.';

-- ─── Indices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rooms_code
  ON rooms (code);

CREATE INDEX IF NOT EXISTS idx_rooms_status
  ON rooms (status);

CREATE INDEX IF NOT EXISTS idx_players_room_id
  ON players (room_id);

CREATE INDEX IF NOT EXISTS idx_players_user_id
  ON players (user_id);

CREATE INDEX IF NOT EXISTS idx_room_countries_room_id
  ON room_countries (room_id);

CREATE INDEX IF NOT EXISTS idx_room_teams_room_id
  ON room_teams (room_id);

CREATE INDEX IF NOT EXISTS idx_matches_room_stage
  ON matches (room_id, stage);

CREATE INDEX IF NOT EXISTS idx_matches_external_id
  ON matches (external_match_id)
  WHERE external_match_id IS NOT NULL;
