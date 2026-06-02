# Public/Private Rooms and Assignment Modes: Implementation Plan

## Goal

Evolve WinCup from one fixed room flow into two configurable game flows:

1. **Random assignment**: the host chooses a country pool, players join, and the system randomly assigns one selected country to each player when the host starts the draw.
2. **Player choice**: the host chooses a country pool, players join by selecting an available country from that pool, and the host starts the room after at least two players have joined with countries.

The room can also be either:

1. **Public**: visible on the dashboard while still waiting in the lobby.
2. **Private**: hidden from public listings and joinable only through a room code/link.

The group-stage outcome remains database-driven by `countries.is_knocked_out` and `rooms.fifa_stage`.

## Current State Summary

Current implementation assumptions that must change:

- `rooms` has no visibility, assignment mode, or searchable room title.
- `room_countries` is the selected country pool, but the flow assumes one player per selected country before draw.
- `Validation.countrySelection` requires at least 4 countries and caps at 36.
- `assignCountries` requires `players.length === countryCodes.length`.
- Lobby readiness is based on every country slot being filled.
- Join page does not allow selecting a country.
- Dashboard only shows rooms the user has hosted or joined.
- Private/public discovery does not exist.

## Product Rules

### Room Visibility

- `private`: not listed on the public dashboard. Users join only with code/link.
- `public`: listed on the dashboard only while `rooms.status = 'lobby'`.
- Started public rooms (`drawn`, `group_stage`, `knockout`, `finished`) must not appear in the public room list.
- Started rooms remain visible only in “My Rooms” for joined players and hosts.

### Assignment Mode

#### Random Assignment

- Host chooses a pool of countries.
- Minimum selected countries: `2`.
- Maximum selected countries: every available country where `countries.is_knocked_out = false`.
- No fixed upper limit should be hardcoded in app logic.
- Host can start the room when:
  - room has at least `2` players, and
  - joined player count is less than or equal to selected country count.
- The system randomly assigns each joined player one country from the selected pool.
- Not every selected country needs to be assigned.
- Unassigned selected countries remain as neutral room countries for standings/fixtures and possible future bracket usage.

#### Player Choice

- Host chooses a pool of countries.
- Joining players choose one available country from the pool.
- One country can be held by only one player in the same room.
- Minimum start condition: at least `2` players have joined and each has an assigned country.
- Maximum players: selected country count.
- When all selected countries are taken, the room is full.
- When the host starts the room, no additional players can join.
- No draw animation is required for player choice. The host can move the room directly from `lobby` to `group_stage`.

### Host Playing

- Existing “I’m playing in this room” behavior remains.
- In random mode, the host is inserted as a player without a country, then receives a random country on start.
- In player-choice mode, if the host is playing, the host must choose a country during room creation or immediately after creation before being counted as a player.
- Recommended implementation: show a host country picker during create-room only when `assignment_mode = 'player_choice'` and `hostIsPlaying = true`.

### Stake / Price

- `stake_amount` remains display-only. WinCup does not process money.
- Public dashboard uses it as a filter/sort value only.

## Database Changes

Create a new migration, for example:

```text
supabase/migrations/20240111000000_room_visibility_assignment_mode.sql
```

### `rooms` Columns

Add:

```sql
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS room_name text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'random'
    CHECK (assignment_mode IN ('random', 'player_choice')),
  ADD COLUMN IF NOT EXISTS started_at timestamptz;
```

Recommended constraints:

```sql
ALTER TABLE rooms
  ADD CONSTRAINT rooms_room_name_length
  CHECK (room_name IS NULL OR char_length(trim(room_name)) BETWEEN 1 AND 60);
```

Backfill existing rows:

```sql
UPDATE rooms
SET room_name = COALESCE(room_name, host_name || '''s room')
WHERE room_name IS NULL;
```

Then optionally make `room_name` required:

```sql
ALTER TABLE rooms
  ALTER COLUMN room_name SET NOT NULL;
```

### Player Country Uniqueness

Prevent two players from choosing or receiving the same country inside one room:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_room_assigned_country_unique
  ON players (room_id, assigned_country)
  WHERE assigned_country IS NOT NULL;
```

Prevent duplicate membership for authenticated users:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_room_user_unique
  ON players (room_id, user_id)
  WHERE user_id IS NOT NULL;
```

