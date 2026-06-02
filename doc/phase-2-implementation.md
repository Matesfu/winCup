# WinCup — Phase 2 Implementation Plan: Join Room & Lobby

> **Prerequisites:** Phase 1 complete — auth (sign-up/sign-in), Create Room page, `createRoom` Server Action, all database migrations applied, 104/104 unit tests passing.
>
> **Builds on:** `src/actions/room.ts`, `src/components/ui/{Button,Card,Input,Badge,LoadingSpinner,EmojiPicker}`, `src/lib/validation.ts`, `src/lib/supabase/{client,server}.ts`, `src/lib/types/database.ts`

---

## 1. Scope & Deliverables

| # | Deliverable | Route / Location |
|---|-------------|-----------------|
| 1 | Realtime migration (publish tables) | `supabase/migrations/20240103000000_realtime.sql` |
| 2 | Code-entry page (public, no auth) | `/room/join` |
| 3 | Room-specific join form (auth-gated) | `/room/[id]/join` |
| 4 | `lookupRoomByCode` + `joinRoom` Server Actions | `src/actions/room.ts` (extend existing) |
| 5 | Room shell layout (auth + room fetch) | `src/app/room/[id]/layout.tsx` |
| 6 | Lobby page — Server Component shell | `/room/[id]/lobby` |
| 7 | Lobby Realtime Client Component | `/room/[id]/lobby/_components/LobbyRealtime.tsx` |
| 8 | `startDraw` Server Action stub | `src/actions/room.ts` (Phase 3 will fill in the draw logic) |
| 9 | New UI components (5 components) | `src/components/ui/` |
| 10 | New lobby sub-components (4 components) | `/room/[id]/lobby/_components/` |
| 11 | Validation additions (`roomCode`) | `src/lib/validation.ts` |
| 12 | Realtime helper module | `src/lib/supabase/realtime.ts` |
| 13 | Unit tests (6 new suites) | `tests/unit/` |
| 14 | E2E tests (2 new suites) | `tests/e2e/join.spec.ts` + `tests/e2e/lobby.spec.ts` |

**Out of scope for Phase 2:**
- The actual draw logic and animation (Phase 3)
- Status-based page routing beyond lobby (Phase 3+)
- Group stage / knockout bracket (Phases 4 & 5)
- football-data.org competition integration (Phase 4)

---

## 2. Folder Structure — Phase 2 Additions

```
src/
├── actions/
│   └── room.ts                     ← EXTEND: add lookupRoomByCode(), joinRoom(), startDraw()
│
├── app/
│   └── room/
│       ├── join/
│       │   └── page.tsx            ← NEW: public code-entry page (step 1 of join flow)
│       │
│       └── [id]/
│           ├── layout.tsx          ← NEW: room shell — auth guard + room/player fetch
│           │
│           ├── join/
│           │   ├── page.tsx        ← NEW: room-specific join form (step 2)
│           │   └── _components/
│           │       └── JoinRoomForm.tsx  ← "use client" — name/avatar/submit
│           │
│           └── lobby/
│               ├── page.tsx        ← NEW: Server Component — fetches initial data
│               └── _components/
│                   ├── LobbyRealtime.tsx  ← "use client" — owns Realtime channel + all lobby state
│                   ├── PlayerCard.tsx     ← animated player card
│                   ├── LobbyProgress.tsx  ← "X of Y players joined"
│                   └── StartDrawButton.tsx ← host-only CTA (stub for Phase 3)
│
├── components/
│   └── ui/
│       ├── CountryChip.tsx         ← NEW: flag + name pill, display-only
│       ├── RoomCodeDisplay.tsx     ← NEW: "use client" — code + clipboard copy button
│       ├── Toast.tsx               ← NEW: brief auto-dismiss success/error notification
│       ├── Divider.tsx             ← NEW: horizontal rule with optional label
│       └── JoinCodeInput.tsx       ← NEW: "use client" — room code input with auto-format
│
└── lib/
    ├── validation.ts               ← EXTEND: add roomCode() validator
    └── supabase/
        └── realtime.ts             ← NEW: typed Realtime channel helper

supabase/
└── migrations/
    └── 20240103000000_realtime.sql  ← NEW: publish players + rooms to Realtime

tests/
├── unit/
│   ├── lib/
│   │   └── validation.test.ts      ← EXTEND: roomCode test cases
│   └── components/
│       ├── ui/
│       │   ├── CountryChip.test.tsx      ← NEW
│       │   ├── RoomCodeDisplay.test.tsx  ← NEW
│       │   └── JoinCodeInput.test.tsx    ← NEW
│       └── room/
│           └── lobby/
│               ├── PlayerCard.test.tsx       ← NEW
│               └── LobbyProgress.test.tsx    ← NEW
└── e2e/
    ├── join.spec.ts          ← NEW: 10 join-flow scenarios
    └── lobby.spec.ts         ← NEW: 9 lobby scenarios including Realtime
```

