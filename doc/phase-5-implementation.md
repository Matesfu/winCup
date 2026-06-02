# WinCup — Phase 5 Implementation Plan: Build Knockout + The Ladder

> **Prerequisites:** Phase 4 complete — group stage with host override, real cron ingest, `buildKnockout` stub (transitions to `'knockout'` status). 216/216 unit tests passing.
>
> **Builds on:** `src/lib/ingest.ts` (extend), `src/lib/football-data.ts` (extend), `src/lib/supabase/realtime.ts` (extend), `buildKnockout` action in `src/actions/room.ts` (replace stub), DB schema already has `room_teams` and `matches` tables.

---

## 1. Scope & Deliverables

| # | Deliverable | Route / Location |
|---|-------------|-----------------|
| 1 | Realtime migration — add `room_teams` + `matches` | `supabase/migrations/20240105000000_realtime_phase5.sql` |
| 2 | `src/lib/bracket.ts` — pure bracket logic (testable) | Library |
| 3 | Extend `src/lib/football-data.ts` — fetch knockout fixtures | Library |
| 4 | Extend `src/lib/ingest.ts` — knockout match ingest | Library |
| 5 | `subscribeLadder` added to realtime helper | `src/lib/supabase/realtime.ts` |
| 6 | Replace `buildKnockout` action — real room_teams construction | `src/actions/room.ts` |
| 7 | `advanceMatch` Server Action (host manual override) | `src/actions/room.ts` |
| 8 | Extend cron route — process `knockout` status rooms | `src/app/api/cron/ingest/route.ts` |
| 9 | `/room/[id]/ladder` — Server Component shell | New route |
| 10 | `LadderRealtime.tsx` — "use client" live bracket state | `_components/` |
| 11 | `BracketColumn.tsx` — single-stage column | `_components/` |
| 12 | `MatchCard.tsx` — match display (A vs B, result, override) | `_components/` |
| 13 | `TeamSlot.tsx` — team tile (player-owned gold / filler / eliminated) | `_components/` |
| 14 | Unit tests (4 new suites) | `tests/unit/` |
| 15 | E2E tests (1 new suite, 8 scenarios) | `tests/e2e/ladder.spec.ts` |

**Out of scope for Phase 5:**
- Winner resolution screen (Phase 6)
- Calling `resolveWinner` logic (Phase 6)
- Full manual bracket-entry UI for unlinked rooms (unlinked rooms get sequential position assignment in Phase 5; a drag-and-drop ordering UI is deferred)

---

## 2. Folder Structure — Phase 5 Additions

```
src/
├── actions/
│   └── room.ts                   ← REPLACE buildKnockout stub; ADD advanceMatch
│
├── app/
│   ├── api/
│   │   └── cron/
│   │       └── ingest/
│   │           └── route.ts      ← EXTEND: process 'knockout' rooms
│   └── room/
│       └── [id]/
│           └── ladder/
│               ├── page.tsx       ← NEW: Server Component shell
│               └── _components/
│                   ├── LadderRealtime.tsx  ← "use client" live bracket
│                   ├── BracketColumn.tsx   ← one stage column
│                   ├── MatchCard.tsx       ← match tile with override buttons
│                   └── TeamSlot.tsx        ← team display (player/filler/TBD)
│
└── lib/
    ├── bracket.ts                 ← NEW: pure bracket construction + layout logic
    ├── football-data.ts           ← EXTEND: fetchKnockoutMatches()
    ├── ingest.ts                  ← EXTEND: ingestKnockoutMatches()
    └── supabase/
        └── realtime.ts            ← EXTEND: subscribeLadder()

supabase/
└── migrations/
    └── 20240105000000_realtime_phase5.sql  ← NEW

tests/
├── unit/
│   ├── lib/
│   │   └── bracket.test.ts        ← NEW
│   └── components/
│       └── room/
│           └── ladder/
│               ├── TeamSlot.test.tsx    ← NEW
│               ├── MatchCard.test.tsx   ← NEW
│               └── BracketColumn.test.tsx ← NEW
└── e2e/
    └── ladder.spec.ts             ← NEW
```

