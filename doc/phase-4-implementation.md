# WinCup — Phase 4 Implementation Plan: Group Stage + Cron Ingestion

> **Prerequisites:** Phase 3 complete — draw runs, all players have `assigned_country`, `rooms.status = 'drawn'`, "Go to Group Stage" link present in `DrawSummary`. 181/181 unit tests passing.
>
> **Builds on:** `src/lib/supabase/realtime.ts` (extend), `src/actions/room.ts` (extend), `/api/cron/ingest/route.ts` (replace stub), `DrawSummary.tsx` (update CTA for host), existing DB schema — no new tables needed.

---

## 1. Scope & Deliverables

| # | Deliverable | Route / Location |
|---|-------------|-----------------|
| 1 | Realtime migration — add `room_countries` | `supabase/migrations/20240104000000_realtime_phase4.sql` |
| 2 | `startGroupStage` Server Action (host-only status transition) | `src/actions/room.ts` |
| 3 | `markQualification` Server Action (host override) | `src/actions/room.ts` |
| 4 | `buildKnockout` Server Action stub (Phase 5 will fill) | `src/actions/room.ts` |
| 5 | `DrawSummary.tsx` updated — host CTA calls `startGroupStage` | `_components/DrawSummary.tsx` |
| 6 | `src/lib/football-data.ts` — typed API client | Library |
| 7 | `src/lib/ingest.ts` — core ingest logic (pure, testable) | Library |
| 8 | `subscribeGroupStage` added to realtime helper | `src/lib/supabase/realtime.ts` |
| 9 | Group Stage page — Server Component shell | `/room/[id]/group-stage` |
| 10 | `GroupStageRealtime.tsx` — "use client" live state + layout | `_components/` |
| 11 | `GroupStatusCard.tsx` — player card with alive/eliminated states | `_components/` |
| 12 | `HostOverridePanel.tsx` — "use client" host control per country | `_components/` |
| 13 | Real Vercel Cron route (`/api/cron/ingest`) — replaces no-op stub | `src/app/api/cron/ingest/route.ts` |
| 14 | Unit tests (5 suites) | `tests/unit/` |
| 15 | E2E tests (1 suite, 9 scenarios) | `tests/e2e/group-stage.spec.ts` |

**Out of scope for Phase 4:**
- The knockout bracket / ladder (Phase 5)
- Winner resolution (Phase 6)
- Admin tool to populate `countries.external_team_id` — documented in README as a one-time manual step

---

## 2. Folder Structure — Phase 4 Additions

```
src/
├── actions/
│   └── room.ts                    ← EXTEND: startGroupStage, markQualification, buildKnockout stub
│
├── app/
│   ├── api/
│   │   └── cron/
│   │       └── ingest/
│   │           └── route.ts      ← REPLACE no-op with real implementation
│   └── room/
│       └── [id]/
│           ├── draw/
│           │   └── _components/
│           │       └── DrawSummary.tsx  ← UPDATE: host uses startGroupStage action
│           └── group-stage/
│               ├── page.tsx             ← NEW: Server Component shell
│               └── _components/
│                   ├── GroupStageRealtime.tsx  ← "use client" live state
│                   ├── GroupStatusCard.tsx     ← player alive/eliminated card
│                   └── HostOverridePanel.tsx   ← "use client" host qualification controls
│
└── lib/
    ├── football-data.ts           ← NEW: typed football-data.org API client
    ├── ingest.ts                  ← NEW: core group stage ingest logic (testable)
    └── supabase/
        └── realtime.ts            ← EXTEND: add subscribeGroupStage()

supabase/
└── migrations/
    └── 20240104000000_realtime_phase4.sql  ← NEW: add room_countries to Realtime

tests/
├── unit/
│   ├── lib/
│   │   ├── football-data.test.ts  ← NEW
│   │   └── ingest.test.ts         ← NEW
│   └── components/
│       └── room/
│           └── group-stage/
│               ├── GroupStatusCard.test.tsx   ← NEW
│               └── HostOverridePanel.test.tsx ← NEW
└── e2e/
    └── group-stage.spec.ts        ← NEW
```

---