---

## 3. Migration — Realtime Publication

File: `supabase/migrations/20240103000000_realtime.sql`

Supabase Realtime's `postgres_changes` feature requires tables to be added to the `supabase_realtime` publication. Without this, change events are never emitted even when a client subscribes.

```sql
-- ─── Enable Realtime change events for Phase 2 tables ────────────────────────
-- These tables need to broadcast INSERT and UPDATE events to all subscribers.
-- Idempotent: IF NOT EXISTS guard prevents errors on re-run.

DO $$
BEGIN
  -- players: broadcast JOIN events (INSERT) to all lobby participants
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE players;
  END IF;

  -- rooms: broadcast STATUS changes (UPDATE) to redirect clients when draw starts
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  END IF;
END $$;
```

> **Why these two tables:** The lobby needs to react to two events in real time — new players joining (`players` INSERT) and the host starting the draw (`rooms` UPDATE when `status` changes to `'drawn'`). All other tables are either not needed for Phase 2 or already handled server-side.

---

## 4. The Join Flow (Two Steps, Two Routes)

The join flow is split into two distinct routes, each with a single responsibility:

```
User on landing page
      │
      ▼
  /room/join  ────── code entry form (public, no auth)
      │
      │  lookupRoomByCode() Server Action
      │  ├─ code invalid or room not found → error shown inline
      │  └─ room found → redirect("/room/[id]/join")
      │
      ▼
  /room/[id]/join  ── name + avatar form (auth-gated)
      │
      │  joinRoom() Server Action
      │  ├─ not authenticated → redirect("/auth/sign-in?redirectTo=/room/[id]/join")
      │  ├─ room not 'lobby' → error (game already started)
      │  ├─ room full → error (all spots taken)
      │  ├─ already joined → redirect("/room/[id]/lobby") gracefully
      │  └─ success → insert player → redirect("/room/[id]/lobby")
      │
      ▼
  /room/[id]/lobby  ── live lobby (auth-gated, Realtime)
```

**Why two routes instead of one multi-step page:**
- `/room/join` is a public route — users can bookmark it and share the URL
- `/room/[id]/join` has the room ID in the URL — the Server Component can fetch room details server-side before any form renders, giving instant preview of the room on first paint with no loading state

---

## 5. New Server Actions (`src/actions/room.ts` additions)

### 5.1 `lookupRoomByCode(prevState, formData)`

Validates the room code and finds the room. If found, redirects to the join page.

```
Input (FormData):
  code    string  required — user-entered code (WC-XXXX, tolerant of case/spaces)

Steps:
1. Parse + normalise code: trim → uppercase → ensure "WC-" prefix
2. Validate format: must match /^WC-[A-Z0-9]{4}$/  (Validation.roomCode)
   └ Invalid format → return { error: "Enter a valid room code (e.g. WC-AB23)" }

3. Lookup room by code using session client (public read, any authenticated or anon)
   └ Not found → return { error: "Room not found. Check the code and try again." }
   └ Status != 'lobby' → return { error: "That room's game has already started." }

4. redirect(`/room/${room.id}/join`)
```

### 5.2 `joinRoom(prevState, formData)`

Validates the join request and inserts the player. Called from `/room/[id]/join`.

```
Input (FormData):
  roomId        string   required — from hidden input
  playerName    string   required — 1–40 chars (trimmed)
  avatarEmoji   string   required — must be in ALLOWED_AVATARS set

Steps:
1. Check user is authenticated (session client)
   └ No session → redirect("/auth/sign-in?redirectTo=/room/[roomId]/join")

2. Validate inputs:
   └ playerName: Validation.hostName() (1–40 chars, non-empty)
   └ avatarEmoji: must be in ALLOWED_AVATARS
   └ roomId: non-empty UUID format

3. Fetch room (admin client) — verify still joinable:
   └ Not found → return { error: "Room not found." }
   └ Status != 'lobby' → return { error: "This game has already started. You cannot join." }

4. Fetch room_countries count — get total country count for this room

5. Fetch players count — current number of joined players

6. Capacity check:
   └ players.length >= room_countries.count → return { error: "This room is full." }

7. Duplicate-join check:
   └ user.id already in players for this room → redirect("/room/[roomId]/lobby")
   └ (graceful — user refreshed the page, they're already in)

8. Rate limit: max 10 room joins in last 30 minutes per user
   └ Exceeded → return { error: "Too many join attempts. Please wait a moment." }

9. Insert player (admin client):
   { room_id, user_id: user.id, name: playerName.trim(), avatar_emoji, is_eliminated: false }

10. redirect(`/room/${roomId}/lobby`)
```

