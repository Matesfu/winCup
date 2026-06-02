# WinCup — Phase 3 Implementation Plan: The Draw

> **Prerequisites:** Phase 2 complete — join flow, lobby with Realtime, `startDraw` stub updating `rooms.status = 'drawn'` and redirecting all clients to `/room/[id]/draw` (Phase 3 builds that page). 144/144 unit tests passing.
>
> **Builds on:** `src/actions/room.ts` (replace `startDraw` stub), `src/lib/supabase/realtime.ts` (extend with room-status subscription), `src/app/room/[id]/layout.tsx` (shared header), all existing UI primitives.

---

## 1. Scope & Deliverables

| # | Deliverable | Route / Location |
|---|-------------|-----------------|
| 1 | `src/lib/draw.ts` — `shuffleSecurely` + `assignCountries` | Library, no route |
| 2 | `startDraw` stub → real `executeDraw` (same export name) | `src/actions/room.ts` |
| 3 | `src/lib/supabase/realtime.ts` — add `subscribeRoomUpdates` | Library extension |
| 4 | `/room/[id]/draw` — Draw page (Server Component shell) | New route |
| 5 | `DrawOrchestrator.tsx` — "use client" state machine driver | `_components/` |
| 6 | `FlagCarousel.tsx` — horizontal slot-machine animation | `_components/` |
| 7 | `ConfettiBurst.tsx` — CSS particle explosion on landing | `_components/` |
| 8 | `RevealScreen.tsx` — full-screen per-player reveal wrapper | `_components/` |
| 9 | `DrawSummary.tsx` — post-reveal grid + "Go to Group Stage" | `_components/` |
| 10 | `SoundEngine.ts` — Web Audio API tick + thud (no files) | `src/lib/sound.ts` |
| 11 | `MuteToggle.tsx` — mute/unmute button | `_components/` |
| 12 | Unit tests (5 suites) | `tests/unit/` |
| 13 | E2E tests (1 suite, 8 scenarios) | `tests/e2e/draw.spec.ts` |

**Out of scope for Phase 3:**
- Group stage grid (Phase 4)
- football-data.org match ingestion (Phase 4)
- The Ladder / bracket tree (Phase 5)
- Winner screen (Phase 6)

---

## 2. Folder Structure — Phase 3 Additions

```
src/
├── actions/
│   └── room.ts                    ← REPLACE startDraw stub with real executeDraw
│
├── app/
│   └── room/
│       └── [id]/
│           └── draw/
│               ├── page.tsx        ← NEW: Server Component — auth + fetch + redirect guard
│               └── _components/
│                   ├── DrawOrchestrator.tsx  ← "use client" — top-level state machine
│                   ├── RevealScreen.tsx      ← per-player reveal wrapper
│                   ├── FlagCarousel.tsx      ← "use client" — slot-machine animation
│                   ├── ConfettiBurst.tsx     ← CSS particle burst on landing
│                   ├── MuteToggle.tsx        ← "use client" — mute/unmute button
│                   └── DrawSummary.tsx       ← post-all-reveals grid + CTA
│
└── lib/
    ├── draw.ts                    ← NEW: shuffleSecurely, assignCountries
    ├── sound.ts                   ← NEW: Web Audio tick + thud (programmatic, no files)
    └── supabase/
        └── realtime.ts            ← EXTEND: add subscribeRoomUpdates()

supabase/
└── migrations/
    (no new migrations needed — all schema + Realtime already set up)

tests/
├── unit/
│   ├── lib/
│   │   ├── draw.test.ts           ← NEW: shuffleSecurely + assignCountries
│   │   └── sound.test.ts          ← NEW: SoundEngine construction, no crash
│   └── components/
│       └── room/
│           └── draw/
│               ├── FlagCarousel.test.tsx   ← NEW
│               ├── DrawSummary.test.tsx    ← NEW
│               └── MuteToggle.test.tsx     ← NEW
└── e2e/
    └── draw.spec.ts               ← NEW: 8 end-to-end scenarios
```

---

## 3. The Draw Lifecycle (What Happens When)