### Public Room Discovery Indexes

Add discovery indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_rooms_public_lobby_discovery
  ON rooms (visibility, status, stake_amount, created_at DESC)
  WHERE visibility = 'public' AND status = 'lobby';

CREATE INDEX IF NOT EXISTS idx_rooms_assignment_mode
  ON rooms (assignment_mode);
```

Optional search support:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_rooms_room_name_trgm
  ON rooms USING gin (room_name gin_trgm_ops);
```

If avoiding extensions, use `ILIKE` for the first implementation and add trigram later only if needed.

### RLS Policy Changes

Current `rooms_authenticated_read` allows all authenticated users to read all rooms. That weakens the private-room idea. Recommended future policy:

- Authenticated users can read:
  - public lobby rooms,
  - rooms they host,
  - rooms where they are a player.
- Join-by-code and private room lookup should use Server Actions/admin client and return only safe fields.

Example direction:

```sql
DROP POLICY IF EXISTS "rooms_authenticated_read" ON rooms;

CREATE POLICY "rooms_read_public_or_member" ON rooms
  FOR SELECT
  TO authenticated
  USING (
    (visibility = 'public' AND status = 'lobby')
    OR host_user_id = auth.uid()
    OR id IN (
      SELECT p.room_id
      FROM players p
      WHERE p.user_id = auth.uid()
    )
  );
```

Because this affects multiple pages, apply after route handlers/server actions are ready to read private rooms safely.

## Type Changes

Update `src/lib/types/database.ts`:

```ts
export type RoomVisibility = "public" | "private";
export type AssignmentMode = "random" | "player_choice";
```

Add to `Room`:

```ts
room_name: string;
visibility: RoomVisibility;
assignment_mode: AssignmentMode;
started_at: string | null;
```

Update `RoomInsert`, `RoomPublic`, and all `Pick<RoomPublic, ...>` usages.

## Validation Changes

Update `src/lib/validation.ts`.

### Country Selection

Replace hardcoded `4` minimum and `36` maximum.

Recommended API:

```ts
countrySelection(codes: string[], availableCountryCount: number): string | null {
  if (codes.length < 2) return `Select at least 2 countries (currently ${codes.length})`;
  if (codes.length > availableCountryCount) return "Too many countries selected";
  return null;
}
```

Server action must compute `availableCountryCount` from non-knocked-out countries rather than trusting the client.

### New Validators

Add:

```ts
roomName(value: string): string | null
roomVisibility(value: string): string | null
assignmentMode(value: string): string | null
countryChoice(value: string): string | null
```

## Create Room Flow

### UI Changes

Update `src/app/room/create/_components/CreateRoomForm.tsx`.

Add fields:

- Room name.
- Assignment mode:
  - `Random assignment`
  - `Player choice`
- Visibility:
  - `Public`
  - `Private`
- Country pool selector:
  - minimum text changes from `4` to `2`.
  - count uses non-knocked-out countries.
- Conditional host country picker:
  - only when assignment mode is `player_choice` and host is playing.
  - options are selected country pool countries only.

Suggested layout:

1. Room details: room name, visibility, stake.
2. Host/player info.
3. Assignment mode.
4. Country pool.
5. Host country choice, conditional.
6. Submit.

### Server Action Changes

Update `createRoom` in `src/actions/room.ts`:

Parse:

```ts
roomName
assignmentMode
visibility
hostCountryCode
```

Validate:

- Room name valid.
- Assignment mode valid.
- Visibility valid.
- Selected country count at least `2`.
- Every selected country exists and `is_knocked_out = false`.
- If `assignmentMode = 'player_choice'` and host is playing:
  - `hostCountryCode` is required.
  - `hostCountryCode` must be in selected pool.
  - `hostCountryCode` must not be knocked out.

Insert `rooms` with:

```ts
room_name,
visibility,
assignment_mode,
stake_amount,
status: "lobby"
```

Insert `room_countries` as before.

Insert host player:

- Random mode: `assigned_country = null`.
- Player choice mode: `assigned_country = hostCountryCode`.

## Join Room Flow

### Join Page Data

Update `src/app/room/[id]/join/page.tsx` to fetch:

- `rooms.assignment_mode`
- `rooms.visibility`
- `rooms.room_name`
- selected room countries with `countries.is_knocked_out`
- players with `assigned_country`

### Join UI

Update `JoinRoomForm`:

- Random mode:
  - name + avatar only.
  - show country pool preview.
- Player choice mode:
  - name + avatar + country picker.
  - country picker shows only:
    - selected room countries,
    - not globally knocked out,
    - not already selected by another player.
  - disabled/taken countries can be shown as unavailable for clarity.

### Join Server Action

Update `joinRoom`:

Validate common rules:

- Authenticated.
- Room exists.
- Room status is `lobby`.
- User is not already in room.

For random mode:

- `assigned_country = null`.
- Room is full if player count is already equal to selected country count.

For player choice mode:

- `countryCode` is required.
- Country must be in `room_countries`.
- Country must not be globally knocked out.
- Country must not already be assigned in `players`.
- Insert player with `assigned_country = countryCode`.

Concurrency:

- Rely on the partial unique index `(room_id, assigned_country)` to reject race conditions.
- If insert fails due to unique violation, return: `That country was just taken. Choose another one.`

## Start Room Flow

The current `startDraw` assumes all country slots are full. Replace it with mode-aware behavior.

### Recommended Action Shape

Keep a single UI button but make the action mode-aware:

```ts
startRoom(prevState, formData)
```

Or keep `startDraw` and branch internally. A rename is cleaner but requires more file updates.

### Random Mode Start

Rules:

- Host-only.
- Room status must be `lobby`.
- At least `2` players.
- At least as many selected countries as joined players.
- Assign each joined player exactly one random country from selected pool.
- Use a random subset of selected countries when selected countries exceed players.
- Transition room to `drawn`.
- Draw page animation reveals assignments.

Required draw helper change:

```ts
assignCountries(players, countryCodes)
```

Should no longer require equal lengths. New behavior:

- throw if `countryCodes.length < players.length`.
- securely shuffle country codes.
- take first `players.length`.
- assign one per player.

Add unit tests for:

- equal player/country count.
- more countries than players.
- fewer countries than players throws.
- no duplicate assigned country.

### Player Choice Start

Rules:

- Host-only.
- Room status must be `lobby`.
- At least `2` players.
- Every joined player must have `assigned_country`.
- Transition directly to `group_stage`.
- Set `rooms.started_at = now()`.
- No draw page is needed because countries are already known.

### Realtime Redirects

Lobby Realtime already listens for room status updates.

Update routing:

- `status = drawn`: go to draw page.
- `status = group_stage`: go to group-stage page.

This already mostly exists, but tests should cover both branches.

## Lobby Changes

Random mode:

- Show player count and selected country pool.
- Button label: `Start Draw`.
- Enable when at least `2` players and `players.length <= countryCount`.
- Do not require all country slots to be filled.

Player choice mode:

- Show chosen country beside each player.
- Show remaining available countries.
- Button label: `Start Room`.
- Enable when at least `2` players have selected countries.
- Disable joining when all selected countries are taken.

Update `LobbyProgress` copy:

- Random: `X players joined. Host can start after 2 players.`
- Player choice: `X players ready. Host can start after 2 players choose countries.`

## Dashboard Changes

### Structure

Dashboard should have two main sections:

1. **My Rooms**
   - Rooms the user hosts or joined.
   - Includes started and finished rooms.
   - Appears at the top.
   - Can be a tab/page segment if the list grows.

2. **Public Waiting Rooms**
   - Only rooms where:
     - `visibility = 'public'`
     - `status = 'lobby'`
     - current user is not already a player/host, or is shown with a “You are already in this room” state and routed to lobby.

### Public Room Filters

Use URL query params so filters are shareable and server-rendered:

```text
/dashboard?q=world&mode=random&minStake=5&maxStake=20&from=2026-06-01&to=2026-06-30&sort=stake_desc
```

Filters:

- Search by `room_name`.
- Stake range:
  - min stake.
  - max stake.
  - include no-stake rooms toggle if needed.
- Assignment mode:
  - all.
  - random.
  - player choice.
- Date range:
  - created from.
  - created to.
- Sort:
  - newest first.
  - oldest first.
  - stake low to high.
  - stake high to low.

### Query Strategy