**Why admin client for player insert:** The RLS policy on `players` has no direct INSERT policy (all writes go through Server Actions). Using the admin client keeps the RLS policies clean and ensures server-side validation always runs before any DB write.

### 5.3 `startDraw(roomId)` — Stub

Phase 3 will implement the real Fisher-Yates shuffle. Phase 2 provides the stub so the button infrastructure is in place.

```
Input:
  roomId    string

Steps:
1. Check authenticated session
2. Fetch room — verify host_user_id === auth.uid()
   └ Not host → return { error: "Only the host can start the draw." }
3. Verify room.status === 'lobby'
   └ Not lobby → return { error: "Draw has already been started." }
4. Fetch player count + room_countries count
5. Verify players.length === room_countries.length (all spots filled)
   └ Not full → return { error: "All players must join before the draw." }

6. STUB: update rooms.status = 'drawn'
   └ Note: Phase 3 replaces this with the full Fisher-Yates shuffle + player assignments
7. redirect(`/room/${roomId}/draw`)
   └ Note: /room/[id]/draw does not exist yet — Phase 3 will build it
   └ Phase 2 leaves this as redirect to a 404 page intentionally
```

> **Why include the status update in the stub:** Testing the Realtime flow (lobby clients see the `rooms` UPDATE event and redirect) is valuable Phase 2 work that doesn't require the draw logic.

---

## 6. New UI Components

### 6.1 `JoinCodeInput.tsx` (`"use client"`)

A specialised text input for room codes:
- Auto-uppercases all input
- Accepts typed input OR pasted full code ("WC-AB23" or "AB23")
- Normalises to display "WC-" prefix visually
- Filters non-alphanumeric characters
- Limits to 4 suffix characters
- Large, prominent font (`text-3xl tracking-widest font-mono`)
- Single-character-wide boxes optionally (or a single wide input)

```typescript
interface JoinCodeInputProps {
  value: string;
  onChange: (normalised: string) => void; // always "WC-XXXX" or empty
  error?: string;
  disabled?: boolean;
}
```

**Visual design:** Dark surface background, large gold text, gold border on focus. Shows "WC-" as a fixed prefix before the editable 4-char suffix.

### 6.2 `CountryChip.tsx`

Small, display-only pill showing a country's flag and name:
```typescript
interface CountryChipProps {
  code: string;
  name: string;
  flagEmoji: string;
  size?: "sm" | "md";   // sm = flag only; md = flag + name
}
```

- `sm`: emoji only, 2rem × 2rem rounded square
- `md`: emoji + truncated name, pill shape
- No hover/click interaction — purely informational
- Used in the lobby countries strip

### 6.3 `RoomCodeDisplay.tsx` (`"use client"`)

Prominently displays the room code with a copy-to-clipboard button:

```typescript
interface RoomCodeDisplayProps {
  code: string;         // e.g. "WC-AB23"
  className?: string;
}
```

- Displays code in large tabular mono font with gold colour
- Clipboard button with copy icon → calls `navigator.clipboard.writeText(code)`
- Brief visual feedback: icon changes to ✓ for 2 seconds after copy
- Also provides a "Share via WhatsApp" link with pre-filled message
- Accessible: copy button has `aria-label="Copy room code"`

### 6.4 `Toast.tsx`

A brief auto-dismissing notification (success or error):
```typescript
interface ToastProps {
  message: string;
  variant: "success" | "error" | "info";
  durationMs?: number;  // default 3000ms
  onDismiss?: () => void;
}
```

- Appears at top-centre of viewport
- Slides in from top with 200ms animation
- Auto-dismisses after `durationMs`
- Gold background for success, red for error
- Used for "Code copied!" feedback and non-blocking errors
- Accessible: `role="alert"`, `aria-live="polite"`

### 6.5 `Divider.tsx`

Simple horizontal rule with optional centred label:
```typescript
interface DividerProps {
  label?: string;
  className?: string;
}
```

Used to visually separate lobby sections (Countries / Players / Actions).

---