## 3. Migration — Realtime Phase 4

File: `supabase/migrations/20240104000000_realtime_phase4.sql`

Phase 4 needs clients to react instantly when the host marks a country as qualified or knocked out. This requires `room_countries` UPDATE events to broadcast to all connected clients.

```sql
-- Add room_countries to the Realtime publication so that
-- UPDATE events (qualified field changes) broadcast to subscribers.
-- players was already added in migration 20240103000000_realtime.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_countries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_countries;
  END IF;
END $$;
```

---

## 4. Status Transition Flow: `drawn` → `group_stage`

```
Host on Draw Summary page clicks "Go to Group Stage"
         │
         ▼
startGroupStage() Server Action
  ├─ Verify host ownership
  ├─ Verify room.status === 'drawn' (or already 'group_stage' → idempotent)
  ├─ UPDATE rooms.status = 'group_stage'
  └─ redirect(/room/[id]/group-stage)
         │
         │  Realtime: rooms UPDATE event fires
         ▼
All draw-page clients (subscribeRoomUpdates in DrawOrchestrator.tsx)
  → router.push(`/room/${roomId}/group-stage`)   ← already in Phase 3!
         │
         ▼
/room/[id]/group-stage — everyone lands here together
```

**Non-host flow:** Non-host players who click the link in `DrawSummary` navigate directly to `/room/[id]/group-stage`. If the host hasn't called `startGroupStage` yet (status still 'drawn'), they see a "Waiting for host to advance the game" state. The Realtime subscription detects the `group_stage` status change and removes the waiting screen.

**Why host-only transition:** Marking the game as "group stage started" is a deliberate host action. It prevents the game advancing automatically while the host is still explaining rules or waiting for everyone to see their country.

---

## 5. `DrawSummary.tsx` Update

The existing `DrawSummary.tsx` has "Go to Group Stage" as a plain `<Link>`. It needs to be updated to:
- **Host**: a form that calls `startGroupStage` (triggers status transition + Realtime broadcast + redirect)
- **Non-host**: plain link to `/room/[id]/group-stage`

`DrawOrchestrator` already receives `isHost` — pass it down to `DrawSummary`.

```typescript
// Updated DrawSummary prop signature
interface DrawSummaryProps {
  roomId: string;
  players: DrawPlayer[];
  countriesMap: Map<string, CountryInfo>;
  isHost: boolean;  // ← NEW
}
```

The host CTA becomes a `<form>` with `action={startGroupStage}` and a hidden `roomId` input, rendered as a gold primary button. Non-host sees a ghost-styled link instead (they can observe but not advance the game).

---

## 6. New Server Actions (`src/actions/room.ts` additions)

### 6.1 `startGroupStage(prevState, formData)`

Transitions the room from 'drawn' to 'group_stage'. Idempotent.

```
Input: roomId (FormData)

Steps:
1. Auth + host ownership check
2. Fetch room.status
   └ 'lobby' | 'drawn' but not drawn → return error
   └ already 'group_stage' → redirect (idempotent)
   └ 'drawn' → proceed
3. UPDATE rooms.status = 'group_stage'
   └ Realtime fires → all draw-page clients redirect here
4. redirect(`/room/${roomId}/group-stage`)
```

### 6.2 `markQualification(prevState, formData)`

Host-only override: mark a country as qualified or knocked out.
Idempotent: calling with the same values twice has no additional effect.

```
Input (FormData):
  roomId        string   required
  countryCode   string   required
  qualified     string   "true" | "false"

Steps:
1. Auth + host ownership check
2. Validate countryCode is in room_countries for this room
3. UPDATE room_countries.qualified = qualified
   └ Realtime UPDATE fires automatically

4. If qualified === false (knocked out):
   └ Find player: players WHERE room_id = roomId AND assigned_country = countryCode
   └ If found: UPDATE players.is_eliminated = true
   └ Realtime UPDATE fires automatically

5. If qualified === true (reversal of knockout):
   └ Find player: same query
   └ If found AND is_eliminated = true: UPDATE players.is_eliminated = false
   └ (Host correcting a mistake — restore the player)

6. Return null (success) — client updates via Realtime subscription
```