```
Host in lobby clicks "Start Draw"
         │
         ▼
startDraw() Server Action (Phase 3 replaces stub)
  ├─ Validate: host ownership, status='lobby', players==countries
  ├─ Idempotency: any player has assigned_country? → already drawn → redirect
  ├─ shuffleSecurely(countries)
  ├─ Batch-update players.assigned_country
  ├─ UPDATE rooms.status = 'drawn'
  └─ redirect(/room/[id]/draw)
         │
         │  Realtime: rooms UPDATE event fires
         ▼
All lobby clients (from Phase 2 LobbyRealtime.tsx):
  router.push(`/room/${roomId}/draw`)
         │
         ▼
/room/[id]/draw  page.tsx (Server Component)
  ├─ Auth guard
  ├─ Fetch room, players (with assigned_country), countries
  └─ Render <DrawOrchestrator> with initial data
         │
         ▼
DrawOrchestrator (Client Component) auto-starts animation
  ├─ Subscribe to rooms UPDATE (for status changes to 'group_stage')
  ├─ Show RevealScreen for player[0] → [1] → ... → [N-1]
  └─ Show DrawSummary after last reveal
         │
         ▼
Host clicks "Go to Group Stage"
  → /room/[id]/group-stage (Phase 4)
```

---

## 4. Draw Logic Library (`src/lib/draw.ts`)

Two pure, server-safe functions. No Supabase dependency — easy to unit test.

### 4.1 `shuffleSecurely<T>(array: T[]): T[]`

Cryptographically secure Fisher-Yates in-place shuffle using `crypto.getRandomValues`. Unlike `Math.random()`, this produces unpredictable output that cannot be predicted or reproduced by clients.

```typescript
/**
 * Cryptographically secure Fisher-Yates shuffle.
 * Uses crypto.getRandomValues — NOT Math.random().
 * Modulo bias is negligible (< 0.001%) for arrays ≤ 36 elements.
 */
export function shuffleSecurely<T>(array: T[]): T[] {
  const arr = [...array]; // never mutate the input
  for (let i = arr.length - 1; i > 0; i--) {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const j = bytes[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

### 4.2 `assignCountries(players, countryCodes): DrawAssignment[]`

Pairs each player with exactly one country after shuffling. Throws on count mismatch (guards against a bug that would silently mis-assign).

```typescript
export interface DrawAssignment {
  playerId: string;
  playerName: string;
  countryCode: string;
}

export function assignCountries(
  players: { id: string; name: string }[],
  countryCodes: string[]
): DrawAssignment[] {
  if (players.length !== countryCodes.length) {
    throw new Error(
      `Player count (${players.length}) must equal country count (${countryCodes.length})`
    );
  }
  const shuffled = shuffleSecurely(countryCodes);
  return players.map((player, i) => ({
    playerId: player.id,
    playerName: player.name,
    countryCode: shuffled[i],
  }));
}
```

---

## 5. `startDraw` Replacement (Real `executeDraw` Logic)

**File:** `src/actions/room.ts` — replace the existing `startDraw` stub body.

The function signature and export name `startDraw` stay the same so `StartDrawButton.tsx` needs no changes.

```
Full updated startDraw() steps:

1. Require authenticated session
   └ No session → return { error: "Not authenticated." }

2. Fetch room by roomId (admin client)
   └ Not found → return { error: "Room not found." }
   └ host_user_id !== user.id → return { error: "Only the host can start the draw." }
   └ status !== 'lobby' → return { error: "Draw has already been started." }

3. Fetch players + room_countries counts (parallel Promise.all)
   └ playerCount !== countryCount → return { error: `All ${countryCount} players must join first (${playerCount}/${countryCount}).` }

4. IDEMPOTENCY CHECK: any player already has assigned_country set?
   └ YES → room already drawn (e.g. double-click) → redirect(`/room/${roomId}/draw`)
   └ NO → proceed

5. Fetch player IDs and room country codes (needed for assignment)

6. assignCountries(players, countryCodes)
   └ Returns DrawAssignment[] — each player maps to exactly one country

7. Batch-update players.assigned_country (admin client)
   └ Use Promise.all over individual updates for each DrawAssignment
   └ On any error → return { error: "Failed to save draw. Please try again." }

8. UPDATE rooms.status = 'drawn' (admin client)
   └ On error → return { error: "Failed to finalise draw." }

9. redirect(`/room/${roomId}/draw`)
   └ Realtime broadcasts the rooms UPDATE to all lobby clients
   └ LobbyRealtime.tsx (Phase 2) sees status='drawn' → router.push('/draw')