## 7. Realtime Helper (`src/lib/supabase/realtime.ts`)

A typed helper that wraps Supabase Realtime subscription management. Used by `LobbyRealtime.tsx` to avoid boilerplate.

```typescript
import { createClient } from "@/lib/supabase/client";
import type { Player, Room } from "@/lib/types/database";

export interface LobbyRealtimeCallbacks {
  onPlayerJoined: (player: Player) => void;
  onRoomUpdated: (room: Partial<Room>) => void;
}

/**
 * Subscribes to lobby Realtime events for a given room.
 * Returns an unsubscribe function — call it in the useEffect cleanup.
 *
 * Listens for:
 *   - players INSERT (new player joined)
 *   - rooms UPDATE (status changed — draw started)
 */
export function subscribeLobby(
  roomId: string,
  callbacks: LobbyRealtimeCallbacks
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`lobby:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "players",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => callbacks.onPlayerJoined(payload.new as Player)
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => callbacks.onRoomUpdated(payload.new as Partial<Room>)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
```

> **Why a helper module:** `LobbyRealtime.tsx` stays focused on rendering. The Realtime subscription code lives in one place. The unsubscribe function returned by `subscribeLobby` maps cleanly to `useEffect`'s cleanup return.

---

## 8. Room Shell Layout (`src/app/room/[id]/layout.tsx`)

A **Server Component** layout that wraps all `/room/[id]/*` pages. Provides:
1. A slim top header bar with room name + "← Leave" button
2. Auth redirect (not currently required — individual pages handle this)
3. Room-not-found handling

```typescript
// src/app/room/[id]/layout.tsx  (Server Component)
interface RoomLayoutParams {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export default async function RoomLayout({ params, children }: RoomLayoutParams) {
  const { id } = await params;
  const supabase = await createSessionClient();

  // Best-effort fetch for the header — individual pages do their own full fetch
  const { data: room } = await (supabase as any)
    .from("rooms")
    .select("code, host_name, status")
    .eq("id", id)
    .maybeSingle() as { data: { code: string; host_name: string; status: string } | null };

  if (!room) notFound(); // triggers the global not-found.tsx page

  return (
    <div className="flex min-h-full flex-col">
      {/* Room header bar */}
      <header className="sticky top-0 z-10 border-b border-white/5 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gold">{room.code}</span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">{room.host_name}&apos;s room</span>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Leave
            </Button>
          </form>
        </div>
      </header>

      {/* Page content */}
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
```

> **Note on the layout approach:** The layout does a lightweight `rooms` fetch (3 fields only) for the header. Each page does its own full fetch for the data it needs. This avoids over-fetching and keeps pages independently testable.

---

## 9. Join Room Pages

### 9.1 Code Entry Page (`/room/join/page.tsx`)

A **Server Component** page. Public — no auth required to see the code input.

```
┌─────────────────────────────────┐
│  🏆 WinCup                      │
├─────────────────────────────────┤
│                                 │
│  Join a Room                    │
│  Enter the room code from       │
│  your host.                     │
│                                 │
│  WC- [A][B][2][3]               │  ← JoinCodeInput (large, gold)
│                                 │
│  If invalid: "Room not found"   │
│                                 │
│  [Continue →]                   │
│                                 │
│  Don't have a code?             │
│  Create a Room →                │
└─────────────────────────────────┘
```

Uses `useActionState` on `lookupRoomByCode`. On success → Server Action redirects to `/room/[id]/join`. On error → inline error shown below the input.

### 9.2 Room-Specific Join Page (`/room/[id]/join/page.tsx`)

A **Server Component** page with auth guard.

```typescript
export default async function JoinRoomPage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const supabase = await createSessionClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${id}/join`);
  
  // Fetch room details + player counts for preview
  const { data: room } = ...  // code, host_name, status, win_rule, stake_amount
  const { data: countries } = ...  // count of selected countries
  const { data: players } = ...    // current players (for count)
  
  if (!room) notFound();
  if (room.status !== 'lobby') redirect(`/room/${id}/lobby`); // already in progress
  
  // Check if user already joined → redirect to lobby
  const alreadyJoined = players.some(p => p.user_id === user.id);
  if (alreadyJoined) redirect(`/room/${id}/lobby`);
  
  return (
    <main>
      {/* Room preview card */}
      {/* JoinRoomForm */}
    </main>
  );
}
```

**Layout (mobile-first):**