**Why no redirect:** The host stays on the group stage page. The UI updates reactively via Realtime subscriptions. Using `useActionState` for inline state machine, error shown as an alert banner if any step fails.

### 6.3 `buildKnockout(prevState, formData)` — Phase 5 Stub

Called when all countries are decided and host is ready to build the bracket.

```
Input: roomId

Steps:
1. Auth + host ownership check
2. Verify room.status === 'group_stage'
3. Verify ALL room_countries.qualified is non-null (all decided)
   └ If any null → return error "Some countries are still undecided"
4. STUB: UPDATE rooms.status = 'knockout'
   └ Phase 5 replaces this with room_teams construction
5. redirect(`/room/${roomId}/ladder`)
   └ Phase 5 builds the ladder page (404 until then)
```

---

## 7. Football-data.org API Client (`src/lib/football-data.ts`)

Pure TypeScript — no Supabase, no side effects. Designed for testability with mocked fetch.

### 7.1 Types

```typescript
export interface FdTeam {
  id: number;
  name: string;
  shortName: string;
}

export interface FdMatch {
  id: number;
  stage: string;          // 'GROUP_STAGE' | 'ROUND_OF_16' | etc.
  status: string;         // 'SCHEDULED' | 'IN_PLAY' | 'FINISHED' | 'CANCELLED'
  matchday: number;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
    fullTime: { home: number | null; away: number | null };
  };
}

export interface FdStandingEntry {
  position: number;
  team: FdTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface FdStandingGroup {
  stage: string;
  type: string;         // 'TOTAL'
  group: string | null; // 'GROUP_A' | 'GROUP_B' | ... | null (non-group competitions)
  table: FdStandingEntry[];
}

export interface FdMatchesResponse {
  count: number;
  matches: FdMatch[];
}

export interface FdStandingsResponse {
  season: { id: number; startDate: string; endDate: string };
  standings: FdStandingGroup[];
}
```

### 7.2 Functions

```typescript
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

/**
 * Fetch standings for a competition.
 * Uses standings to determine group qualifiers (top N per group).
 */
export async function fetchStandings(
  competitionId: number,
  apiKey: string
): Promise<FdStandingGroup[]>

/**
 * Fetch FINISHED group stage matches for a competition/season.
 * Used for idempotent match storage — deduped by external_match_id.
 */
export async function fetchFinishedGroupMatches(
  competitionId: number,
  apiKey: string
): Promise<FdMatch[]>
```

Both functions:
- Accept a `fetch`-compatible injector for testability (defaults to global `fetch`)
- Throw `FootballDataError` on non-2xx responses (includes status code + message)
- Set `X-Auth-Token: <apiKey>` header
- Never use `FOOTBALL_DATA_API_KEY` directly — the caller passes it (server actions hold the key)

### 7.3 Error Type

```typescript
export class FootballDataError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "FootballDataError";
  }
}
```

---

## 8. Core Ingest Logic (`src/lib/ingest.ts`)

Pure business logic — no HTTP, no Supabase directly. Takes pre-fetched data and a DB client.

```typescript
export interface GroupIngestResult {
  countriesUpdated: number;
  playersEliminated: number;
  skippedIncomplete: number;   // groups where not all games are played yet
}

/**
 * Given the standings from football-data.org, determine which countries
 * in a room have qualified or been eliminated from the group stage.
 *
 * Idempotent: skips countries with already-decided qualification.
 * Writes to: room_countries.qualified, players.is_eliminated.
 */
export async function ingestGroupStageStandings(
  roomId: string,
  standings: FdStandingGroup[],
  roomCountryCodes: string[],           // country codes selected for this room
  countryExternalIdMap: Map<number, string>, // externalTeamId → countryCode
  admin: AdminClient                    // Supabase admin client
): Promise<GroupIngestResult>
```

**How `ingestGroupStageStandings` works:**