```

**Why no DB transaction:** Supabase free tier doesn't expose raw Postgres transactions via the JS client. Instead, the idempotency check (step 4) and the batch update are the safety net. If the update partially fails, a retry from the host will detect existing assignments and skip straight to step 9.

---

## 6. Realtime Extension (`src/lib/supabase/realtime.ts`)

Add `subscribeRoomUpdates` — a lightweight subscription used by the draw page to detect when the host advances to the next phase (status changes to `'group_stage'`).

```typescript
/**
 * Subscribes to UPDATE events on a specific room.
 * Used by the draw page to detect status transitions (e.g. → 'group_stage').
 * Returns an unsubscribe function.
 */
export function subscribeRoomUpdates(
  roomId: string,
  onUpdate: (room: Partial<RoomPublic>) => void
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`room-status:${roomId}`)
    .on(
      "postgres_changes" as any,
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload: { new: Record<string, unknown> }) =>
        onUpdate(payload.new as unknown as Partial<RoomPublic>)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
```

---

## 7. Sound Engine (`src/lib/sound.ts`)

Programmatic Web Audio API sounds — no audio files to download, no external libraries. The `AudioContext` is created lazily (browser requires a user gesture before audio can play).

```typescript
"use client"; // sound is browser-only

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

/**
 * Short, sharp click — played on each carousel step while spinning.
 * Frequency: 800Hz; Duration: ~50ms.
 */
export function playTick(): void {
  const ac = getContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = "square";
  osc.frequency.value = 800;
  gain.gain.setValueAtTime(0.08, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.05);
}

/**
 * Deep thump — played when the carousel lands on the assigned country.
 * Frequency: 180Hz; Duration: ~300ms.
 */
export function playThud(): void {
  const ac = getContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.2);
  gain.gain.setValueAtTime(0.5, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.3);
}

/**
 * Resume AudioContext if suspended (browsers suspend on page load until user gesture).
 * Call once on first user interaction.
 */
export function resumeAudio(): void {
  const ac = getContext();
  if (ac?.state === "suspended") ac.resume();
}
```

---

## 8. Animation Architecture

### 8.1 State Machine (managed by `DrawOrchestrator`)

```
State shape:
  phase:         'waiting' | 'revealing' | 'complete'
  revealIndex:   number          // 0..N-1, which player is being revealed
  carouselPhase: 'spinning' | 'slowing' | 'landing' | 'showing'
  isMuted:       boolean

Transitions:
  mount                    → phase:'waiting' (brief 1s pause for page to settle)
  1s elapsed               → phase:'revealing', revealIndex:0, carouselPhase:'spinning'
  carousel finishes        → carouselPhase:'landing', play thud, show ConfettiBurst
  landing (800ms)          → carouselPhase:'showing', show country name
  showing (2500ms)         → if more players: revealIndex++, carouselPhase:'spinning'
                              else: phase:'complete'
```

The full sequence per player takes approximately **5–6 seconds**:
- 0.0s  → carousel starts spinning (fast phase, 80ms/step)
- 0.0–2.0s → fast spinning (~25 steps at 80ms)
- 2.0–3.5s → slowing phase (interval grows by ×1.18 each step, ~10 steps)
- 3.5s  → landing (thud + confetti burst)
- 3.5–4.3s → confetti visible
- 4.3–6.0s → country name shown in large gold text
- 6.0s  → next player starts

### 8.2 `FlagCarousel.tsx` — The Slot Machine

A horizontal strip of flag emojis that scrolls and decelerates.

**Visual design:**
```
[ 🇧🇷 ] [ 🇦🇷 ] ┌─────────┐ [ 🇩🇪 ] [ 🇪🇸 ]
                │  🇫🇷  │       ← target lands here
                └─────────┘
            (golden selection frame, fixed in center)
