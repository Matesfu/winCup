-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 007: Realtime for Knockout Ladder (Phase 5)
--
-- Adds room_teams and matches to the supabase_realtime publication so that
-- UPDATE events (team advancement/elimination) and INSERT/UPDATE events
-- (match results) broadcast to all ladder page subscribers.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_teams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_teams;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE matches;
  END IF;
END $$;