```
For each group in standings:
  teamsInGroup = group.table (sorted by position, position 1 = leader)

  groupComplete = every team in group has playedGames >= expected
    (3 games for groups of 4, 2 for groups of 3, etc.)

  If not groupComplete:
    skippedIncomplete++; continue

  For each team at positions 1..qualifyCount (default 2):
    externalId = team.id
    countryCode = countryExternalIdMap.get(externalId) ?? null
    if countryCode is null → not in our game; skip
    if countryCode not in roomCountryCodes → not selected for this room; skip

    Fetch room_countries row for this roomId + countryCode
    If already qualified !== null → skip (idempotent)

    UPDATE room_countries.qualified = true  (qualified)
    countriesUpdated++

  For each team at positions (qualifyCount+1)..end:
    same lookup logic
    If already qualified !== null → skip
    UPDATE room_countries.qualified = false  (eliminated)
    countriesUpdated++
    Find player with assigned_country = countryCode
    If found: UPDATE players.is_eliminated = true
    playersEliminated++
```

**Why `qualifyCount = 2`:** Standard group-stage tournaments (World Cup, Euros) advance the top 2 teams per group. This is configurable if needed for other competitions.

---

## 9. Real Cron Route (`src/app/api/cron/ingest/route.ts`)

Replaces the existing no-op stub. Keeps the same `CRON_SECRET` validation from Stage 1.

### 9.1 Full Implementation Flow

```
GET /api/cron/ingest
Authorization: Bearer <CRON_SECRET>

1. Validate CRON_SECRET → 401 if missing/wrong

2. Find all rooms with:
   - status IN ('group_stage')                ← group stage only for Phase 4
   - external_competition_id IS NOT NULL      ← linked to football-data.org

3. For each room (rate-limit: 6s delay between API calls):
   a. Get FOOTBALL_DATA_API_KEY from process.env
   b. fetchStandings(room.external_competition_id, apiKey)
   c. Build countryExternalIdMap from countries table (code → external_team_id)
   d. Call ingestGroupStageStandings(roomId, standings, roomCountryCodes, map, admin)
   e. Log result per room
   f. Broadcast Realtime update (happens via DB UPDATE events automatically)

4. Return { ok: true, processed: N, results: [...] }
```

### 9.2 Rate Limiting

```typescript
// Process one room per iteration, with a configurable delay between API calls
const RATE_LIMIT_DELAY_MS = 6000; // 10 calls/min → 6s apart

for (let i = 0; i < rooms.length; i++) {
  if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);
  try {
    const result = await processRoom(rooms[i], admin, apiKey);
    results.push({ roomId: rooms[i].id, ...result });
  } catch (error) {
    // Log and continue — one failed room must not crash the entire run
    results.push({ roomId: rooms[i].id, error: String(error) });
  }
}
```

### 9.3 Idempotency guarantee

The ingest can run 96 times/day (every 15 minutes). The `ingestGroupStageStandings` function skips any `room_countries` row where `qualified !== null`. Re-running the cron with the same standings data does nothing — no duplicate updates, no double-eliminations.

### 9.4 Error handling

- One failed room does not crash the cron. Errors are collected and returned in the response.
- A `FootballDataError` with `statusCode === 429` (rate limit exceeded) logs a warning and skips to the next cycle.
- The cron always returns `200 OK` (Vercel considers non-200 as cron failure, which triggers retries).

---

## 10. Realtime Extension (`src/lib/supabase/realtime.ts`)

Add `subscribeGroupStage` — subscribes to all three tables needed for the group stage view:

```typescript
export interface GroupStageCallbacks {
  onCountryUpdated: (rc: Partial<RoomCountry>) => void;    // room_countries UPDATE
  onPlayerUpdated: (player: Partial<Player>) => void;       // players UPDATE
  onRoomUpdated: (room: Partial<RoomPublic>) => void;       // rooms UPDATE (status → knockout)
}

/**
 * Subscribe to all Realtime events needed by the Group Stage page.
 * Returns an unsubscribe function.
 */
export function subscribeGroupStage(
  roomId: string,
  callbacks: GroupStageCallbacks
): () => void
```

Uses a single Supabase channel with three listeners (more efficient than three separate channels).

---

## 11. Group Stage Page

### 11.1 Server Component (`page.tsx`)

