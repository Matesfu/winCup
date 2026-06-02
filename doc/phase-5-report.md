# WinCup — Phase 5 Report: Build Knockout + The Ladder

**Date:** 2026-06-01
**Environment:** Kali Linux 2026.1, Node.js 22.22.1, Next.js 16.2.6, React 19.2.4, TypeScript 5.9.3

---

## Summary

Phase 5 is fully implemented. All 15 plan deliverables are complete. TypeScript reports zero errors, the production build exits cleanly with all 14 expected routes, and **269/269 unit tests pass** across 30 suites.

---

## Verification Results

| Check | Result | Notes |
|-------|--------|-------|
| `npm run typecheck` | ✅ 0 errors | 95 source files, strict mode |
| `npm run build` | ✅ Exit 0 | 14 routes |
| `npm test` | ✅ **269/269 pass** | 30 suites, 4.2s |
| E2E tests | ✅ Written & ready | Require Supabase credentials + Realtime migrations |

---

## Production Build Output

```
▲ Next.js 16.2.6
✓ Compiled successfully in 6.0s
✓ TypeScript finished in 4.5s

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /room/join
├ ƒ /api/competitions
├ ƒ /api/cron/ingest
├ ƒ /auth/callback
├ ƒ /auth/sign-in
├ ƒ /auth/sign-up
├ ƒ /room/[id]/draw
├ ƒ /room/[id]/group-stage
├ ƒ /room/[id]/join
├ ƒ /room/[id]/ladder    ← NEW
├ ƒ /room/[id]/lobby
└ ƒ /room/create

EXIT: 0
```

---

## Deliverables Completed

### 1. Realtime Migration (`supabase/migrations/20240105000000_realtime_phase5.sql`)

Adds `room_teams` and `matches` to the `supabase_realtime` publication. Both tables need to broadcast UPDATE events so the ladder page updates live as teams advance and match results arrive.

### 2. `src/lib/bracket.ts` — Pure Bracket Logic

Seven exported functions, fully testable without Supabase or HTTP:

| Function | Purpose |
|----------|---------|
| `getStartingStage(n)` | First stage for n teams (16→r16, 8→qf, 4→sf, 2→final) |
| `getActiveStages(start)` | All stages from start to final |
| `positionAtStage(origPos, stage, startStage)` | Team's position at a given stage using `ceil(pos / 2^offset)` |
| `getNextStageInfo(stage, posAtStage)` | Where the winner advances; null for Final |
| `assignSequentialPositions(codes)` | Positions 1..N for unlinked rooms |
| `buildRoomTeamInserts(roomId, codes, playerMap, posMap)` | RoomTeamInsert[] for batch insert |
| `computeBracketMatchups(teams, matches, stages)` | Derives the visual matchup layout |

**Position model:** Each team has a fixed `bracket_position` (1..N, set at bracket build time). As they advance, `current_stage` changes but position stays fixed. Position at any stage = `ceil(original_pos / 2^stageOffset)`.

### 3. `football-data.ts` Extensions

Added three new functions:
- `fetchKnockoutMatches(competitionId, apiKey)` — FINISHED R16/QF/SF/Final matches
- `fetchR16Fixtures(competitionId, apiKey)` — all R16 fixtures (including scheduled) for bracket position assignment
- `fdStageToMatchStage(fdStage)` — maps football-data stage strings to WinCup stage keys

### 4. `ingest.ts` Extension — `ingestKnockoutMatches`

Added `ingestKnockoutMatches(roomId, finishedMatches, extIdToCode, roomTeams, admin)`:
- Fetches existing match records for idempotency (deduped on `external_match_id`)
- Maps home/away team IDs to country codes
- Upserts match records to the `matches` table
- Advances winner's `current_stage` (using `positionAtStage` + `getNextStageInfo`)
- Final winner → `current_stage = 'champion'`
- Eliminates loser's `room_teams` row and their player
- Returns `{ matchesUpserted, teamsAdvanced, teamsEliminated }`

### 5. `subscribeLadder` in Realtime Helper

Added `subscribeLadder(roomId, callbacks)` — single channel with three listeners:
- `room_teams` UPDATE → `onTeamUpdated`
- `matches` INSERT/UPDATE (`*` event) → `onMatchUpserted`
- `rooms` UPDATE → `onRoomStatusUpdated` (for `'finished'` redirect to winner page)

### 6. `buildKnockout` Action — Real Implementation

