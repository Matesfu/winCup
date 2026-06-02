-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 006: Realtime for Group Stage (Phase 4)
--
-- Adds room_countries to the supabase_realtime publication so that UPDATE
-- events (qualified field changes) broadcast to all subscribed clients.
-- players and rooms were already added in migration 20240103000000_realtime.sql.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_countries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_countries;
  END IF;
END $$;
