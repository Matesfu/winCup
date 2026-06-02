-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 010: Per-room FIFA stage filter
--
-- Stores the FIFA scores/fixtures stage selected by each room host.
-- Each room tracks its own stage; changing one room does not affect others.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS fifa_stage text NOT NULL DEFAULT 'First Stage'
  CHECK (
    fifa_stage IN (
      'First Stage',
      'Round of 32',
      'Round of 16',
      'Quarter-final',
      'Semi-final',
      'Play-off for third place',
      'Final'
    )
  );

COMMENT ON COLUMN rooms.fifa_stage IS 'Host-selected FIFA scores/fixtures stage filter for this room.';