---

## 3. Migration — Realtime Phase 5

File: `supabase/migrations/20240105000000_realtime_phase5.sql`

The ladder page needs real-time updates when teams advance or matches are recorded. Both `room_teams` and `matches` must be in the Realtime publication.

```sql
-- Add room_teams and matches to the Realtime publication.
-- Both tables receive UPDATE events when teams advance or match results arrive.
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
```

---

## 4. Bracket Logic Library (`src/lib/bracket.ts`)

Pure functions — no Supabase, no HTTP. Testable in isolation.

### 4.1 Types

```typescript
export type StageKey = "r16" | "qf" | "sf" | "final";

export const STAGE_ORDER: StageKey[] = ["r16", "qf", "sf", "final"];

export const STAGE_LABELS: Record<StageKey, string> = {
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "Final",
};

/** One slot in the bracket — may be filled (team known) or empty (TBD) */
export interface BracketSlot {
  teamCode: string | null;       // null = TBD
  playerId: string | null;       // null = filler team
  playerName: string | null;
  isEliminated: boolean;
  isChampion: boolean;
  bracketPosition: number;
}

/** One matchup (pair of slots) in a given stage */
export interface BracketMatchup {
  stage: StageKey;
  matchOrder: number;            // 1-based within the stage
  slotA: BracketSlot;
  slotB: BracketSlot;
  winnerCode: string | null;     // null = not yet played
  externalMatchId: number | null;
}
```

### 4.2 `getStartingStage(teamCount: number): StageKey`

Returns the first stage for a bracket of `teamCount` teams:
- 16 teams → `'r16'`
- 8 teams → `'qf'`
- 4 teams → `'sf'`
- 2 teams → `'final'`
- Any other count → round up to next power of 2

### 4.3 `buildRoomTeamInserts(qualifiedCodes, playerMap, positionMap): RoomTeamInsert[]`

Constructs the `room_teams` rows to insert when building the knockout bracket.

```typescript
/**
 * @param qualifiedCodes - country codes that qualified (from room_countries.qualified=true)
 * @param playerMap      - Map<countryCode, playerId> for player-owned countries
 * @param positionMap    - Map<countryCode, bracketPosition> (1..N)
 *
 * Returns: one RoomTeamInsert per qualified country.
 * Player-owned countries get player_id set; others get player_id = null (filler).
 */
export function buildRoomTeamInserts(
  roomId: string,
  qualifiedCodes: string[],
  playerMap: Map<string, string>,     // countryCode → playerId
  positionMap: Map<string, number>    // countryCode → bracketPosition
): RoomTeamInsert[]
```

**Why separate from the DB insert:** This pure function is the reference implementation from the build prompt's `buildKnockoutBracket` algorithm, adapted for TypeScript and our schema. Keeping it pure makes it trivially testable.

### 4.4 `computeBracketMatchups(roomTeams, matches, stages): BracketMatchup[]`

Derives the visual matchup layout for all stages from current room_teams + matches state.

```typescript
/**
 * Computes which teams play each other in each stage.
 * Uses the matches table when available (for linked rooms),
 * falls back to position-pair arithmetic for unlinked rooms.
 *
 * Position pairing rule:
 *   - Within each stage, pairs are (2k-1, 2k) for k = 1..N/2
 *   - The winner of each pair advances to position k in the next stage
 *
 * @param roomTeams - all room_teams rows for this room
 * @param matches   - all matches rows for this room
 * @param stages    - which stages to compute (determined by bracket size)
 */
export function computeBracketMatchups(
  roomTeams: RoomTeam[],
  matches: Match[],
  stages: StageKey[]
): BracketMatchup[]
```

### 4.5 `getNextStageInfo(stage: StageKey, matchOrder: number): { nextStage: StageKey; nextPosition: number } | null`

Returns where the winner of a match advances to. Returns `null` for the Final (winner becomes Champion, handled separately).

### 4.6 `assignSequentialPositions(countryCodes: string[]): Map<string, number>`

For unlinked rooms: assigns bracket positions 1..N in the order the countries appear. Simple and deterministic.

---

