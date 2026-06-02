-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 008: Add UNIQUE constraint to room_teams
--
-- The room_teams table was missing a UNIQUE (room_id, country_code) constraint.
-- Without it, any Supabase/PostgREST upsert that specified onConflict on these
-- columns would fail at the database level, causing the "Failed to build
-- bracket" error in buildKnockout().
--
-- Idempotent: the IF NOT EXISTS guard prevents errors on re-run.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'room_teams_room_id_country_code_key'
      AND conrelid = 'room_teams'::regclass
  ) THEN
    ALTER TABLE room_teams
      ADD CONSTRAINT room_teams_room_id_country_code_key
      UNIQUE (room_id, country_code);
  END IF;
END $$;