Create a server helper:

```text
src/lib/rooms/public-room-query.ts
```

Responsibilities:

- Parse and normalize search params.
- Build Supabase filters.
- Apply stable sort.
- Limit/paginate results.
- Return display model with player count and country count.

Do not put complex filtering directly in `dashboard/page.tsx`.

### Pagination

Start with a simple limit, for example `20`.

Future extension:

- `page` search param.
- keyset pagination by `created_at` for newest sort.

## Public / Private Routing

### Public Room Join

Public dashboard cards link to:

```text
/room/[id]/join
```

### Private Room Join

Private rooms are not discoverable.

Existing code-based join flow should continue to work:

```text
/room/join
```

The code lookup action should use the admin client and return only safe room info.

## Room Cards

Public room cards should show:

- Room name.
- Host display name.
- Assignment mode.
- Stake amount.
- Player count / country count.
- Created date.
- Visibility badge only if helpful.
- Join button.

My room cards should show:

- Room name.
- Status.
- Assignment mode.
- Stake amount.
- Player count / country count.
- Role: host/player.
- Continue button routed by status.

## Testing Plan

### Unit Tests

#### Validation

File:

```text
tests/unit/lib/validation.test.ts
```

Add tests:

- country selection accepts 2 countries.
- country selection rejects 1 country.
- country selection allows all available countries.
- country selection rejects more than available countries.
- assignment mode validator accepts `random` and `player_choice`.
- visibility validator accepts `public` and `private`.
- room name validator rejects empty and too-long names.

#### Draw Logic

File:

```text
tests/unit/lib/draw.test.ts
```

Add/update tests:

- assigns one country per player when counts are equal.
- assigns one country per player when country pool is larger than players.
- never assigns duplicate countries.
- throws when player count is greater than country count.

#### Create Room Components

Files:

```text
tests/unit/components/room/create/CreateRoomForm.test.tsx
tests/unit/components/room/create/CountryGrid.test.tsx
```

Add tests:

- assignment mode toggle renders and submits.
- visibility toggle renders and submits.
- room name input renders and submits.
- minimum country copy says `2`, not `4`.
- player-choice mode shows host country picker when host is playing.
- random mode hides host country picker.
- knocked-out countries remain disabled.

#### Join Room Components

Files:

```text
tests/unit/components/room/join/JoinRoomForm.test.tsx
```

Add tests:

- random room join does not require country choice.
- player-choice room join requires country choice.
- taken country cannot be selected.
- knocked-out country cannot be selected.
- submitted form includes `countryCode` only for player-choice mode.

#### Dashboard Components

Recommended new files:

```text
tests/unit/components/dashboard/PublicRoomFilters.test.tsx
tests/unit/components/dashboard/PublicRoomCard.test.tsx
tests/unit/components/dashboard/MyRoomCard.test.tsx
```

Add tests:

- filters render current query values.
- mode filter updates query params.
- stake fields preserve numeric values.
- public room card links to join page.
- my room card routes by room status.

### Integration Tests

#### SQL Schema Assertions

File:

```text
tests/integration/db/schema_assertions.sql
```

Add assertions:

- `rooms.visibility` exists.
- `rooms.assignment_mode` exists.
- `rooms.room_name` exists.
- `rooms.started_at` exists.
- visibility check allows only `public/private`.
- assignment mode check allows only `random/player_choice`.
- partial unique index for `(room_id, assigned_country)` exists.
- public lobby discovery index exists.
- room read RLS policy supports public/member model.

#### Server Action Integration

If current test harness supports Server Action testing, add:

```text
tests/integration/actions/create-room.test.ts
tests/integration/actions/join-room.test.ts
tests/integration/actions/start-room.test.ts
```

Test cases:

- creates public random room with 2 countries.
- creates private player-choice room with host-selected country.
- rejects knocked-out selected country.
- random join inserts player with `assigned_country = null`.
- player-choice join inserts selected country.
- player-choice join rejects taken country.
- player-choice join rejects globally knocked-out country.
- random start with 2 players and 10 selected countries assigns 2 unique countries and moves to `drawn`.
- random start rejects when players exceed selected countries.
- player-choice start with 2 assigned players moves to `group_stage`.
- player-choice start rejects if only 1 player joined.

### E2E Tests

