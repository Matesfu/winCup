CREATE TABLE IF NOT EXISTS room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  sender_name text NOT NULL CHECK (char_length(trim(sender_name)) BETWEEN 1 AND 40),
  sender_avatar_emoji text,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE room_messages IS
  'Room-scoped plain text chat messages visible only to the room host and joined players.';

COMMENT ON COLUMN room_messages.sender_name IS
  'Snapshot of the sender display name at send time, kept stable for old messages.';

COMMENT ON COLUMN room_messages.sender_avatar_emoji IS
  'Snapshot of the sender avatar at send time, kept stable for old messages.';

CREATE INDEX IF NOT EXISTS idx_room_messages_room_created_at
  ON room_messages (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_messages_sender_user
  ON room_messages (sender_user_id);

ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_messages_read_members" ON room_messages;
CREATE POLICY "room_messages_read_members" ON room_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rooms r
      WHERE r.id = room_messages.room_id
        AND r.host_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM players p
      WHERE p.room_id = room_messages.room_id
        AND p.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;
  END IF;
END $$;