```
┌─────────────────────────────────┐
│  ← Back          Joining        │
│                  WC-AB23        │
├─────────────────────────────────┤
│  🏆  Alice's Room               │
│  Win: Last Team Standing        │
│  Stake: £10                     │
│  3 of 6 players joined          │
│                                 │
│  Countries:                     │
│  🇦🇷 🇧🇷 🇫🇷 🇪🇸 🇩🇪 🇵🇹         │
├─────────────────────────────────┤
│  Your display name              │
│  [_________________________]    │
│                                 │
│  Your avatar                    │
│  🏆 ⚽ 🎯 ...                   │
├─────────────────────────────────┤
│  [        Join Room          ]  │
└─────────────────────────────────┘
```

### 9.3 `JoinRoomForm.tsx` (`"use client"`)

Client Component orchestrating the name/avatar form:
- Manages: `playerName`, `avatarEmoji` state
- Uses `useActionState(joinRoom, null)`
- Re-uses `HostNameInput` and `EmojiPicker` from Phase 1 (same components, different context)
- Submit button disabled until name is non-empty

---

## 10. Lobby Page

### 10.1 Server Component Shell (`/room/[id]/lobby/page.tsx`)

Fetches initial state server-side, then hands off to the Realtime client component for live updates.

```typescript
export default async function LobbyPage({ params }: ...) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/lobby`);

  // Parallel fetches for initial render
  const [roomResult, playersResult, countriesResult] = await Promise.all([
    (supabase as any).from("rooms").select("*").eq("id", roomId).single(),
    (supabase as any).from("players").select("*").eq("room_id", roomId).order("joined_at"),
    (supabase as any).from("room_countries")
      .select("country_code, countries(code, name, flag_emoji)")
      .eq("room_id", roomId),
  ]);

  const room = roomResult.data;
  const players = playersResult.data ?? [];
  const countries = countriesResult.data ?? [];

  if (!room) notFound();

  // If room status has moved past 'lobby', redirect to the appropriate page
  // (Phase 3+ will add draw/group-stage routes here)
  if (room.status === "drawn") redirect(`/room/${roomId}/draw`); // Phase 3 page

  const isHost = user.id === room.host_user_id;

  return (
    <LobbyRealtime
      roomId={roomId}
      initialRoom={room}
      initialPlayers={players}
      initialCountries={countries}
      currentUserId={user.id}
      isHost={isHost}
    />
  );
}
```

**Why parallel fetches:** Room, players, and countries are independent queries. Running them in parallel with `Promise.all` cuts page load time by ~2×.

### 10.2 `LobbyRealtime.tsx` (`"use client"`)

The primary lobby UI. Manages live state and the Realtime channel.

```typescript
"use client"

interface LobbyRealtimeProps {
  roomId: string;
  initialRoom: RoomPublic;
  initialPlayers: Player[];
  initialCountries: { country_code: string; countries: CountryBasic }[];
  currentUserId: string;
  isHost: boolean;
}

// State managed:
// - players: Player[]  (starts with initialPlayers, grows via Realtime INSERT)
// - room: RoomPublic   (starts with initialRoom, updates via Realtime UPDATE)

// On mount:
// - subscribeLobby(roomId, { onPlayerJoined, onRoomUpdated })
// - Return cleanup in useEffect

// onPlayerJoined:
// - Check if player already in list (dedup) → append with animation flag