## 5. `football-data.ts` Extension

Add `fetchKnockoutMatches` — fetches FINISHED knockout stage matches for a competition.

```typescript
/**
 * Fetch FINISHED knockout matches (ROUND_OF_16 through FINAL) for a competition.
 * Used to auto-advance teams in the bracket and record match results.
 */
export async function fetchKnockoutMatches(
  competitionId: number,
  apiKey: string,
  fetchFn?: FetchFn
): Promise<FdMatch[]>
```

The API call:
```
GET /v4/competitions/{id}/matches?status=FINISHED&stage=ROUND_OF_16,QUARTER_FINALS,SEMI_FINALS,FINAL
```

Also add `fetchR16Fixtures` — used when building the bracket to get planned matchups and bracket positions before matches are played:

```typescript
/**
 * Fetch all R16 fixtures (including SCHEDULED ones) to get planned bracket positions.
 * The fixture order determines which teams are in which bracket slot.
 */
export async function fetchR16Fixtures(
  competitionId: number,
  apiKey: string,
  fetchFn?: FetchFn
): Promise<FdMatch[]>
```

> **Stage mapping** — football-data.org uses these stage strings:
> - `ROUND_OF_16`
> - `QUARTER_FINALS`
> - `SEMI_FINALS`
> - `FINAL`
>
> These map to WinCup's: `r16`, `qf`, `sf`, `final`.

---

## 6. `ingest.ts` Extension — Knockout Ingest

Add `ingestKnockoutMatches` to `src/lib/ingest.ts`:

```typescript
export interface KnockoutIngestResult {
  matchesUpserted: number;
  teamsAdvanced: number;
  teamsEliminated: number;
}

/**
 * Process finished knockout matches and advance teams in the bracket.
 * Idempotent: deduped on external_match_id; skips already-eliminated teams.
 *
 * @param roomId          - the room to update
 * @param finishedMatches - finished matches from football-data.org
 * @param extIdToCode     - external team id → country code
 * @param roomTeams       - current room_teams state
 * @param admin           - Supabase admin client
 */
export async function ingestKnockoutMatches(
  roomId: string,
  finishedMatches: FdMatch[],
  extIdToCode: Map<number, string>,
  roomTeams: RoomTeam[],
  admin: IngestAdminClient
): Promise<KnockoutIngestResult>
```

**Full logic:**

```
For each finished match (that is a knockout match):
  Map homeTeam.id and awayTeam.id to countryCodes via extIdToCode
  Skip if either code can't be mapped (not in our system)

  Determine winner code from score.winner:
    'HOME_TEAM' → homeCode
    'AWAY_TEAM' → awayCode
    (no DRAW in knockout)

  Check for existing match record:
    SELECT FROM matches WHERE room_id = roomId AND external_match_id = match.id
    If exists → skip (already processed)

  Map fd stage → our stage:
    'ROUND_OF_16' → 'r16'
    'QUARTER_FINALS' → 'qf'
    'SEMI_FINALS' → 'sf'
    'FINAL' → 'final'

  Find winner's room_teams row:
    SELECT * FROM room_teams WHERE room_id = roomId AND country_code = winnerCode
    If not found (winner is a filler team not in our room) → still process
    
  Find loser's room_teams row:
    SELECT * FROM room_teams WHERE room_id = roomId AND country_code = loserCode

  Compute next stage and bracket position for winner:
    nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(currentStage) + 1]
    nextPos = Math.ceil(winnerTeam.bracket_position / 2)
    For Final: nextStage = 'champion'

  Upsert match record:
    INSERT INTO matches (room_id, external_match_id, stage, team_a_code, team_b_code, winner_code, match_order)
    ON CONFLICT (room_id, external_match_id) DO NOTHING (idempotent)
    matchesUpserted++

  Advance winner:
    If winner team found AND not already at nextStage:
      UPDATE room_teams SET current_stage = nextStage, bracket_position = nextPos
      teamsAdvanced++
    If winner reaches 'final': skip nextStage logic (used in Phase 6)

  Eliminate loser:
    If loser team found AND not already is_eliminated:
      UPDATE room_teams SET is_eliminated = true
      teamsEliminated++
      Find player with assigned_country = loserCode
      If found: UPDATE players SET is_eliminated = true
```

