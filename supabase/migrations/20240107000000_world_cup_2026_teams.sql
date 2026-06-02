-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration 009: FIFA World Cup 2026 Qualified Teams
--
-- Adds the 22 additional qualified nations for the 48-team 2026 World Cup
-- (Canada/Mexico/USA co-hosts).  Idempotent via ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO countries (code, name, flag_emoji) VALUES
  -- UEFA (new qualifiers)
  ('TUR', 'Turkey',                  '🇹🇷'),
  ('NOR', 'Norway',                  '🇳🇴'),
  ('SWE', 'Sweden',                  '🇸🇪'),
  ('SCO', 'Scotland',                '🏴󠁧󠁢󠁳󠁣󠁴󠁿'),
  ('CZE', 'Czech Republic',          '🇨🇿'),
  ('BIH', 'Bosnia-Herzegovina',      '🇧🇦'),
  ('ROU', 'Romania',                 '🇷🇴'),
  -- CONMEBOL (new qualifier)
  ('PAR', 'Paraguay',                '🇵🇾'),
  ('VEN', 'Venezuela',               '🇻🇪'),
  -- CONCACAF (non-host qualifiers)
  ('PAN', 'Panama',                  '🇵🇦'),
  ('HON', 'Honduras',                '🇭🇳'),
  ('SLV', 'El Salvador',             '🇸🇻'),
  -- CAF (new qualifiers)
  ('RSA', 'South Africa',            '🇿🇦'),
  ('ALG', 'Algeria',                 '🇩🇿'),
  ('CIV', 'Ivory Coast',             '🇨🇮'),
  ('COD', 'DR Congo',                '🇨🇩'),
  -- AFC (new qualifiers)
  ('IRQ', 'Iraq',                    '🇮🇶'),
  ('JOR', 'Jordan',                  '🇯🇴'),
  ('UZB', 'Uzbekistan',              '🇺🇿'),
  ('QAT', 'Qatar',                   '🇶🇦'),
  -- OFC
  ('NZL', 'New Zealand',             '🇳🇿'),
  -- Inter-confederation playoff
  ('HAI', 'Haiti',                   '🇭🇹')
ON CONFLICT (code) DO NOTHING;