```

**Implementation approach:**
- Build a "flag sequence": a pre-determined array of `N` flag emojis where the target country appears at position `N-1` (the last step)
- Sequence construction: 25 random flags drawn from all available, ending with the target
- The carousel slides left one flag width per tick using `transform: translateX(−index × flagWidth)`
- CSS `transition-duration` increases on each tick (fast → slow → stops)
- The fixed golden frame shows whatever flag is at the center position

```typescript
// Flag sequence: shuffled flags, target at the end
function buildFlagSequence(
  allFlags: { code: string; flag_emoji: string }[],
  targetCode: string
): { code: string; flag_emoji: string }[] {
  const others = shuffleSecurely(allFlags.filter(f => f.code !== targetCode));
  return [...others.slice(0, 24), allFlags.find(f => f.code === targetCode)!];
}
```

**Tick intervals (speed schedule):**
```
Steps 0–24  (fast phase):  interval = 70ms
Steps 25–30 (slowing):     interval × 1.25 each step (70 → 87 → 109 → ... → ~300ms)
Step  31   (final):        interval = 600ms (slow crawl to the target)
```

**Props:**
```typescript
interface FlagCarouselProps {
  sequence: { code: string; flag_emoji: string }[];  // pre-built sequence
  onComplete: () => void;                             // called when last flag lands
  isMuted: boolean;
  flagWidth?: number;   // px, default 80
}
```

**Rendering:**
```tsx
// The track slides; the golden frame is fixed at the center
<div className="relative h-24 overflow-hidden rounded-2xl bg-surface">
  {/* Fixed selection frame */}
  <div className="absolute inset-y-0 left-1/2 z-10 -translate-x-1/2 w-20
                  rounded-xl border-2 border-gold bg-gold/10 shadow-[0_0_20px_rgba(255,215,0,0.3)]" />
  {/* Scrolling flag track */}
  <div
    className="absolute top-0 flex items-center"
    style={{
      transform: `translateX(${offset}px)`,
      transition: `transform ${transitionDuration}ms ease-out`,
    }}
  >
    {sequence.map((flag, i) => (
      <div key={i} className="flex w-20 items-center justify-center text-4xl">
        {flag.flag_emoji}
      </div>
    ))}
  </div>
</div>
```

Where `offset = (containerWidth / 2) - (currentIndex × 80) - 40` — keeps the current flag centred.

### 8.3 `ConfettiBurst.tsx` — Particle Effect

CSS-only explosion of 16 particles radiating outward from the center. No library required.

```typescript
const PARTICLES = [
  { color: '#FFD700', angle: 0, dist: 60 },
  { color: '#10B981', angle: 22.5, dist: 80 },
  { color: '#FFFFFF', angle: 45, dist: 70 },
  // ... 16 total, evenly spaced at 22.5° intervals, varied distances and colors
];
```

Each particle:
- Starts at `(50%, 50%)`
- Animates to `(50% + cos(angle)*dist, 50% + sin(angle)*dist)`
- Fades from `opacity:1` to `opacity:0` over 800ms
- Uses `transform: translate() scale()` with CSS transition

Implementation:
```tsx
<div className="pointer-events-none absolute inset-0 overflow-hidden">
  {visible && PARTICLES.map((p, i) => {
    const dx = Math.cos((p.angle * Math.PI) / 180) * p.dist;
    const dy = Math.sin((p.angle * Math.PI) / 180) * p.dist;
    return (
      <div
        key={i}
        className="absolute h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: p.color,
          left: `calc(50% - 5px)`,
          top: `calc(50% - 5px)`,
          transform: active ? `translate(${dx}px, ${dy}px) scale(0)` : 'translate(0,0) scale(1)',
          opacity: active ? 0 : 1,
          transition: `transform 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                       opacity 800ms ease-out`,
          transitionDelay: `${i * 20}ms`,
        }}
      />
    );
  })}