```typescript
export default async function GroupStagePage({ params }) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/group-stage`);

  // Parallel fetches
  const [roomResult, playersResult, roomCountriesResult, countriesResult] =
    await Promise.all([
      room query (id, status, host_user_id, win_rule, stake_amount),
      players query (id, name, avatar_emoji, assigned_country, is_eliminated, user_id),
      room_countries query (country_code, qualified),
      countries query (code, name, flag_emoji),
    ]);

  const room = roomResult.data;
  if (!room) notFound();

  // Status routing
  if (room.status === 'drawn')    → show "waiting for host" overlay (still render page)
  if (room.status === 'knockout') redirect(`/room/${roomId}/ladder`);
  if (room.status === 'finished') redirect(`/room/${roomId}/winner`);
  if (room.status === 'lobby')    redirect(`/room/${roomId}/lobby`);

  const isHost = user.id === room.host_user_id;

  return (
    <GroupStageRealtime
      roomId={roomId}
      initialRoom={room}
      initialPlayers={players}
      initialRoomCountries={roomCountries}
      countriesMap={new Map(countries.map(c => [c.code, c]))}
      isHost={isHost}
    />
  );
}
```

### 11.2 Group Stage Visual Layout (Mobile-first)

```
╔═════════════════════════════════════════════════╗
║  [Room header from layout.tsx]                  ║
╠═════════════════════════════════════════════════╣
║  GROUP STAGE                                    ║
║  ── Active Players ──────────────────────────── ║
║  ┌──────────────────┐ ┌──────────────────┐      ║
║  │ 🏆  Alice    🇫🇷 │ │ ⚽  Bob      🇧🇷 │      ║
║  │ France       ✓   │ │ Brazil       ✓   │      ║
║  │ [SUCCESS BORDER] │ │ [SUCCESS BORDER] │      ║
║  └──────────────────┘ └──────────────────┘      ║
║                                                 ║
║  ── Knocked Out in Groups ─────────────────── ║
║  ┌──────────────────┐                           ║
║  │ 🦁  Carol    🇩🇪 │ (faded, red border)       ║
║  │ Germany   ❌      │                           ║
║  └──────────────────┘                           ║
║                                                 ║
║  ── Undecided ──────────────────────────────── ║
║  ┌──────────────────┐                           ║
║  │ 🎯  Dave     🇪🇸 │ (neutral styling)          ║
║  │ Spain             │                           ║
║  └──────────────────┘                           ║
║                                                 ║
║  ─── HOST OVERRIDE (host only) ──────────────── ║
║  ┌──────────────────────────────────────────┐  ║
║  │ 🇫🇷 France   [✓ Qualified] [Knocked Out]│  ║
║  │ 🇧🇷 Brazil   [✓ Qualified] [Knocked Out]│  ║
║  │ 🇩🇪 Germany  [Qualified]   [✓ Knocked] │  ║
║  │ 🇪🇸 Spain    [Qualified]   [Knocked Out]│  ║
║  └──────────────────────────────────────────┘  ║
║                                                 ║
║  [Build Knockout Bracket]  ← enabled when all  ║
║                              countries decided  ║
╚═════════════════════════════════════════════════╝
```

### 11.3 `GroupStageRealtime.tsx` ("use client")

Manages live state:
- `players` — starts from `initialPlayers`, updates on `players` UPDATE events
- `roomCountries` — starts from `initialRoomCountries`, updates on `room_countries` UPDATE events
- Handles `rooms` UPDATE for `knockout` status → `router.push(/ladder)`

Computes derived views:
- `alivePlayers` — players whose `is_eliminated === false` (sorted by joined_at)
- `eliminatedPlayers` — players whose `is_eliminated === true`
- `undecidedPlayers` — players whose assigned country has `qualified === null`
- `allDecided` — every `room_countries` row has `qualified !== null`
- `isReady` — `allDecided && players.length === totalSlots`

Renders:
- "Active Players" section
- "Knocked Out in Groups" section (empty if none)
- "Undecided" section (shown while group stage in progress)
- `HostOverridePanel` (if `isHost`)
- "Build Knockout Bracket" button (if `isHost && allDecided`)

Also handles the `status === 'drawn'` waiting state:
```tsx
{room.status === 'drawn' && !isHost && (
  <div>Waiting for host to advance to Group Stage…</div>
)}
```

### 11.4 `GroupStatusCard.tsx`

Displays one player's current group stage status.

```typescript
type CardState = 'alive' | 'eliminated' | 'undecided';

