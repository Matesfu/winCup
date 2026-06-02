-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Schema Assertion Tests
--
-- Run against a local Supabase instance after applying all migrations:
--   supabase db reset
--   psql "$DATABASE_URL" -f tests/integration/db/schema_assertions.sql
--
-- Each DO block raises an exception on failure, prints a success message on pass.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. All 6 tables exist ─────────────────────────────────────────────────────
DO $$
DECLARE
  tbl_count int;
BEGIN
  SELECT COUNT(*) INTO tbl_count
  FROM   information_schema.tables
  WHERE  table_schema = 'public'
    AND  table_name IN ('countries','rooms','players','room_countries','room_teams','matches');

  ASSERT tbl_count = 6,
    format('Expected 6 tables, found %s. Check migration 001.', tbl_count);

  RAISE NOTICE '[PASS] All 6 tables exist';
END $$;

-- ── 2. RLS enabled on every table ─────────────────────────────────────────────
DO $$
DECLARE
  rls_count int;
BEGIN
  SELECT COUNT(*) INTO rls_count
  FROM   pg_tables
  WHERE  schemaname = 'public'
    AND  rowsecurity = true
    AND  tablename IN ('countries','rooms','players','room_countries','room_teams','matches');

  ASSERT rls_count = 6,
    format('Expected RLS on all 6 tables, found %s with RLS. Check migration 002.', rls_count);

  RAISE NOTICE '[PASS] RLS enabled on all 6 tables';
END $$;

-- ── 3. rooms.code has UNIQUE constraint ───────────────────────────────────────
DO $$
DECLARE
  constraint_count int;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM   information_schema.table_constraints
  WHERE  constraint_type = 'UNIQUE'
    AND  table_schema = 'public'
    AND  table_name = 'rooms'
    AND  constraint_name LIKE '%code%';

  ASSERT constraint_count >= 1,
    'rooms.code UNIQUE constraint missing — cannot safely generate unique room codes';

  RAISE NOTICE '[PASS] rooms.code UNIQUE constraint present';
END $$;

-- ── 4. matches UNIQUE(room_id, external_match_id) ─────────────────────────────
DO $$
DECLARE
  constraint_count int;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM   information_schema.table_constraints
  WHERE  constraint_type = 'UNIQUE'
    AND  table_schema = 'public'
    AND  table_name = 'matches'
    AND  constraint_name LIKE '%external_match_id%';

  ASSERT constraint_count >= 1,
    'matches UNIQUE(room_id, external_match_id) missing — cron ingest cannot be idempotent';

  RAISE NOTICE '[PASS] matches UNIQUE(room_id, external_match_id) present';
END $$;

-- ── 5. 36 countries seeded ────────────────────────────────────────────────────
DO $$
DECLARE
  country_count int;
BEGIN
  SELECT COUNT(*) INTO country_count FROM countries;

  ASSERT country_count = 36,
    format('Expected 36 countries, found %s. Check migration 003.', country_count);

  RAISE NOTICE '[PASS] 36 countries seeded';
END $$;

-- ── 6. host_secret NOT selectable by authenticated/anon roles ─────────────────
DO $$
DECLARE
  grant_count int;
BEGIN
  SELECT COUNT(*) INTO grant_count
  FROM   information_schema.role_column_grants
  WHERE  table_schema = 'public'
    AND  table_name = 'rooms'
    AND  column_name = 'host_secret'
    AND  grantee IN ('authenticated', 'anon')
    AND  privilege_type = 'SELECT';

  ASSERT grant_count = 0,
    format(
      'SECURITY VIOLATION: host_secret is readable by %s non-privileged role(s). Check migration 001 REVOKE statement.',
      grant_count
    );

  RAISE NOTICE '[PASS] host_secret blocked from authenticated/anon roles';
END $$;

-- ── 7. countries table has public read policy ─────────────────────────────────
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM   pg_policies
  WHERE  schemaname = 'public'
    AND  tablename = 'countries'
    AND  cmd = 'SELECT';

  ASSERT policy_count >= 1,
    'countries table has no SELECT policy — country list will be inaccessible to clients';

  RAISE NOTICE '[PASS] countries has a SELECT policy';
END $$;

-- ── 8. rooms status CHECK constraint includes all valid values ─────────────────
DO $$
DECLARE
  check_count int;
BEGIN
  SELECT COUNT(*) INTO check_count
  FROM   information_schema.check_constraints cc
  JOIN   information_schema.constraint_column_usage ccu
    ON   cc.constraint_name = ccu.constraint_name
  WHERE  ccu.table_name = 'rooms'
    AND  ccu.column_name = 'status'
    AND  cc.check_clause LIKE '%lobby%'
    AND  cc.check_clause LIKE '%finished%';

  ASSERT check_count >= 1,
    'rooms.status CHECK constraint missing or incomplete';

  RAISE NOTICE '[PASS] rooms.status CHECK constraint present';
END $$;

-- ── 9. players name has length CHECK ─────────────────────────────────────────
DO $$
DECLARE
  check_count int;
BEGIN
  SELECT COUNT(*) INTO check_count
  FROM   information_schema.check_constraints cc
  JOIN   information_schema.constraint_column_usage ccu
    ON   cc.constraint_name = ccu.constraint_name
  WHERE  ccu.table_name = 'players'
    AND  ccu.column_name = 'name';

  ASSERT check_count >= 1,
    'players.name CHECK constraint missing — no server-side validation on name length';

  RAISE NOTICE '[PASS] players.name has CHECK constraint';
END $$;

-- ── 10. Key indices exist ─────────────────────────────────────────────────────
DO $$
DECLARE
  idx_count int;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM   pg_indexes
  WHERE  schemaname = 'public'
    AND  indexname IN (
      'idx_rooms_code',
      'idx_players_room_id',
      'idx_players_user_id',
      'idx_room_countries_room_id',
      'idx_room_teams_room_id',
      'idx_matches_room_stage'
    );

  ASSERT idx_count = 6,
    format('Expected 6 custom indices, found %s. Check migration 001.', idx_count);

  RAISE NOTICE '[PASS] All 6 key indices exist';
END $$;

SELECT '══════════════════════════════════════════════' AS separator;
SELECT 'All schema assertions passed ✓'               AS result;
