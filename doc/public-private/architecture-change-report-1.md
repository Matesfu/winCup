# Public/Private Rooms and Assignment Modes: Implementation Report

## Summary

Implemented the first public/private room architecture change. WinCup now supports:

- `random` rooms, where the host chooses a country pool and the system assigns one live country per joined player.
- `player_choice` rooms, where each joining player selects an available country from the host-selected pool.
- `public` rooms, discoverable on the dashboard only while waiting in the lobby.
- `private` rooms, hidden from discovery and protected by code-based join access.
- Flexible country pools with a minimum of 2 countries and no hardcoded maximum.

## Database Work

Added `supabase/migrations/20240111000000_room_visibility_assignment_mode.sql`.

The migration adds:

- `rooms.room_name`
- `rooms.visibility`
- `rooms.assignment_mode`
- `rooms.started_at`
- Unique room/player safety indexes for assigned countries and authenticated membership.
- Public lobby discovery indexes for visibility, status, stake, date, assignment mode, and room-name search.

Also updated the schema assertion SQL in `tests/integration/db/schema_assertions.sql` to check the new columns, indexes, and global `countries.is_knocked_out` field.

## Application Changes

### Create Room

- Added room name, public/private visibility, and assignment mode controls.
- Reduced country selection minimum from 4 to 2.
- Removed the hardcoded country maximum.
- Added host country selection when the host is playing in `player_choice` mode.
- Prevented knocked-out countries from being selected.

### Join Room

- Added player-choice country selection.
- Disabled taken and globally knocked-out countries.
- Enforced capacity based on countries still in the cup.
- Added private-room code access using a short-lived HTTP-only cookie created by the room-code lookup action.

### Lobby

- Replaced the old “all selected countries must be filled” readiness rule.
- Random rooms can start when at least 2 players joined and player count is not greater than active countries.
- Player-choice rooms can start when at least 2 players have chosen countries.
- Player cards now show chosen countries in the lobby.
- Start button copy changes between `Start Draw` and `Start Room`.

### Dashboard

- Added “My Rooms” first, including hosted and joined rooms.
- Added public room discovery for lobby-only public rooms.
- Added filters for room name, assignment mode, stake range, date range, and sorting.
- Public rooms already joined by the user are excluded from discovery and remain in “My Rooms”.

## Validation

Passed:

- `npm run typecheck`
- `npm test -- --runInBand`
  - 35 test suites passed
  - 323 tests passed
- Targeted ESLint for the changed dashboard/helper/UI/page files.

Not fully passed:

- `npm run lint` still fails because the repo already has many broad lint issues, mostly `@typescript-eslint/no-explicit-any` in Supabase-heavy server files and existing React hook lint issues. The newly added dashboard/helper files and changed UI/page components were linted directly and passed.
- `npm run build` was attempted, but Turbopack stayed at `Creating an optimized production build ...` without further output for several minutes in this sandbox. No compile error was produced before it stalled.

Not run:

- Playwright E2E. The specs require live Supabase test accounts and network access. I updated the relevant E2E expectations for the new 2-country minimum and lobby readiness rules, but did not execute them here.

## Supabase Remote Migration Status

I could not apply the migration directly to the remote Supabase project from this environment.

Available env keys in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Missing for DDL migration:

- `DATABASE_URL` or `SUPABASE_DB_URL`
- Supabase CLI authentication/project link

Available tools:

- `psql` is installed.
- Supabase CLI is not installed.

The service-role key can call Supabase APIs, but it is not a Postgres connection string and cannot safely apply `ALTER TABLE` migrations by itself.

To apply manually:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20240111000000_room_visibility_assignment_mode.sql
```

Or, with Supabase CLI configured:

```bash
supabase db push
```

## Follow-Up Recommendations

- Apply `supabase/migrations/20240111000000_room_visibility_assignment_mode.sql` before deploying to Vercel.
- Run Playwright E2E against a seeded Supabase test project.
- Consider a future RLS hardening migration for `rooms` so direct client reads also respect public/private membership rules. The current implementation enforces privacy through dashboard discovery, the join page, and server actions.