</div>
```

Note: to trigger the animation, mount with `active=false` and set to `active=true` on next render cycle using `useEffect` with `requestAnimationFrame`.

### 8.4 `RevealScreen.tsx` — Per-Player Reveal Wrapper

Full-screen layout for one player's reveal. Receives the player, their assigned country, and all available flags.

**Layout (mobile-first):**
```
┌─────────────────────────────────────────────┐
│                 [🔇 Mute]                   │
│                                             │
│          Drawing for...                     │
│         ┌──────────────────┐               │
│         │  🏆  Alice       │               │
│         └──────────────────┘               │
│                                             │
│  ──────── Slot machine carousel ──────────  │
│  [🇧🇷] [🇦🇷] ┌───────┐ [🇩🇪] [🇪🇸]        │
│              │  🇫🇷  │                      │
│              └───────┘                      │
│                                             │
│  ────────── LANDING PHASE ─────────────     │
│                                             │
│                🇫🇷                         │
│                                             │
│              FRANCE                         │
│         (gold, bold, large)                 │
│                                             │
│        ✨  confetti burst  ✨               │
│                                             │
└─────────────────────────────────────────────┘
```

**Phase transitions within RevealScreen:**
1. `'spinning'` — player name shown, carousel spinning
2. `'landing'` — carousel stopped, thud played, confetti burst active
3. `'showing'` — flag at full size, country name in gold, confetti fading

### 8.5 `DrawSummary.tsx` — Results Grid

Shown after all players have been revealed.

```
┌─────────────────────────────────────────────┐
│           The Draw is Complete! 🏆          │
│                                             │
│  ┌───────┐ ┌───────┐ ┌───────┐             │
│  │  🏆   │ │  ⚽   │ │  🦁   │             │
│  │ Alice │ │  Bob  │ │ Carol │             │
│  │  🇫🇷 │ │  🇧🇷 │ │  🇩🇪 │             │
│  │France │ │Brazil │ │Germany│             │
│  └───────┘ └───────┘ └───────┘             │
│                                             │
│     [  Go to Group Stage →  ]               │
│                                             │
│  WinCup is for entertainment only.          │
│  Stakes settled offline between friends.   │
└─────────────────────────────────────────────┘
```

Each card shows: player avatar, player name, flag emoji, country name.

"Go to Group Stage" button links to `/room/[id]/group-stage` (Phase 4 page; shows 404 for now).

### 8.6 `MuteToggle.tsx`

Small button in the top-right of the draw screen. Toggles `isMuted` state in `DrawOrchestrator`.

```typescript
interface MuteToggleProps {
  muted: boolean;
  onToggle: () => void;
}
```

- Shows 🔊 (unmuted) or 🔇 (muted)
- `aria-label`: "Mute sound" / "Unmute sound"
- Accessible: `role="button"`, clear label

---

## 9. Draw Page (`/room/[id]/draw`)

### 9.1 Server Component (`page.tsx`)

```typescript
export default async function DrawPage({ params }) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/draw`);

  // Parallel fetches
  const [roomResult, playersResult, countriesResult] = await Promise.all([
    // Room: need status + win_rule
    (supabase as any).from("rooms").select("id,code,status,win_rule,stake_amount,host_user_id")
      .eq("id", roomId).maybeSingle(),
    // Players: need assigned_country (set by executeDraw)
    (supabase as any).from("players").select("id,name,avatar_emoji,assigned_country,user_id")
      .eq("room_id", roomId).order("joined_at"),
    // Countries: need flag_emoji + name for animation
    (supabase as any).from("countries").select("code,name,flag_emoji"),
  ]);

  const room = roomResult.data;
  if (!room) notFound();

  // Guard: only render draw page when room status is 'drawn'
  if (room.status === "lobby") redirect(`/room/${roomId}/lobby`);
  if (room.status === "group_stage") redirect(`/room/${roomId}/group-stage`);
  // knockout, finished handled in later phases

  const players = playersResult.data ?? [];
  const countries = countriesResult.data ?? [];

  // Verify all players have been assigned a country (guard against race condition)
  const allAssigned = players.every(p => p.assigned_country !== null);

  return (
    <DrawOrchestrator
      roomId={roomId}
      players={players}
      countries={countries}
      allAssigned={allAssigned}
    />
  );
}
```

**Why check `allAssigned`:** The `executeDraw` action batch-updates all player assignments before setting `rooms.status = 'drawn'`. However, in a race condition (network delay), a client could arrive at the draw page before all assignments are written. The `allAssigned` flag lets the orchestrator show a brief "Preparing draw…" loading state instead of animating with null countries.

### 9.2 `DrawOrchestrator.tsx` — Top-Level State Machine

```typescript
"use client"

interface DrawOrchestratorProps {
  roomId: string;
  players: DrawPlayer[];  // includes assigned_country
  countries: { code: string; name: string; flag_emoji: string }[];
  allAssigned: boolean;
}

// State:
//   phase: 'waiting' | 'revealing' | 'complete'
//   revealIndex: number
//   isMuted: boolean

// Mount:
//   if (!allAssigned) → show "Preparing draw…" and poll every 2s
//   else → setTimeout 1000ms → start revealing
//
// subscribeRoomUpdates(roomId, { onUpdate })
//   if status → 'group_stage' → router.push(/group-stage)
```