interface GroupStatusCardProps {
  player: Pick<Player, 'id' | 'name' | 'avatar_emoji' | 'assigned_country' | 'is_eliminated'>;
  country: { code: string; name: string; flag_emoji: string } | null;
  qualified: boolean | null;  // from room_countries
  isCurrentUser: boolean;
}
```

**Visual states:**
- `'alive'` (`qualified = true`): green border + `✓` indicator
- `'eliminated'` (`qualified = false` or `is_eliminated`): red border + `❌` + faded opacity
- `'undecided'` (`qualified = null`): neutral styling, muted border

Each card shows: avatar emoji, player name, country flag + name, status indicator.

### 11.5 `HostOverridePanel.tsx` ("use client")

The host control panel. Shows one row per selected country with two action buttons.

```typescript
interface HostOverridePanelProps {
  roomId: string;
  roomCountries: { country_code: string; qualified: boolean | null }[];
  countriesMap: Map<string, { code: string; name: string; flag_emoji: string }>;
}
```

Uses `useActionState(markQualification, null)` for the form state. Each country row has two buttons:
- **"Qualified"** — marks `qualified = true`; highlighted gold when currently selected
- **"Knocked Out"** — marks `qualified = false`; highlighted red when currently selected
- Both buttons are normal (un-highlighted) when `qualified === null`

Submitting any override is instant (no page reload). The Realtime subscription on `GroupStageRealtime` catches the update and refreshes the player cards automatically.

---

## 12. Security Checklist for Phase 4

| # | Control | Location | How |
|---|---------|----------|-----|
| 1 | Status transitions are host-only | `startGroupStage`, `buildKnockout` | `host_user_id !== user.id` → error |
| 2 | Qualification overrides are host-only | `markQualification` | Same check |
| 3 | Cron validates `CRON_SECRET` before any work | `/api/cron/ingest` | Unchanged from Stage 1 |
| 4 | API key never reaches the client | `/api/cron/ingest` + `football-data.ts` | `FOOTBALL_DATA_API_KEY` only in server context |
| 5 | Ingest is idempotent | `ingest.ts` | Skips rows where `qualified !== null` |
| 6 | One failed room doesn't crash cron | `/api/cron/ingest` | Per-room try/catch with error aggregation |
| 7 | Rate limit: max 6s between API calls | `/api/cron/ingest` | `sleep(6000)` between room iterations |
| 8 | `markQualification` reversal is safe | `markQualification` | Setting `is_eliminated = false` only when `qualified = true` override is confirmed |
| 9 | Group stage page requires auth | `page.tsx` | Server-side redirect if no session |
| 10 | countryCode validated against room | `markQualification` | Query `room_countries` to confirm country belongs to room |

---

## 13. Testing Plan

### 13.1 Unit Tests

---

**`tests/unit/lib/football-data.test.ts`** — API client with mocked fetch

| Test | Assertion |
|------|-----------|
| `fetchStandings` sends correct URL | URL contains `/competitions/{id}/standings` |
| `fetchStandings` sends `X-Auth-Token` header | Header present with correct value |
| `fetchStandings` returns parsed standings array | Returns `FdStandingGroup[]` |
| `fetchStandings` throws `FootballDataError` on 401 | `statusCode === 401` |
| `fetchStandings` throws on 429 (rate limited) | `statusCode === 429` |
| `fetchFinishedGroupMatches` filters FINISHED status | Only FINISHED matches returned |
| `FootballDataError` is an `Error` instance | `instanceof Error === true` |

---

**`tests/unit/lib/ingest.test.ts`** — Core ingest logic with mock Supabase

| Test | Assertion |
|------|-----------|
| Qualifies top 2 in a 4-team group | 2 countries marked qualified |
| Eliminates bottom 2 in a 4-team group | 2 countries marked eliminated |
| Skips incomplete groups (not all games played) | `skippedIncomplete` count increases |
| Idempotent: skips already-decided countries | No DB writes if `qualified !== null` |
| Eliminates player when country knocked out | `players.is_eliminated = true` |
| Skips countries not in this room | No DB writes for non-room countries |
| Returns correct counts | `countriesUpdated` and `playersEliminated` match expectations |

---

**`tests/unit/components/room/group-stage/GroupStatusCard.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders player avatar emoji | Emoji visible |
| Renders player name | Name text visible |
| Renders country flag and name | Country info visible |
| `qualified=true` → shows ✓ and success styling class | Green indicator present |
| `qualified=false` → shows ❌ and danger class | Red indicator + faded |
| `qualified=null` → neutral, no status indicator | No ✓ or ❌ |
| Current user card has visual distinction | "You" indicator or border variation |