---

## 7. Realtime Extension (`subscribeRoomUpdates` already exists; add `subscribeLadder`)

```typescript
export interface LadderCallbacks {
  onTeamUpdated: (team: Partial<RoomTeam>) => void;
  onMatchUpserted: (match: Partial<Match>) => void;
  onRoomUpdated: (room: Partial<RoomPublic>) => void;
}

/**
 * Subscribe to all Realtime events needed by the Ladder page.
 * Covers: room_teams advances/eliminations, new match results, room status changes.
 * Returns an unsubscribe function.
 */
export function subscribeLadder(
  roomId: string,
  callbacks: LadderCallbacks
): () => void
```

Listens on `room_teams` (UPDATE), `matches` (INSERT + UPDATE), `rooms` (UPDATE). Uses a single channel `ladder:${roomId}`.

---

## 8. `buildKnockout` Action — Real Implementation

Replaces the Phase 4 stub in `src/actions/room.ts`. Same export name and `BuildKnockoutState` type — `HostOverridePanel` in the group stage page needs zero changes.

```
Input: roomId (FormData)

Steps:
1. Auth + host check
2. Fetch room (must be 'group_stage')
3. Verify all room_countries.qualified !== null (idempotent check)
4. Check idempotency: if room_teams already exist for this room → skip to step 10 (already built)

5. Fetch all qualified country codes (room_countries WHERE qualified = true)
6. Build playerMap: Map<countryCode, playerId>
   (from players WHERE room_id = roomId AND assigned_country IS NOT NULL AND is_eliminated = false)

7. Build positionMap: Map<countryCode, bracketPosition>
   For LINKED rooms (external_competition_id IS NOT NULL):
     a. fetchR16Fixtures(competition_id, apiKey)
     b. For each fixture, map homeTeam.id → position (2*matchOrder-1) and awayTeam.id → position (2*matchOrder)
     c. Only include positions for countries that qualified for this room
     d. Fill any unmapped qualifiers sequentially (in case some R16 teams aren't in the room)
   For UNLINKED rooms:
     a. assignSequentialPositions(qualifiedCodes)

8. buildRoomTeamInserts(roomId, qualifiedCodes, playerMap, positionMap)

9. Batch-insert room_teams (idempotent: INSERT OR IGNORE if already exists)
   If any insert fails → return { error: "..." }

10. UPDATE rooms.status = 'knockout'
    (Realtime fires → group-stage clients redirect to /ladder)

11. redirect(`/room/${roomId}/ladder`)
```

**Idempotency:** If `room_teams` rows already exist (host re-clicked the button), skip construction and just ensure status is 'knockout'. The INSERT step uses `ON CONFLICT DO NOTHING` semantics via `upsert`.

---

## 9. `advanceMatch` Server Action (Host Manual Override)

New export in `src/actions/room.ts`. Allows the host to manually record a knockout match result when the API hasn't ingested it yet.

```typescript
export type AdvanceMatchState = { error?: string } | null;

export async function advanceMatch(
  prevState: AdvanceMatchState,
  formData: FormData
): Promise<AdvanceMatchState>
```

```
Input (FormData):
  roomId       string   required
  winnerCode   string   required (country code of match winner)
  loserCode    string   required (country code of match loser)
  stage        string   required (r16/qf/sf/final)

Steps:
1. Auth + host check
2. Verify room.status === 'knockout'
3. Fetch room_teams for winnerCode and loserCode
4. Validate: both teams must be in this room, same stage, neither already eliminated

5. Idempotency:
   If winnerCode already at nextStage → skip (already advanced)

6. Compute nextStage + nextPosition (same formula as ingest logic)

7. UPDATE room_teams: winner → {current_stage: nextStage, bracket_position: nextPos}
8. UPDATE room_teams: loser  → {is_eliminated: true}
9. Eliminate loser's player (if they have one)
10. Upsert match record:
    INSERT OR UPDATE matches WHERE room_id=roomId AND team_a=winnerCode AND team_b=loserCode AND stage=stage
    Set winner_code = winnerCode

11. Return null (success — Realtime handles UI update)
```

