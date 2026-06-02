-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 005: Enable Realtime for Phase 2
--
-- Adds players and rooms to the supabase_realtime publication so that
-- postgres_changes events are emitted to subscribing clients.
--
-- players  → INSERT events for new players joining the lobby
-- rooms    → UPDATE events for status transitions (e.g. lobby → drawn)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- players: broadcast new player joins to all lobby participants
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE players;
  END IF;

  -- rooms: broadcast status changes so all clients can redirect together
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  END IF;
END $$;
