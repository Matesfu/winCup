ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS room_name text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'random'
    CHECK (assignment_mode IN ('random', 'player_choice')),
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

UPDATE rooms
SET room_name = COALESCE(NULLIF(trim(room_name), ''), host_name || '''s room')
WHERE room_name IS NULL OR trim(room_name) = '';

ALTER TABLE rooms
  ALTER COLUMN room_name SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rooms_room_name_length'
  ) THEN
    ALTER TABLE rooms
      ADD CONSTRAINT rooms_room_name_length
      CHECK (char_length(trim(room_name)) BETWEEN 1 AND 60);
  END IF;
END $$;

COMMENT ON COLUMN rooms.room_name IS 'Host-provided display name used for dashboard discovery and room cards.';
COMMENT ON COLUMN rooms.visibility IS 'public rooms appear in dashboard discovery while in lobby; private rooms require a code/link.';
COMMENT ON COLUMN rooms.assignment_mode IS 'random = system assigns countries; player_choice = joiners pick countries.';
COMMENT ON COLUMN rooms.started_at IS 'Timestamp when the room leaves the lobby.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_room_assigned_country_unique
  ON players (room_id, assigned_country)
  WHERE assigned_country IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_room_user_unique
  ON players (room_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_public_lobby_discovery
  ON rooms (visibility, status, stake_amount, created_at DESC)
  WHERE visibility = 'public' AND status = 'lobby';

CREATE INDEX IF NOT EXISTS idx_rooms_assignment_mode
  ON rooms (assignment_mode);

CREATE INDEX IF NOT EXISTS idx_rooms_room_name_lower
  ON rooms (lower(room_name));