---

## 10. Cron Route Extension — Knockout Rooms

The Phase 4 cron only processes `group_stage` rooms. Extend it to also process `knockout` rooms.

```typescript
// Extend the room query to include knockout status
const { data: rooms } = await admin.from("rooms")
  .select("id, status, external_competition_id")
  .in("status", ["group_stage", "knockout"])  // ← add knockout
  .not("external_competition_id", "is", null);

// Then route each room by status:
for each room:
  if room.status === 'group_stage':
    → ingestGroupStageStandings (existing Phase 4 logic)
  if room.status === 'knockout':
    → fetchKnockoutMatches + ingestKnockoutMatches (new Phase 5 logic)
```

**For knockout ingest:**
```
1. fetchKnockoutMatches(competitionId, apiKey)
2. Load current room_teams for this room
3. ingestKnockoutMatches(roomId, finishedMatches, extIdMap, roomTeams, admin)
4. Log result
```

---

## 11. Ladder Page

### 11.1 Server Component (`/room/[id]/ladder/page.tsx`)

```typescript
export default async function LadderPage({ params }) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/ladder`);

  // Parallel fetches
  const [roomResult, roomTeamsResult, matchesResult, countriesResult] = await Promise.all([
    (supabase as any).from("rooms").select("id,code,status,host_user_id,win_rule,stake_amount")
      .eq("id", roomId).maybeSingle(),
    (supabase as any).from("room_teams")
      .select("id,country_code,player_id,bracket_position,current_stage,is_eliminated")
      .eq("room_id", roomId),
    (supabase as any).from("matches")
      .select("id,stage,team_a_code,team_b_code,winner_code,bracket_position,match_order,external_match_id")
      .eq("room_id", roomId),
    (supabase as any).from("countries")
      .select("code,name,flag_emoji"),
  ]);

  // Status routing
  if (room.status === 'group_stage') redirect(`/room/${roomId}/group-stage`);
  if (room.status === 'finished')    redirect(`/room/${roomId}/winner`);

  const isHost = user.id === room.host_user_id;

  return (
    <LadderRealtime
      roomId={roomId}
      initialRoom={room}
      initialRoomTeams={roomTeams}
      initialMatches={matches}
      countriesMap={new Map(countries.map(c => [c.code, c]))}
      isHost={isHost}
      currentUserId={user.id}
    />
  );
}
```

Also need to fetch players (to resolve player names in `TeamSlot`):
```typescript
// Add to parallel fetches:
(supabase as any).from("players")
  .select("id,name,avatar_emoji")
  .eq("room_id", roomId)