---

**`tests/unit/components/room/group-stage/HostOverridePanel.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders one row per country | Row count = countries length |
| Renders country flag and name | Both visible per row |
| `qualified=true` → "Qualified" button highlighted | Gold highlight/selected class |
| `qualified=false` → "Knocked Out" button highlighted | Red highlight/selected class |
| `qualified=null` → neither button highlighted | No highlight on either |
| Both buttons present for each country | 2 buttons × N countries |

---

### 13.2 E2E Tests (Playwright)

**`tests/e2e/group-stage.spec.ts`** — 9 scenarios

Prerequisites: `.env.local` with Supabase credentials, at minimum a test host account.

| Scenario | Steps | Expected |
|----------|-------|----------|
| **Unauthenticated redirect** | Navigate to group-stage without session | Redirects to sign-in |
| **Group stage page loads** | Create room → draw → host clicks "Go to Group Stage" | Group stage page shows with player cards |
| **All players visible** | After navigating to group stage | Every player has a card in Undecided or Alive section |
| **Host override: mark knocked out** | Host clicks "Knocked Out" for a country | Player card moves to "Knocked Out in Groups" section; red styling applied |
| **Host override: mark qualified** | Host clicks "Qualified" for a country | Player card shows green alive styling; ✓ visible |
| **Host override: reversal** | Host marks knocked out then qualified again | Player card moves back to Alive section |
| **Build Knockout enabled when all decided** | Host marks all countries | "Build Knockout Bracket" button becomes enabled |
| **Cron route: no CRON_SECRET → 401** | `GET /api/cron/ingest` (no header) | Returns 401 |
| **Cron route: correct CRON_SECRET → 200** | `GET /api/cron/ingest` with correct header | Returns 200 with `{ ok: true }` |
| **Mobile layout at 375px** | Resize + navigate | Page scrollable; no horizontal overflow |

---

### 13.3 Type Safety

```bash
npm run typecheck   # 0 errors required
```

### 13.4 Build Verification

```bash
npm run build   # must exit 0
```

Expected routes after Phase 4:
```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /room/join
├ ƒ /api/competitions
├ ƒ /api/cron/ingest         ← real implementation
├ ƒ /auth/callback
├ ƒ /auth/sign-in
├ ƒ /auth/sign-up
├ ƒ /room/[id]/draw
├ ƒ /room/[id]/group-stage   ← NEW
├ ƒ /room/[id]/join
├ ƒ /room/[id]/lobby
└ ƒ /room/create
```

---

## 14. Implementation Step Order

| Step | Task | Files |
|------|------|-------|
| 1 | Realtime migration (room_countries) | `supabase/migrations/20240104000000_realtime_phase4.sql` |
| 2 | `football-data.ts` API client | `src/lib/football-data.ts` |
| 3 | `ingest.ts` core logic | `src/lib/ingest.ts` |
| 4 | `subscribeGroupStage` in realtime helper | `src/lib/supabase/realtime.ts` |
| 5 | `startGroupStage`, `markQualification`, `buildKnockout` actions | `src/actions/room.ts` |
| 6 | Update `DrawSummary.tsx` — pass `isHost`, conditional CTA | `draw/_components/DrawSummary.tsx` |
| 7 | Update `DrawOrchestrator.tsx` — pass `isHost` to `DrawSummary` | `draw/_components/DrawOrchestrator.tsx` |
| 8 | `GroupStatusCard.tsx` | `group-stage/_components/` |
| 9 | `HostOverridePanel.tsx` | `group-stage/_components/` |
| 10 | `GroupStageRealtime.tsx` | `group-stage/_components/` |
| 11 | Group Stage page (`/room/[id]/group-stage/page.tsx`) | `group-stage/page.tsx` |
| 12 | Replace cron route stub with real implementation | `src/app/api/cron/ingest/route.ts` |
| 13 | Unit tests (4 suites) | `tests/unit/lib/`, `tests/unit/components/room/group-stage/` |
| 14 | E2E tests | `tests/e2e/group-stage.spec.ts` |
| 15 | Typecheck + build + test verification | `npm run typecheck && npm run build && npm test` |

---

## 15. Phase 4 Definition of Done

| Check | Criterion |
|-------|-----------|
| `npm run typecheck` | Zero TypeScript errors |
| `npm run build` | Exit 0; 13 routes |
| `npm test` | All tests pass (181 existing + Phase 4 tests) |
| Realtime migration applied | `room_countries` in `supabase_realtime` publication |
| `startGroupStage` | Host-only; transitions `drawn` → `group_stage`; idempotent |
| All draw-page clients redirect | Realtime `rooms` UPDATE detected → `router.push(/group-stage)` |
| Group stage page auth guard | Unauthenticated visit redirects to sign-in |
| Player cards shown in correct sections | Active / Knocked Out / Undecided sections populate correctly |
| `GroupStatusCard` shows correct styling | Green for alive, red+faded for eliminated, neutral for undecided |
| Host override: qualify country | Player card moves to Alive section; Realtime update instant |
| Host override: knock out country | Player moves to "Knocked Out in Groups"; player `is_eliminated = true` |
| Host override: reversal | Qualifying a knocked-out country restores the player |
| `markQualification` idempotent | Calling twice with same values → no double-update |
| "Build Knockout" enabled when all decided | Button enabled only when all `room_countries.qualified !== null` |
| `buildKnockout` stub | Updates status to 'knockout'; redirects to `/ladder` (404 until Phase 5) |
| Cron: `CRON_SECRET` validated | No secret → 401; correct secret → 200 |
| Cron: processes `group_stage` rooms | Only rooms with `status='group_stage'` AND `external_competition_id` |
| Cron: idempotent ingest | Re-running with same standings → no duplicate updates |
| Cron: one room failure is isolated | Other rooms still processed if one throws |
| `football-data.ts` sends correct auth header | `X-Auth-Token` present |
| Mobile UX at 375px | All Phase 4 pages usable on 375px viewport |

---

## 16. Notes on football-data.org Setup

**Important:** For the cron ingestion to work in a real game, someone must populate `countries.external_team_id` for the teams in the selected competition. This is a **one-time admin step** per competition:

1. Fetch the competition's teams: `GET /v4/competitions/{id}/teams`
2. Match each team to a country code in the `countries` table by name/shortName
3. `UPDATE countries SET external_team_id = {fd_id} WHERE code = '{code}'`

This can be a simple admin script run once before a tournament. For testing, rooms without `external_competition_id` use the host manual override only — the cron skips them.

---

## 17. What Phase 5 Builds Next

Phase 4 ends with:
- All countries decided (qualified / knocked-out)
- `rooms.status = 'knockout'` (triggered by `buildKnockout`)
- Redirect to `/room/[id]/ladder` (404 until Phase 5)

Phase 5 picks up from the `knockout` status:
- **Build-Knockout step**: construct `room_teams` — surviving player countries get `player_id` attached (gold, shown with player name), non-room qualifiers become filler teams (flag only)
- **The Ladder**: mobile-friendly horizontally-scrolling bracket from `room_teams` + `matches`
- **Match advancement**: winner advances (update `current_stage`), loser eliminated (`is_eliminated = true`)
- **Cron extended**: Phase 5 extends the cron route to handle knockout matches in addition to group stage