Files:

```text
tests/e2e/create-room.spec.ts
tests/e2e/join.spec.ts
tests/e2e/lobby.spec.ts
tests/e2e/dashboard.spec.ts
tests/e2e/draw.spec.ts
```

Add scenarios:

1. **Public random room discovery**
   - Host creates public random room with stake.
   - Another user sees it on dashboard public list.
   - User filters by assignment mode and stake.
   - User joins.

2. **Private room hidden**
   - Host creates private room.
   - Another user does not see it on dashboard.
   - User can join by code.

3. **Random room can start before all country slots filled**
   - Host selects more countries than players.
   - Two players join.
   - Host starts draw.
   - Players receive unique assigned countries.

4. **Player-choice room**
   - Host creates public player-choice room.
   - Host chooses a country if playing.
   - Another user joins and selects a different country.
   - Host starts room.
   - Users go directly to group stage.

5. **Player-choice country conflict**
   - Two users attempt same country.
   - One succeeds.
   - Other sees taken-country error or disabled option after refresh/realtime update.

## Implementation Phases

### Phase 1: Schema and Types

- Add migration for room visibility, assignment mode, room name, started timestamp.
- Add player country uniqueness index.
- Update TypeScript database types.
- Update schema assertions.

### Phase 2: Validation and Pure Logic

- Update country selection minimum from 4 to 2.
- Remove hardcoded maximum.
- Update draw helper to support larger country pools than player count.
- Add unit tests for validation and draw behavior.

### Phase 3: Create Room

- Add room name, visibility, and assignment mode UI.
- Add conditional host country picker for player-choice mode.
- Update `createRoom` server action.
- Update create-room unit/E2E tests.

### Phase 4: Join Room

- Update join page data fetch.
- Add country picker for player-choice rooms.
- Update `joinRoom` action.
- Add concurrency-safe handling for country conflicts.
- Update join unit/E2E tests.

### Phase 5: Lobby and Start Flow

- Update lobby readiness logic.
- Replace fixed “all players joined” readiness with mode-specific rules.
- Update start action to branch by assignment mode.
- Random mode starts draw.
- Player-choice mode starts group stage directly.
- Update realtime redirects.

### Phase 6: Dashboard Public Discovery

- Split dashboard into “My Rooms” and “Public Waiting Rooms”.
- Add filter/search/sort query params.
- Add public room query helper.
- Add room cards and filters.
- Add unit and E2E tests.

### Phase 7: RLS Hardening

- Restrict direct `rooms` reads so private rooms are not broadly visible.
- Ensure code-based join uses admin-backed safe lookup.
- Add RLS integration assertions.

## Important Edge Cases

- Two users choose the same country at almost the same time.
- A country is globally knocked out while a player-choice room is still in lobby.
- Host selected a country, then that country becomes knocked out before start.
- Public room becomes full while user is viewing dashboard.
- Host toggles assignment mode while countries are selected.
- Host is not playing in player-choice room, so no host country should be required.
- Stake is null and filters include min/max values.
- Existing rooms created before the migration need defaults.

## Recommended Decisions Before Implementation

1. Should player-choice rooms allow players to change their country while still in lobby?
   - Recommended: yes, until host starts, with the same uniqueness checks.

2. Should host choose their player-choice country during room creation or after room creation?
   - Recommended: during creation if host is playing. It avoids creating a host player without a country.

3. Should public rooms show private room codes?
   - Recommended: no. Public cards link by room ID only; code remains for invite/share UX.

4. Should random rooms permit late joins after host starts draw?
   - Recommended: no. `rooms.status !== 'lobby'` blocks all joins.

5. Should player-choice rooms have a draw page?
   - Recommended: no. Route directly to group stage because assignments are already visible.

## Success Criteria

- Host can create either random or player-choice rooms.
- Host can create public or private rooms.
- Public lobby rooms appear on dashboard with filters and sorting.
- Private rooms never appear in public listings.
- Joined/hosted rooms remain visible in “My Rooms” even after starting.
- Random assignment works with any selected country count from 2 up to all available countries.
- Player-choice joiners select unique available countries.
- Host can start player-choice room when at least two players have countries.
- Started rooms disappear from public room discovery.
- All new behavior has unit, integration, and E2E coverage.