// onRoomUpdated (room status → 'drawn'):
// - router.push(`/room/${roomId}/draw`)  ← triggers Phase 3 redirect
```

**Lobby Visual Layout (full):**

```
╔═══════════════════════════════════╗
║  [Room header from layout.tsx]    ║
╠═══════════════════════════════════╣
║                                   ║
║  Room Code                        ║
║  ┌───────────────────────────┐    ║
║  │ WC-AB23      [📋 Copy]    │    ║
║  │              [Share 📲]   │    ║
║  └───────────────────────────┘    ║
║                                   ║
║  ───── Countries (6) ──────────── ║
║  🇦🇷 🇧🇷 🇫🇷 🇪🇸 🇩🇪 🇵🇹            ║
║                                   ║
║  ───── Players ─────────────────  ║
║  3 of 6 joined  ████░░░ (gold)   ║
║                                   ║
║  ┌──────────────────────────────┐ ║
║  │ 🏆 Alice                HOST│ ║
║  ├──────────────────────────────┤ ║
║  │ ⚽ Bob                       │ ║
║  ├──────────────────────────────┤ ║
║  │ 🦁 Carol                     │ ║
║  └──────────────────────────────┘ ║
║  ← new players animate in here   ║
║                                   ║
║  ───── ──── ──── ─────────────── ║
║                                   ║
║  [Start Draw]  ← HOST ONLY       ║
║  Disabled until 6/6 joined        ║
║                                   ║
║  "Waiting for the host to start…" ║
║  ← non-host players, pulsing     ║
║                                   ║
╚═══════════════════════════════════╝
```

### 10.3 `PlayerCard.tsx`

Animated player card for the lobby list:
- Avatar emoji (large, 2rem)
- Display name
- "HOST" gold badge on the host's card
- Entrance animation: `animate-slide-up` (from `globals.css`)
- Subtle gold left border on the current user's own card ("that's me")

```typescript
interface PlayerCardProps {
  player: Player;
  isHost: boolean;
  isCurrentUser: boolean;
}
```

### 10.4 `LobbyProgress.tsx`

Progress indicator for the join count:

```typescript
interface LobbyProgressProps {
  joined: number;
  total: number;
}
```

- Displays: "3 of 6 players joined"
- Gold progress bar fill: `width: (joined/total * 100)%`
- Changes to success green + "All players joined! Ready to draw." when `joined === total`
- Tabular numerals class

### 10.5 `StartDrawButton.tsx` (`"use client"`)

Host-only CTA. Visible only to the host. Uses `useActionState(startDraw, null)`.

```typescript
interface StartDrawButtonProps {
  roomId: string;
  isReady: boolean;  // true when players == countries
}
```

- `isReady = false` → button is disabled with hint "Waiting for all players to join"
- `isReady = true` → button enabled, gold primary style
- On click → calls `startDraw(roomId)` stub
- Shows spinner while pending
- Phase 3 will replace the stub with real draw logic

---

## 11. Validation Additions

Add `roomCode()` to `src/lib/validation.ts`:

```typescript
roomCode(value: string): string | null {
  // Normalise: trim, uppercase, strip spaces and dashes
  const cleaned = value.trim().toUpperCase().replace(/[\s]/g, '');
  // Accept with or without "WC-" prefix
  const suffix = cleaned.startsWith('WC-') ? cleaned.slice(3) : cleaned;
  if (suffix.length === 0) return "Room code is required";
  if (suffix.length !== 4) return "Room codes are 4 characters (format: WC-XXXX)";
  if (!/^[A-Z0-9]+$/.test(suffix)) return "Room code contains invalid characters";
  return null;
},
```

---

## 12. Security Checklist for Phase 2

| # | Control | Location | How |
|---|---------|----------|-----|
| 1 | `joinRoom` enforces lobby status | `joinRoom` action | Rejects joins when `room.status !== 'lobby'` |
| 2 | `joinRoom` enforces capacity | `joinRoom` action | `players.count >= countries.count` → error |
| 3 | Duplicate join prevented | `joinRoom` action | `user_id` already in players → graceful redirect |
| 4 | Player row tied to `auth.uid()` | `joinRoom` action | `user_id = user.id` — never a client-provided value |
| 5 | No direct client INSERT on players | RLS (Stage 1) | No INSERT policy; all writes go through Server Action |
| 6 | Rate limit on joins | `joinRoom` action | Max 10 joins in last 30 minutes per user |
| 7 | `startDraw` host-only | `startDraw` action | `room.host_user_id !== user.id` → error |
| 8 | Realtime events filtered by RLS | Supabase Realtime | `postgres_changes` respects row-level security per-user |
| 9 | `lookupRoomByCode` doesn't expose host_secret | `lookupRoomByCode` | Only selects non-secret columns (`code, id, status, host_name`) |
| 10 | `redirectTo` validated in all auth guards | Room join pages | Must start with `/`, not contain `://` |

---

## 13. Testing Plan

### 13.1 Unit Tests

All run with: `npm test`

---

**`tests/unit/lib/validation.test.ts`** — extend with `roomCode` cases

| Test | Assertion |
|------|-----------|
| Empty string → error | "Room code is required" |
| 3-char suffix → error | Length validation message |
| 5-char suffix → error | Length validation message |
| Valid "WC-AB23" → null | No error |
| Valid "AB23" (no prefix) → null | Tolerant of missing prefix |
| Lowercase "wc-ab23" → null | Case-insensitive |
| Spaces in code "WC AB23" → null | Tolerant of spaces |
| Special chars "WC-@#$%" → error | Character validation |

---

