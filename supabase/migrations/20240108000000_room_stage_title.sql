-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 009: Host-editable stage title
--
-- Lets the host label the live tournament tracking page, e.g.
-- "Group Stage", "Knockout Stage", or a custom room-specific name.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS stage_title text NOT NULL DEFAULT 'Group Stage'
  CHECK (char_length(trim(stage_title)) BETWEEN 1 AND 48);

COMMENT ON COLUMN rooms.stage_title IS 'Host-editable title shown on the live standings/status page.';