```

### 11.2 Ladder Visual Design (Mobile-first Horizontal Scroll)

```
╔══════════════════════════════════════════════════════════════════════════╗
║  [Room header: WC-AB23 · Alice's room]                     [Leave]       ║
╠══════════════════════════════════════════════════════════════════════════╣
║  KNOCKOUT BRACKET          [← scroll →]                                  ║
║                                                                          ║
║  R16              QUARTERS          SEMIS         FINAL                  ║
║  ┌──────────┐                                                            ║
║  │🇦🇷 Alice  │                                                            ║
║  │Argentina ├──→ ┌──────────┐                                           ║
║  └──────────┘    │🇦🇷 Alice  ├──→ ┌──────────┐                          ║
║  ┌──────────┐    │Argentina  │    │🇦🇷 Alice  ├──→ ┌──────────┐         ║
║  │🇩🇪 ❌    │    └──────────┘    │Argentina  │    │   TBD    │──→  🏆   ║
║  │Germany❌ │                    └──────────┘    │          │         ║
║  └──────────┘    ┌──────────┐                    └──────────┘         ║
║  ┌──────────┐    │🇫🇷 Bob    ├──→                                       ║
║  │🇫🇷 Bob   ├──→ │France    │                                           ║
║  └──────────┘    └──────────┘                                           ║
║  ┌──────────┐                                                            ║
║  │🇪🇸 (fill)│                                                            ║
║  │Spain      │                                                            ║
║  └──────────┘                                                            ║
╚══════════════════════════════════════════════════════════════════════════╝
```

**Each team slot shows:**
- Player-owned team: gold border, player avatar + name (small), country flag + name
- Filler team: neutral border, flag + country name only
- Eliminated team: red border, faded, flag + ❌
- TBD (match not yet set): dashed border, "TBD" text, muted

**Connecting arrows** between rounds are rendered using `→` text or CSS right-border lines.

### 11.3 `LadderRealtime.tsx` ("use client")

Manages live bracket state:
- `roomTeams` — starts from `initialRoomTeams`, updates on `room_teams` UPDATE
- `matches` — starts from `initialMatches`, updates on `matches` INSERT + UPDATE
- Handles `rooms` UPDATE for `'finished'` → redirects to winner page
- Calls `computeBracketMatchups(roomTeams, matches, stages)` to derive the visual layout
- Passes computed matchups to the bracket columns

### 11.4 `BracketColumn.tsx`

Renders one stage column:

```typescript
interface BracketColumnProps {
  stage: StageKey;
  matchups: BracketMatchup[];
  countriesMap: Map<string, { code: string; name: string; flag_emoji: string }>;
  playersMap: Map<string, { id: string; name: string; avatar_emoji: string | null }>;
  isHost: boolean;
  roomId: string;
}
```

Renders:
- Column heading: `ROUND OF 16`, `QUARTER-FINALS`, etc.
- One `MatchCard` per matchup in this stage

### 11.5 `MatchCard.tsx` ("use client" for host override)

Renders one match within the bracket:

```typescript
interface MatchCardProps {
  matchup: BracketMatchup;
  countriesMap: Map<string, CountryInfo>;
  playersMap: Map<string, PlayerInfo>;
  isHost: boolean;
  roomId: string;
}
```

Visual states:
- **Pre-match (both TBD)**: shows both team names, no winner indicator
- **In progress (teams known, no winner)**: shows both teams with "Match in progress" if live; host sees two "Wins →" buttons
- **Decided (winner known)**: winner row highlighted in gold, loser row faded + ❌

Host override buttons: `[Team A wins]` and `[Team B wins]` — visible only to the host and only when no winner yet. Calls `advanceMatch` via a form action.

### 11.6 `TeamSlot.tsx`

A single team tile within a MatchCard:

```typescript
interface TeamSlotProps {
  teamCode: string | null;          // null = TBD
  country: CountryInfo | null;
  player: PlayerInfo | null;        // null = filler
  isWinner: boolean;
  isEliminated: boolean;
  isCurrentUser: boolean;
}
```

Visual:
- **Winner**: gold background, gold border, bold
- **Eliminated**: faded + red ❌
- **Current user's team**: gold ring
- **TBD**: dashed border, muted "TBD" text
- **Filler**: neutral border, flag only
- **Player-owned**: player avatar + name (small), flag + country name

---

## 12. Security Checklist for Phase 5

| # | Control | Location | How |
|---|---------|----------|-----|
| 1 | `buildKnockout` host-only | `buildKnockout` action | `host_user_id !== user.id` → error |
| 2 | `advanceMatch` host-only | `advanceMatch` action | Same check |
| 3 | `advanceMatch` validates both teams are in room | `advanceMatch` action | Fetch room_teams before updating |
| 4 | Bracket construction idempotent | `buildKnockout` action | Check for existing room_teams before insert |
| 5 | Match advancement idempotent | `ingestKnockoutMatches` | Check `current_stage` before advancing |
| 6 | Cron processes only linked knockout rooms | Cron route | `.not("external_competition_id", "is", null)` |
| 7 | Ladder page requires auth | `page.tsx` | Server-side redirect |
| 8 | Ladder page validates room status | `page.tsx` | Wrong status → correct phase redirect |
| 9 | Position map prevents duplicate positions | `bracket.ts` | `buildRoomTeamInserts` validates position uniqueness |

---

## 13. Testing Plan

### 13.1 Unit Tests

---

**`tests/unit/lib/bracket.test.ts`** — Core bracket logic

| Test | Assertion |
|------|-----------|
| `getStartingStage(16)` → `'r16'` | Correct start stage for 16 teams |
| `getStartingStage(8)` → `'qf'` | Correct start stage for 8 teams |
| `getStartingStage(4)` → `'sf'` | Correct start stage for 4 teams |
| `buildRoomTeamInserts` returns correct count | Length = qualifiedCodes.length |
| `buildRoomTeamInserts` player-owned country has player_id | Non-null for owned countries |
| `buildRoomTeamInserts` filler country has null player_id | Null for unowned qualifiers |
| `buildRoomTeamInserts` all positions unique | No duplicate bracket_position values |
| `buildRoomTeamInserts` all start at 'r16' | `current_stage = 'r16'` for all rows |
| `assignSequentialPositions(4 codes)` → positions 1–4 | Sequential 1-indexed positions |
| `getNextStageInfo('r16', 1)` → `{nextStage:'qf', nextPosition:1}` | Correct advancement |
| `getNextStageInfo('r16', 2)` → `{nextStage:'qf', nextPosition:1}` | Pair shares next slot |
| `getNextStageInfo('final', 1)` → `null` | No next stage after final |
| `computeBracketMatchups` returns correct number of matchups per stage | 8 for r16, 4 for qf, etc. |
| `computeBracketMatchups` matchup order matches position pairs | (1,2), (3,4), etc. |

---

**`tests/unit/components/room/ladder/TeamSlot.test.tsx`**

| Test | Assertion |
|------|-----------|
| TBD team renders "TBD" | "TBD" text visible |
| Player-owned team renders player name | Player name visible |
| Player-owned team renders country flag | Flag emoji visible |
| Filler team renders flag but not player name | Flag visible; no player name |
| Winner team has gold styling class | `data-state="winner"` or gold class |
| Eliminated team has eliminated styling | `data-state="eliminated"` class |
| Current user's team has visual distinction | Ring or highlight present |

---

**`tests/unit/components/room/ladder/MatchCard.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders both team slots | Two TeamSlot elements |
| Winner shown when decided | Winner slot has winner styling |
| Loser shown as eliminated | Loser slot has eliminated styling |
| TBD match shows no winner | Neither slot has winner styling |
| Host sees override buttons when match undecided | Two "wins" buttons visible |
| Non-host sees no override buttons | Buttons absent |
| Override buttons absent when winner already known | Buttons absent after decision |

---

**`tests/unit/components/room/ladder/BracketColumn.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders stage heading | "ROUND OF 16" / "QUARTER-FINALS" etc. |
| Renders correct number of match cards | 8 for r16, 4 for qf, etc. |
| Passes correct props to MatchCards | Each MatchCard receives its matchup |

---

### 13.2 E2E Tests (Playwright)

**`tests/e2e/ladder.spec.ts`** — 8 scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| **Unauthenticated redirect** | Visit ladder without session | Redirects to sign-in |
| **Ladder page redirects if not in knockout** | Status = group_stage → visit ladder | Redirects to group-stage |
| **Bracket columns rendered** | Room in knockout state; open ladder | Stage columns (R16, QF, etc.) visible |
| **Player-owned team shows player name** | Player with assigned country in bracket | Player name visible in gold in their team slot |
| **Filler team shows flag only** | Non-room qualifier in bracket | No player name; flag + country name only |
| **Eliminated team shows ❌** | Team has is_eliminated=true | Red styling + ❌ indicator |
| **Host sees override buttons** | Host visits ladder with undecided match | "wins" buttons visible |
| **Mobile layout: ladder scrollable at 375px** | Set 375px viewport; open ladder | Horizontal scroll; no vertical overflow from bracket |

---

### 13.3 Type Safety

```bash
npm run typecheck   # 0 errors required
```

### 13.4 Build Verification

```bash
npm run build   # exit 0
```

Expected routes after Phase 5:
```
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
├ ƒ /room/[id]/ladder       ← NEW
├ ƒ /room/[id]/lobby
└ ƒ /room/create
```

---

## 14. Implementation Step Order

| Step | Task | Files |
|------|------|-------|
| 1 | Realtime migration (room_teams + matches) | `supabase/migrations/20240105000000_realtime_phase5.sql` |
| 2 | `bracket.ts` — pure bracket logic library | `src/lib/bracket.ts` |
| 3 | Extend `football-data.ts` — `fetchKnockoutMatches`, `fetchR16Fixtures` | `src/lib/football-data.ts` |
| 4 | Extend `ingest.ts` — `ingestKnockoutMatches` | `src/lib/ingest.ts` |
| 5 | `subscribeLadder` in realtime helper | `src/lib/supabase/realtime.ts` |
| 6 | Replace `buildKnockout` action with real room_teams construction | `src/actions/room.ts` |
| 7 | Add `advanceMatch` Server Action | `src/actions/room.ts` |
| 8 | Extend cron route — process knockout rooms | `src/app/api/cron/ingest/route.ts` |
| 9 | `TeamSlot.tsx` (no dependencies on other new components) | `ladder/_components/` |
| 10 | `MatchCard.tsx` (uses TeamSlot) | `ladder/_components/` |
| 11 | `BracketColumn.tsx` (uses MatchCard) | `ladder/_components/` |
| 12 | `LadderRealtime.tsx` (uses BracketColumn + subscribeLadder) | `ladder/_components/` |
| 13 | Ladder page (`/room/[id]/ladder/page.tsx`) | `ladder/page.tsx` |
| 14 | Unit tests (4 suites) | `tests/unit/lib/bracket.test.ts`, component tests |
| 15 | E2E tests | `tests/e2e/ladder.spec.ts` |
| 16 | Typecheck + build verification | `npm run typecheck && npm run build && npm test` |

---

## 15. Phase 5 Definition of Done

| Check | Criterion |
|-------|-----------|
| `npm run typecheck` | Zero TypeScript errors |
| `npm run build` | Exit 0; 14 routes |
| `npm test` | All unit tests pass (216 existing + Phase 5 tests) |
| Realtime migration applied | `room_teams` and `matches` in publication |
| `buildKnockout` constructs room_teams | Each qualified country → room_teams row; player_id set for owned countries |
| Bracket construction idempotent | Calling `buildKnockout` twice → no duplicate rows |
| Linked rooms: positions from API | R16 fixture order determines bracket_position |
| Unlinked rooms: sequential positions | Positions 1..N in order |
| Ladder page requires auth | Unauthenticated → sign-in redirect |
| Ladder page guards room status | Wrong status → correct page redirect |
| Bracket columns rendered for all stages | All stages visible in horizontal scroll |
| Player-owned teams show player name + gold styling | Gold border, avatar, name visible |
| Filler teams show flag only | No player name for non-room qualifiers |
| Eliminated teams show ❌ and are faded | Red border, opacity reduction |
| TBD slots render correctly | Dashed border, "TBD" text |
| Host override buttons visible only to host | Non-host sees no advance buttons |
| `advanceMatch` host-only + idempotent | Non-host gets error; double-advance no-ops |
| Cron processes knockout rooms | `status = 'knockout'` rooms ingested |
| Knockout ingest idempotent | Re-running cron → no double-advances |
| Realtime: team advance updates bracket live | `room_teams` UPDATE → bracket re-renders |
| Mobile: horizontal scroll at 375px | Bracket scrolls horizontally; no vertical overflow |

---

## 16. What Phase 6 Builds Next

Phase 5 ends when the Final is played and there is one team at `current_stage = 'champion'` (or `last_standing` rule kicks in when only one player's team survives). Phase 6 picks up:
- **Auto-resolution**: the cron ingest calls `resolveWinner(room, roomTeams)` when the Final completes and persists `rooms.winner_player_id` + `rooms.status = 'finished'`
- **Winner screen** (`/room/[id]/winner`): full-screen confetti, winner's name in giant gold text, flag, stake, Share-to-WhatsApp button
- **Strict mode "no winner" screen**: if the champion is a filler, show the friendly "stakes returned" message
- **Start New Room** button back to `/room/create`