The orchestrator renders:
- `phase === 'waiting'`: countdown or "draw is starting…" message
- `phase === 'revealing'`: `<RevealScreen>` for `players[revealIndex]`
- `phase === 'complete'`: `<DrawSummary>`

`<MuteToggle>` is always visible during `'revealing'` phase (positioned top-right).

---

## 10. Security Notes for Phase 3

| # | Control | Location | How |
|---|---------|----------|-----|
| 1 | Draw is host-only | `startDraw` action | `room.host_user_id !== user.id` → error |
| 2 | Draw is idempotent | `startDraw` action | Check `assigned_country` before running shuffle; skip if already set |
| 3 | Player count === country count enforced | `startDraw` action | Error if any mismatch |
| 4 | Shuffle runs server-side only | `src/lib/draw.ts` | `shuffleSecurely` only called from `"use server"` action |
| 5 | `crypto.getRandomValues` used | `src/lib/draw.ts` | Not `Math.random()` — no predictable output |
| 6 | Draw page requires auth | `page.tsx` | Server-side redirect if no session |
| 7 | Draw page validates room status | `page.tsx` | Redirect if status ≠ 'drawn' |
| 8 | Assignments never revealed pre-animation | Client | The data is fetched upfront but the UI reveals them sequentially — no "view source" concern since the animation is purely presentational |

---

## 11. Testing Plan

### 11.1 Unit Tests

---

**`tests/unit/lib/draw.test.ts`** — Core draw logic

| Test | Assertion |
|------|-----------|
| `shuffleSecurely` returns same length array | `result.length === input.length` |
| `shuffleSecurely` contains all original elements | Every input element present exactly once |
| `shuffleSecurely` with 1 element returns same | `[x]` → `[x]` |
| `shuffleSecurely` produces different orders | 1000 shuffles of [1..10] → not all identical (statistical) |
| `assignCountries` returns correct count | Length equals input length |
| `assignCountries` each player gets unique country | No duplicate `countryCode` in output |
| `assignCountries` all player IDs present | Every player ID appears in output |
| `assignCountries` throws on count mismatch | 3 players + 4 countries → throws |

---

**`tests/unit/lib/sound.test.ts`** — Sound engine (browser-only, mocked AudioContext)

| Test | Assertion |
|------|-----------|
| `playTick` does not throw when AudioContext unavailable | No error |
| `playThud` does not throw when AudioContext unavailable | No error |
| `resumeAudio` does not throw when AudioContext unavailable | No error |

---

**`tests/unit/components/room/draw/FlagCarousel.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders without crashing | Component mounts |
| Shows first flag in sequence initially | First flag emoji visible |
| Renders the selection frame | Gold-bordered frame element present |
| Calls `onComplete` after animation finishes | `onComplete` mock invoked eventually |

> Note: The full animation timing is not tested in unit tests — integration testing via E2E is more appropriate for timing-sensitive animation. Unit tests verify mounting and callback wiring.

---

**`tests/unit/components/room/draw/DrawSummary.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders "Draw is Complete" heading | Heading text present |
| Renders one card per player | Card count = players length |
| Shows player avatar emoji | Each player's emoji visible |
| Shows player name | Each player's name visible |
| Shows country flag and name | Each assigned country visible |
| "Go to Group Stage" button present | Button/link with text visible |
| "Go to Group Stage" links to correct route | `href` contains `/group-stage` |

---

**`tests/unit/components/room/draw/MuteToggle.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders mute icon when not muted | 🔊 or "Mute" aria-label present |
| Renders unmute icon when muted | 🔇 or "Unmute" aria-label present |
| Calls onToggle when clicked | Mock called once |
| Has accessible aria-label | `aria-label` present and descriptive |

---

### 11.2 E2E Tests (Playwright)

**`tests/e2e/draw.spec.ts`**

Prerequisites:
- `.env.local` with valid Supabase credentials
- A test host account + a test player account
- Email confirmation DISABLED
- Realtime migration applied

| Scenario | Steps | Expected |
|----------|-------|----------|
| **Draw page requires auth** | Navigate to `/room/[id]/draw` (no session) | Redirects to sign-in |
| **Draw page redirects if room in lobby** | Navigate to draw while room is `'lobby'` | Redirects to `/lobby` |
| **Carousel animation starts** | Create room, all players join, host starts draw | Draw page loads; carousel animation visible |
| **Mute toggle works** | Click mute on draw page | Icon changes; clicking again restores |
| **All players revealed** | Wait for all reveals to complete | DrawSummary screen shown |
| **Summary shows correct assignments** | After all reveals | Every player paired with a country flag+name |
| **"Go to Group Stage" button present** | After all reveals | Button visible (links to group-stage, may 404) |
| **Realtime: non-host client sees animation** | Two browsers; host starts draw; second browser on lobby | Second browser redirects to draw; sees same reveals |

---

### 11.3 Type Safety

```bash
npm run typecheck   # 0 errors required
```

### 11.4 Build Verification

```bash
npm run build   # must exit 0
```

Expected routes after Phase 3:
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
├ ƒ /room/[id]/draw         ← NEW
├ ƒ /room/[id]/join
├ ƒ /room/[id]/lobby
└ ƒ /room/create
```

