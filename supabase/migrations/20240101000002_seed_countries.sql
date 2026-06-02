-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 003: Seed Countries
-- Idempotent via ON CONFLICT DO NOTHING — safe to re-run.
-- external_team_id is null by default; populate via admin sync script once
-- a real football-data.org competition is chosen.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO countries (code, name, flag_emoji) VALUES
  ('ARG', 'Argentina',    '🇦🇷'),
  ('BRA', 'Brazil',       '🇧🇷'),
  ('FRA', 'France',       '🇫🇷'),
  ('ENG', 'England',      '🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
  ('GER', 'Germany',      '🇩🇪'),
  ('ESP', 'Spain',        '🇪🇸'),
  ('POR', 'Portugal',     '🇵🇹'),
  ('NED', 'Netherlands',  '🇳🇱'),
  ('BEL', 'Belgium',      '🇧🇪'),
  ('CRO', 'Croatia',      '🇭🇷'),
  ('MAR', 'Morocco',      '🇲🇦'),
  ('JPN', 'Japan',        '🇯🇵'),
  ('KOR', 'South Korea',  '🇰🇷'),
  ('USA', 'USA',          '🇺🇸'),
  ('MEX', 'Mexico',       '🇲🇽'),
  ('URU', 'Uruguay',      '🇺🇾'),
  ('SEN', 'Senegal',      '🇸🇳'),
  ('SUI', 'Switzerland',  '🇨🇭'),
  ('DEN', 'Denmark',      '🇩🇰'),
  ('POL', 'Poland',       '🇵🇱'),
  ('SRB', 'Serbia',       '🇷🇸'),
  ('GHA', 'Ghana',        '🇬🇭'),
  ('CMR', 'Cameroon',     '🇨🇲'),
  ('ECU', 'Ecuador',      '🇪🇨'),
  ('CAN', 'Canada',       '🇨🇦'),
  ('AUS', 'Australia',    '🇦🇺'),
  ('IRN', 'Iran',         '🇮🇷'),
  ('TUN', 'Tunisia',      '🇹🇳'),
  ('KSA', 'Saudi Arabia', '🇸🇦'),
  ('CRC', 'Costa Rica',   '🇨🇷'),
  ('NGA', 'Nigeria',      '🇳🇬'),
  ('EGY', 'Egypt',        '🇪🇬'),
  ('COL', 'Colombia',     '🇨🇴'),
  ('CHI', 'Chile',        '🇨🇱'),
  ('ITA', 'Italy',        '🇮🇹'),
  ('PER', 'Peru',         '🇵🇪')
ON CONFLICT (code) DO NOTHING;