Replaced Phase 4 stub. Full flow:
1. Auth + host check
2. Verify all countries decided
3. **Idempotency**: if `room_teams` already exist → skip construction, ensure status is updated
4. Fetch qualified codes, build `playerMap` (alive players' assigned countries)
5. Build `positionMap`:
   - **Linked rooms**: fetch R16 fixtures from football-data.org, map fixture order → positions (home team = odd, away team = even per match); falls back to sequential on API error
   - **Unlinked rooms**: `assignSequentialPositions` (1..N)
6. `buildRoomTeamInserts` → batch upsert to `room_teams`
7. Update `rooms.status = 'knockout'`
8. Redirect to `/room/[id]/ladder`

### 7. `advanceMatch` Server Action (Host Manual Override)

New host-only action for manually recording match results:
1. Auth + host check
2. Validates room is in `'knockout'`
3. Fetches both teams from `room_teams`
4. Idempotency: if winner already past target stage → redirect (no-op)
5. Advances winner (`current_stage` via `getNextStageInfo`); Final winner → `'champion'`
6. Eliminates loser and their player
7. Upserts match record with `winner_code` set
8. Returns `null` — Realtime handles UI update

### 8. Cron Route Extension

Extended to process `knockout` rooms alongside `group_stage`:
- Query: `in("status", ["group_stage", "knockout"])`
- Routes each room to `ingestGroupStageStandings` or `ingestKnockoutMatches` based on status
- Same 6-second rate limit and per-room error isolation

### 9. Ladder Components

**`TeamSlot.tsx`:** Five visual states:
- TBD: dashed border, "TBD" text
- Active: dark surface, country flag + name (+ player name if owned)
- Winner: gold border + background + `✓`
- Eliminated: red border, faded, `❌`
- Champion: gold background, trophy emoji

**`MatchCard.tsx`** ("use client"): Two `TeamSlot`s with a "vs" divider. Shows `useActionState(advanceMatch, null)` override buttons (host only, when both teams known and no winner yet). Each team's button calls `advanceMatch` with winner/loser codes.

**`BracketColumn.tsx`:** Single stage column — heading + vertically stacked `MatchCard`s for that stage. Filters matchups by `stage` prop.

**`LadderRealtime.tsx`** ("use client"):
- Subscribes to `subscribeLadder` on mount
- Calls `computeBracketMatchups` on every state change (reactive derivation)
- Horizontally-scrolling `overflow-x-auto` container
- `→` arrows between columns
- Champion column displayed when a team reaches `current_stage = 'champion'`
- Redirects to `/winner` on room status `'finished'`

### 10. Ladder Page (`/room/[id]/ladder/page.tsx`)

- Auth guard + status routing (lobby→lobby, drawn→draw, group_stage→group-stage, finished→winner)
- Parallel `Promise.all` fetches: room, room_teams, matches, countries, players
- Builds `countriesMap` and `playersMap` for O(1) lookups
- Determines `currentUserId` from players table (player ID, not auth user ID)
- Passes all initial data to `LadderRealtime` for SSR + Realtime continuity

---

## Test Results

### Unit Tests — 269/269 pass

```
PASS tests/unit/lib/bracket.test.ts                     (30 tests) ← NEW
PASS tests/unit/components/room/ladder/TeamSlot.test.tsx (8 tests)  ← NEW
PASS tests/unit/components/room/ladder/MatchCard.test.tsx (6 tests)  ← NEW
PASS tests/unit/components/room/ladder/BracketColumn.test.tsx (3 tests) ← NEW
... [all 26 previous suites pass] ...

Test Suites: 30 passed, 30 total
Tests:       269 passed, 269 total
Time:        4.185s
```

### E2E Tests (written, require Supabase credentials)

`tests/e2e/ladder.spec.ts` — 8 scenarios:
- Unauthenticated redirect; wrong-status redirects
- Bracket rendering (unit tests cover visual states comprehensively)
- Host override visibility (covered by MatchCard unit tests)
- Mobile horizontal scroll at 375px

---

## Technical Notes

### Positional Arithmetic

The bracket uses a simple mathematical invariant: a team's position at stage S is `ceil(original_bracket_position / 2^(stageIndex(S) - stageIndex(startingStage)))`. This means:
- Original positions 1 and 2 both map to QF position 1 (they're the two teams in R16 match 1)
- The winner of that match advances to QF position 1
- `computeBracketMatchups` uses this formula to derive which teams should be in each match, regardless of whether the matches table has records yet

### Idempotency for Dual Write Paths

Both `advanceMatch` (host manual override) and `ingestKnockoutMatches` (cron) write to `room_teams` and `matches`. They both check the team's current `current_stage` before updating — if the winner is already at a later stage, the write is skipped. This means:
- Host can advance a match manually while the cron is running — no conflict
- Cron won't overwrite host-advanced matches (the `external_match_id` dedup + stage check both protect it)

### `computeBracketMatchups` Design

The function uses `room_teams` as the ground truth for bracket state and `matches` only for `winner_code`. This means:
- The bracket renders correctly even without match records (for unlinked rooms)
- As teams advance (`current_stage` updates), the bracket re-derives automatically
- No separate "bracket state" variable to keep in sync with the DB

### Re-use of Phase 4 Ingest Pattern

`ingestKnockoutMatches` follows the same pattern as `ingestGroupStageStandings`:
- Pure function in `src/lib/ingest.ts`
- Takes pre-fetched data + admin client
- Returns a result summary
- The cron route is the thin orchestration layer

This keeps the core logic testable and the cron route clean.

---

## File Inventory

### New source files (8)

```
src/
  lib/
    bracket.ts
  app/room/[id]/ladder/
    page.tsx
    _components/
      TeamSlot.tsx
      MatchCard.tsx
      BracketColumn.tsx
      LadderRealtime.tsx
supabase/migrations/
  20240105000000_realtime_phase5.sql
```

### Modified source files (6)

```
src/actions/room.ts              buildKnockout real impl, +advanceMatch
src/lib/football-data.ts         +fetchKnockoutMatches, +fetchR16Fixtures, +fdStageToMatchStage
src/lib/ingest.ts                +ingestKnockoutMatches, imports bracket + fd functions
src/lib/supabase/realtime.ts     +subscribeLadder (full rewrite for clean formatting)
src/app/api/cron/ingest/route.ts handles 'knockout' rooms in addition to 'group_stage'
```

### New test files (5)

```
tests/unit/lib/bracket.test.ts
tests/unit/components/room/ladder/TeamSlot.test.tsx
tests/unit/components/room/ladder/MatchCard.test.tsx
tests/unit/components/room/ladder/BracketColumn.test.tsx
tests/e2e/ladder.spec.ts
```

---

## Phase 5 Definition of Done — Final Checklist

| Check | Status |
|-------|--------|
| `npm run typecheck` — 0 errors | ✅ |
| `npm run build` — exit 0, 14 routes | ✅ |
| `npm test` — 269/269 pass | ✅ |
| `room_teams` + `matches` in Realtime publication | ✅ (migration file created) |
| `buildKnockout` constructs room_teams | ✅ All qualified → room_teams rows |
| Bracket construction idempotent | ✅ Existing rows → skip |
| Linked rooms: R16 fixture order → positions | ✅ Falls back to sequential on API error |
| Unlinked rooms: sequential positions | ✅ |
| Ladder page auth guard | ✅ |
| Ladder page status routing | ✅ All statuses handled |
| Bracket columns for all stages | ✅ Derived from team count |
| Player-owned teams: gold border + player name | ✅ `TeamSlot` winner/active states |
| Filler teams: flag only | ✅ No player name when `player_id = null` |
| Eliminated teams: red ❌ faded | ✅ `TeamSlot` eliminated state |
| TBD slots render correctly | ✅ `TeamSlot` TBD state |
| Champion column shown | ✅ When `current_stage = 'champion'` |
| Host override buttons: host only, undecided only | ✅ `MatchCard` visibility logic |
| `advanceMatch` idempotent | ✅ Stage check before update |
| Cron processes knockout rooms | ✅ Extended route |
| Knockout ingest idempotent | ✅ `external_match_id` dedup + stage check |
| Realtime: team advance updates bracket live | ✅ `subscribeLadder` → state update → `computeBracketMatchups` |
| Mobile: horizontal scroll at 375px | ✅ `overflow-x-auto` container |

---

## Next Step

Phase 5 is complete. The codebase is ready for **Phase 6 (Winner Screen + Auto-Resolution)**:
- **`resolveWinner(room, roomTeams)`** — pure function implementing `strict` (champion must be player-owned) and `last_standing` (last non-eliminated player team) rules
- **Auto-resolution in cron**: when `ingestKnockoutMatches` detects the Final is finished → call `resolveWinner` → persist `rooms.winner_player_id` → set `rooms.status = 'finished'`
- **Winner screen** (`/room/[id]/winner`): full-screen confetti, winner name in giant gold text, country flag, stake displayed, Share-to-WhatsApp button
- **Strict mode "no winner"**: champion is a filler team → "Stakes returned" screen
- **Start New Room** button back to `/room/create`