---

## 12. Implementation Step Order

| Step | Task | Files |
|------|------|-------|
| 1 | Draw library (`shuffleSecurely` + `assignCountries`) | `src/lib/draw.ts` |
| 2 | Sound engine | `src/lib/sound.ts` |
| 3 | Extend realtime helper with `subscribeRoomUpdates` | `src/lib/supabase/realtime.ts` |
| 4 | Replace `startDraw` stub with real executeDraw logic | `src/actions/room.ts` |
| 5 | `ConfettiBurst.tsx` (no dependencies on draw state) | `draw/_components/` |
| 6 | `MuteToggle.tsx` | `draw/_components/` |
| 7 | `FlagCarousel.tsx` + `buildFlagSequence` helper | `draw/_components/` |
| 8 | `RevealScreen.tsx` (uses FlagCarousel + ConfettiBurst) | `draw/_components/` |
| 9 | `DrawSummary.tsx` | `draw/_components/` |
| 10 | `DrawOrchestrator.tsx` (wires all components + state machine) | `draw/_components/` |
| 11 | Draw page (`/room/[id]/draw/page.tsx`) | `draw/page.tsx` |
| 12 | Unit tests (5 suites) | `tests/unit/lib/draw.test.ts`, `sound.test.ts`, component tests |
| 13 | E2E tests | `tests/e2e/draw.spec.ts` |
| 14 | Typecheck + build verification | `npm run typecheck && npm run build` |

---

## 13. Phase 3 Definition of Done

| Check | Criterion |
|-------|-----------|
| `npm run typecheck` | Zero TypeScript errors |
| `npm run build` | Exit 0; 12 routes |
| `npm test` | All unit tests pass (144 existing + Phase 3 tests) |
| `startDraw` is no longer a stub | Actual Fisher-Yates shuffle + player updates run |
| Idempotency enforced | Second draw attempt → redirect to draw page, no re-shuffle |
| Host-only gate | Non-host user returns error from `startDraw` |
| All assignments persisted | After draw, every player row has `assigned_country` set |
| Draw page requires auth | Unauthenticated visit → redirects to sign-in |
| Draw page guards status | Visit when room not 'drawn' → redirects to correct phase |
| Carousel animates | Flag strip scrolls, decelerates, lands on target |
| Sound plays (unmuted) | Tick on each step, thud on landing |
| Mute toggle works | No sounds when muted; state toggles on click |
| Confetti fires | Particles visible on landing |
| Country name appears | Large gold text shown after landing |
| All players revealed | Reveals advance automatically 0→N-1 |
| Summary shown after last reveal | DrawSummary grid with all assignments |
| "Go to Group Stage" button present | Visible in summary (link target may 404 until Phase 4) |
| Realtime: non-host clients redirect | LobbyRealtime picks up `status='drawn'` → all navigate to draw |
| Mobile UX | Animation and summary usable at 375px viewport |

---

## 14. What Phase 4 Builds Next

Phase 3 ends with `rooms.status = 'drawn'` and every player knowing their assigned country. The "Go to Group Stage" button links to `/room/[id]/group-stage`. Phase 4 picks up:
- **Group Stage grid** — every player card with flag, name, alive/eliminated status
- **Host override panel** — "Qualified" / "Knocked out" actions per country
- **Vercel Cron route** — real implementation: `CRON_SECRET` validation + football-data.org fetch + idempotent `matches` upsert + `room_countries.qualified` updates + player elimination + Realtime broadcast
- **"Build Knockout Bracket"** action — available when all countries are decided
