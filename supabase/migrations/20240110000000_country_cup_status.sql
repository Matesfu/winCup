ALTER TABLE countries
  ADD COLUMN IF NOT EXISTS is_knocked_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN countries.is_knocked_out IS
  'Global World Cup status. True means the country is knocked out and cannot be selected for new rooms.';

CREATE INDEX IF NOT EXISTS idx_countries_is_knocked_out
  ON countries (is_knocked_out);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'countries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE countries;
  END IF;
END $$;