**`tests/unit/components/ui/JoinCodeInput.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders an input field | Input element present |
| Auto-uppercases typed characters | "ab23" → "AB23" in value |
| Strips non-alphanumeric input | "AB!@" → "AB" |
| Shows error message | Error text visible |
| Limits suffix to 4 characters | Further input ignored after 4 chars |
| Calls onChange with normalised code | onChange called with "WC-" prefix |

---

**`tests/unit/components/ui/CountryChip.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders flag emoji | Emoji present |
| `size="md"` renders country name | Name text visible |
| `size="sm"` does not render name | Name text absent |
| No interactive role | Not a button or link |

---

**`tests/unit/components/ui/RoomCodeDisplay.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders the room code text | "WC-AB23" visible |
| Copy button has accessible label | `aria-label="Copy room code"` |
| Copy button is a button element | `role="button"` present |
| Renders the code in a monospace/tabular font element | Code has tabular-nums class or similar |

---

**`tests/unit/components/room/lobby/PlayerCard.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders player avatar emoji | Emoji visible |
| Renders player name | Name text visible |
| Host card shows "HOST" badge | "HOST" text present |
| Non-host card has no "HOST" badge | "HOST" text absent |
| Current user's card has visual indicator | Distinct styling class present |

---

**`tests/unit/components/room/lobby/LobbyProgress.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders "X of Y players joined" | Correct numbers in text |
| Progress bar width reflects ratio | Style attribute matches `(joined/total * 100)%` |
| Shows "Ready to draw" when full | Completion message visible when `joined === total` |
| Uses different colour scheme when full | Success class when `joined === total` |

---

### 13.2 E2E Tests (Playwright)

**`tests/e2e/join.spec.ts`** — Join flow

| Scenario | Steps | Expected |
|----------|-------|----------|
| **Code entry page loads** | Navigate to `/room/join` (no auth) | Form visible; no redirect |
| **Invalid code format** | Enter "hello" and submit | Inline format error |
| **Non-existent code** | Enter "WC-ZZZZ" (not in DB) | "Room not found" error |
| **Already-started room** | Enter code for a room with status 'drawn' | "Game already started" error |
| **Unauthenticated join form** | Valid code → redirects to sign-in with redirectTo | URL contains `/auth/sign-in` + correct redirectTo |
| **Name validation** | Authenticated; valid code; empty name; submit | Inline "name required" error |
| **Successful join** | Authenticated; valid code; fill name/avatar; submit | Redirected to `/room/[id]/lobby` |
| **Duplicate join** | Attempt to join a room you're already in | Graceful redirect to lobby |
| **Full room** | All spots taken; try to join | "Room is full" error |
| **Mobile layout** | 375px viewport; navigate to `/room/join` | Form visible; no overflow |

---

**`tests/e2e/lobby.spec.ts`** — Lobby page

| Scenario | Steps | Expected |
|----------|-------|----------|
| **Unauthenticated access** | Navigate to lobby without session | Redirected to sign-in |
| **Lobby loads correctly** | Sign in + navigate to lobby | Code, countries, players all visible |
| **Room code copy button** | Click copy button | "Copied!" feedback visible |
| **Countries displayed** | View lobby | Flag chips match selected countries |
| **Player cards shown** | At least one player joined | Player cards rendered with avatar + name |
| **Host badge on host card** | Host views their own card | "HOST" label visible |
| **Start Draw button — host, not full** | Host in lobby with < all players | Button disabled |
| **Start Draw button — host, full** | All players joined | Button enabled |
| **Waiting message for non-host** | Non-host player views lobby | "Waiting for host" text visible |
| **Realtime: new player appears** | Second browser joins; first watches | New player card appears without refresh |
| **Leave/Sign-out from lobby** | Click "Leave" in header | User signed out; redirected to `/` |

> **Realtime test note:** The Realtime scenario (row 10) requires two browser contexts. In Playwright, this is done with `browser.newContext()` for the second player. This test requires valid Supabase credentials and Realtime publication applied.

### 13.3 Type Safety

```bash
npm run typecheck   # must report 0 errors after Phase 2
```

### 13.4 Build Verification

```bash
npm run build   # must exit 0
```

Expected routes after Phase 2:
```
Route (app)
┌ ○ /                         (Static)
├ ○ /_not-found               (Static)
├ ƒ /api/competitions         (Dynamic)
├ ƒ /api/cron/ingest          (Dynamic)
├ ƒ /auth/callback            (Dynamic)
├ ƒ /auth/sign-in             (Dynamic)
├ ƒ /auth/sign-up             (Dynamic)
├ ƒ /room/create              (Dynamic)
├ ƒ /room/join                (Dynamic)
├ ƒ /room/[id]/join           (Dynamic)
└ ƒ /room/[id]/lobby          (Dynamic)
```

---

## 14. Implementation Step Order

Steps are ordered to prevent forward-dependency problems — each step is testable before the next builds on it.

| Step | Task | Files Created / Modified |
|------|------|--------------------------|
| 1 | Realtime migration | `supabase/migrations/20240103000000_realtime.sql` |
| 2 | Add `roomCode()` to validation | `src/lib/validation.ts` |
| 3 | Realtime helper module | `src/lib/supabase/realtime.ts` |
| 4 | `JoinCodeInput.tsx` | `src/components/ui/JoinCodeInput.tsx` |
| 5 | `CountryChip.tsx` | `src/components/ui/CountryChip.tsx` |
| 6 | `RoomCodeDisplay.tsx` | `src/components/ui/RoomCodeDisplay.tsx` |
| 7 | `Toast.tsx` | `src/components/ui/Toast.tsx` |
| 8 | `Divider.tsx` | `src/components/ui/Divider.tsx` |
| 9 | `lookupRoomByCode` + `joinRoom` + `startDraw` Server Actions | `src/actions/room.ts` |
| 10 | Code entry page (`/room/join`) | `src/app/room/join/page.tsx` |
| 11 | Room shell layout | `src/app/room/[id]/layout.tsx` |
| 12 | `JoinRoomForm.tsx` | `src/app/room/[id]/join/_components/JoinRoomForm.tsx` |
| 13 | Room-specific join page | `src/app/room/[id]/join/page.tsx` |
| 14 | `PlayerCard.tsx` | `src/app/room/[id]/lobby/_components/PlayerCard.tsx` |
| 15 | `LobbyProgress.tsx` | `src/app/room/[id]/lobby/_components/LobbyProgress.tsx` |
| 16 | `StartDrawButton.tsx` | `src/app/room/[id]/lobby/_components/StartDrawButton.tsx` |
| 17 | `LobbyRealtime.tsx` (full lobby UI) | `src/app/room/[id]/lobby/_components/LobbyRealtime.tsx` |
| 18 | Lobby page Server Component | `src/app/room/[id]/lobby/page.tsx` |
| 19 | Unit tests (6 suites) | `tests/unit/` |
| 20 | E2E tests (2 suites) | `tests/e2e/join.spec.ts`, `tests/e2e/lobby.spec.ts` |
| 21 | Typecheck + build verification | `npm run typecheck && npm run build` |

---

## 15. Phase 2 Definition of Done

| Check | Criterion |
|-------|-----------|
| `npm run typecheck` | Zero TypeScript errors |
| `npm run build` | Exit 0; 11 routes listed (see §13.4) |
| `npm test` | All unit tests pass (104 existing + new Phase 2 tests) |
| Realtime migration applied | `players` and `rooms` in `supabase_realtime` publication |
| Code entry | `/room/join` accepts a room code and redirects to `/room/[id]/join` |
| Invalid code | Server Action returns descriptive error without exposing DB details |
| Already-started room | Join attempt returns "game has already started" error |
| Room-specific join | `/room/[id]/join` shows room preview + name/avatar form |
| Auth guard on join | Unauthenticated user redirected to sign-in with correct `redirectTo` |
| `joinRoom` inserts player | Valid submission creates player row with `user_id = auth.uid()` |
| Duplicate join | Second join attempt redirects gracefully to lobby |
| Room full | Join rejected with clear error |
| Lobby loads | Initial players + countries rendered on first paint (no loading state) |
| Room code copy | Clipboard button copies code; visual feedback shown |
| Realtime: players | New player appears in all connected clients without page refresh |
| Realtime: draw start | Host clicking "Start Draw" triggers redirect in all connected clients |
| Host visibility | "Start Draw" button shown only to host |
| Start Draw enabled | Button enabled only when `players.count === countries.count` |
| Non-host waiting | Non-hosts see pulsing "Waiting for host" state |
| Mobile UX | All new pages usable at 375px viewport |

---

## 16. What Phase 3 Builds Next

Phase 2 ends when all players are in the lobby and the host can click "Start Draw" (stub that updates status to `'drawn'`). Phase 3 picks up from the redirect to `/room/[id]/draw`:
- The **secure Fisher-Yates draw** (server-side, idempotent, `crypto.getRandomValues`)
- **Dramatic animated reveal** (carousel → slot machine → confetti) per player
- All players watch in sync via Realtime (assignments broadcast as each reveal completes)
- **Summary grid** after last reveal + "Go to Group Stage" button
