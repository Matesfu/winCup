# WinCup — Phase 6 Implementation Plan: Winner Screen + Auto-Resolution

> **Prerequisites:** Phase 5 complete — knockout bracket rendering, `advanceMatch` action sets teams to `'champion'`, cron processes knockout matches, `LadderRealtime` already redirects on `rooms.status = 'finished'`. 269/269 unit tests passing.
>
> **Builds on:** `src/lib/ingest.ts`, `src/actions/room.ts` (`advanceMatch`), `src/app/api/cron/ingest/route.ts`, `src/app/room/[id]/ladder/_components/LadderRealtime.tsx`, existing `rooms.winner_player_id` column and `status = 'finished'` value — **no new migrations needed**.

---

## 1. Scope & Deliverables

| # | Deliverable | Route / Location |
|---|-------------|-----------------|
| 1 | `src/lib/resolution.ts` — `resolveWinner` pure function | Library |
| 2 | `src/lib/resolution.ts` — `resolveRoomIfComplete` DB helper | Library |
| 3 | Extend `advanceMatch` action — trigger resolution after setting champion | `src/actions/room.ts` |
| 4 | Extend cron route — trigger resolution after detecting champion | `src/app/api/cron/ingest/route.ts` |
| 5 | Update `globals.css` — add `confetti-fall` keyframe | `src/app/globals.css` |
| 6 | `FullScreenConfetti.tsx` — CSS falling particle animation | `_components/` |
| 7 | `WinnerScreen.tsx` — "use client" winner display with confetti | `_components/` |
| 8 | `NoWinnerScreen.tsx` — strict mode fallback display | `_components/` |
| 9 | `/room/[id]/winner` — Server Component shell | New route |
| 10 | Unit tests (3 suites) | `tests/unit/` |
| 11 | E2E tests (1 suite, 8 scenarios) | `tests/e2e/winner.spec.ts` |

**No new database migrations** — `rooms.winner_player_id` and `rooms.status = 'finished'` already exist from Stage 1. The Realtime redirect from ladder → winner is already wired in Phase 5's `LadderRealtime.tsx`.

**Out of scope for Phase 6:**
- OAuth providers (Google/GitHub)
- Tournament history / past rooms dashboard
- Player statistics

---

## 2. Folder Structure — Phase 6 Additions

```
src/
├── actions/
│   └── room.ts                    ← EXTEND advanceMatch: resolve after champion set
│
├── app/
│   ├── api/
│   │   └── cron/
│   │       └── ingest/
│   │           └── route.ts      ← EXTEND: resolve room after knockout ingest
│   └── room/
│       └── [id]/
│           └── winner/
│               ├── page.tsx       ← NEW: Server Component shell
│               └── _components/
│                   ├── WinnerScreen.tsx      ← "use client": confetti + winner display
│                   ├── NoWinnerScreen.tsx    ← strict-mode no-winner display
│                   └── FullScreenConfetti.tsx ← CSS falling particle rain
│
├── globals.css                    ← ADD confetti-fall keyframe
│
└── lib/
    └── resolution.ts              ← NEW: resolveWinner + resolveRoomIfComplete

tests/
├── unit/
│   ├── lib/
│   │   └── resolution.test.ts     ← NEW
│   └── components/
│       └── room/
│           └── winner/
│               ├── WinnerScreen.test.tsx  ← NEW
│               └── NoWinnerScreen.test.tsx ← NEW
└── e2e/
    └── winner.spec.ts             ← NEW
```

---

## 3. Resolution Library (`src/lib/resolution.ts`)

### 3.1 `resolveWinner` — Pure Function

The reference algorithm from the build prompt, typed in TypeScript. No Supabase, no side effects — fully testable.

```typescript
export interface WinnerResult {
  winnerPlayerId: string | null;   // null = no winner (strict mode with filler champion)
  message: string;                 // human-readable outcome message
}

/**
 * Determines the winner of a completed WinCup tournament.
 * Returns null if the tournament is still ongoing.
 *
 * strict:        champion team must be player-owned; otherwise stakes returned.
 * last_standing: the last player-owned team still alive wins.
 */
export function resolveWinner(
  winRule: "strict" | "last_standing",
  roomTeams: Array<{
    player_id: string | null;
    current_stage: string;
    is_eliminated: boolean;
  }>
): WinnerResult | null {
  const alivePlayerTeams = roomTeams.filter(
    (t) => !t.is_eliminated && t.player_id !== null
  );

  if (winRule === "strict") {
    const champ = roomTeams.find((t) => t.current_stage === "champion");
    if (!champ) return null; // no champion yet — still in progress

    return champ.player_id
      ? {
          winnerPlayerId: champ.player_id,
          message: "Champion's owner wins the pot! 🏆",
        }
      : {
          winnerPlayerId: null,
          message: "The Cup winner wasn't in this room — stakes returned 🤷",
        };
  }

  // last_standing
  if (alivePlayerTeams.length === 1) {
    return {
      winnerPlayerId: alivePlayerTeams[0].player_id!,
      message: "Last team standing wins! 🏆",
    };
  }

  return null; // still ongoing (multiple alive, or none)
}
```

**Why the function doesn't need the full Room object:** It only needs `win_rule` and `roomTeams`. This makes it easier to call from tests and from multiple call sites.

**Why `resolveWinner` returns `null` instead of throwing:** A `null` return means "not yet resolved" — the cron runs repeatedly and each time checks if resolution is now possible. This is safer than treating an unresolved state as an error.

---

### 3.2 `resolveRoomIfComplete` — DB Helper

Coordinates the DB writes after resolution is determined. Called from both the cron route and the `advanceMatch` action.

```typescript
/**
 * Calls resolveWinner and, if a result is found, persists it to the rooms table.
 * Idempotent: if rooms.status is already 'finished', returns immediately.
 *
 * @param roomId - the room to resolve
 * @param admin  - Supabase admin client
 * @returns the WinnerResult if resolution happened, null if still ongoing or already finished
 */
export async function resolveRoomIfComplete(
  roomId: string,
  admin: AdminClient
): Promise<WinnerResult | null>
```

**Steps:**
1. Fetch `rooms.win_rule` and `rooms.status` for the room
2. If `status === 'finished'` → return `null` (already resolved, idempotent)
3. Fetch all `room_teams` for the room
4. Call `resolveWinner(win_rule, roomTeams)`
5. If result is `null` → return `null` (still ongoing)
6. `UPDATE rooms SET winner_player_id = result.winnerPlayerId, status = 'finished'`
   - This Realtime event fires → all ladder clients redirect to `/winner`
7. Return the result

---

## 4. `advanceMatch` Extension (Trigger Resolution After Champion)

In `src/actions/room.ts`, after the `advanceMatch` action sets a team's `current_stage` to `'champion'`, immediately call `resolveRoomIfComplete`:

```
Current advanceMatch flow:
  ...
  → UPDATE room_teams: winner's current_stage = nextStage (or 'champion')
  → Eliminate loser
  → Upsert match record
  → return null

Phase 6 addition: when nextStage === 'champion':
  → Call resolveRoomIfComplete(roomId, admin)
  → If resolved → redirect(`/room/${roomId}/winner`) immediately
  → If not resolved (edge case) → return null (stay on ladder)
```

**Why redirect to `/winner` directly when the host triggers the Final result:** The host already knows the game is over. Other clients will redirect via the Realtime `rooms.status = 'finished'` event (already handled by `LadderRealtime.onRoomStatusUpdated`).

---

## 5. Cron Route Extension (Trigger Resolution After Ingest)

In `src/app/api/cron/ingest/route.ts`, after `ingestKnockoutMatches` runs for a knockout room, check if a champion was set and resolve:

```typescript
// After ingestKnockoutMatches:
if (result.teamsAdvanced > 0) {
  // A team may have just become champion — check resolution
  const resolution = await resolveRoomIfComplete(room.id, admin);
  if (resolution) {
    console.log(`[cron/ingest] room ${room.id} resolved: ${resolution.message}`);
  }
}
```

The `resolveRoomIfComplete` idempotency check (status === 'finished' → early return) ensures this is safe even when called multiple times.

---

## 6. Winner Page

### 6.1 Server Component (`/room/[id]/winner/page.tsx`)

```typescript
export default async function WinnerPage({ params }) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/winner`);

  // Parallel fetches
  const [room, winnerPlayer, champion] = await Promise.all([
    // Room: win_rule, stake_amount, winner_player_id, status, code
    fetchRoom(supabase, roomId),
    // Winner player (if any): name, avatar_emoji, assigned_country
    fetchWinnerPlayer(supabase, roomId, room.winner_player_id),
    // Champion team (for strict mode "no winner" — show which country won)
    fetchChampion(supabase, roomId),
  ]);

  if (!room) notFound();

  // Route guard: only show winner page for finished rooms
  if (room.status === 'knockout') redirect(`/room/${roomId}/ladder`);
  if (room.status === 'group_stage') redirect(`/room/${roomId}/group-stage`);
  if (room.status === 'lobby') redirect(`/room/${roomId}/lobby`);
  if (room.status === 'drawn') redirect(`/room/${roomId}/draw`);

  const hasWinner = room.winner_player_id !== null && winnerPlayer !== null;
  const isStrictNoWinner = !hasWinner && room.win_rule === 'strict';

  if (hasWinner) {
    return <WinnerScreen ... />;
  }
  return <NoWinnerScreen ... />;
}
```

**Fetches:**
- **Room**: `id, code, status, win_rule, stake_amount, winner_player_id`
- **Winner player** (conditional — only if `winner_player_id` is set): `id, name, avatar_emoji, assigned_country` + joined countries for flag/name
- **Champion team**: `room_teams WHERE current_stage = 'champion'` → join with countries for flag/name (used in strict no-winner screen to show who actually won)

### 6.2 `WinnerScreen.tsx` ("use client")

Full-screen winner celebration.

**Props:**
```typescript
interface WinnerScreenProps {
  playerName: string;
  playerAvatar: string;
  countryName: string;
  countryFlag: string;
  stakeAmount: number | null;
  winMessage: string;    // from resolution.message
  roomCode: string;
}
```

**Layout:**

```
╔══════════════════════════════════════════════════╗
║  ✨ 🎊 🎉 (falling confetti, full viewport)      ║
║                                                  ║
║              🏆                                  ║
║        WinCup Winner!                            ║
║                                                  ║
║            {avatar}                              ║
║         {PlayerName}                             ║
║                                                  ║
║              {🇦🇷}                               ║
║           {Argentina}                            ║
║   "Champion's owner wins the pot! 🏆"            ║
║                                                  ║
║   ───── Stake ─────────────────────────────────  ║
║   {amount} Birr                                  ║
║                                                  ║
║   [📲 Share to WhatsApp]                         ║
║                                                  ║
║   [Start New Room]                               ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

**WhatsApp share text:**
```
🏆 I won WinCup! {flag} {country} took the cup{stake_text}!
```
Where `stake_text = ` and took the {amount} Birr pot`` if stake is set, or empty string.

For `last_standing` without a champion (edge case): `"🏆 I won WinCup — last team standing! {flag} {country}!"`

### 6.3 `NoWinnerScreen.tsx`

Strict mode — the champion is a filler team (not owned by any player).

**Props:**
```typescript
interface NoWinnerScreenProps {
  championCountryName: string;     // the actual champion
  championCountryFlag: string;
  stakeAmount: number | null;
  roomCode: string;
}
```

**Layout:**

```
╔══════════════════════════════════════════════════╗
║           🤷                                     ║
║                                                  ║
║      No Winner This Time                         ║
║                                                  ║
║   The Cup winner was {🇦🇷 Argentina}             ║
║   — but they weren't in this room.               ║
║                                                  ║
║   "The Cup winner wasn't in this room            ║
║    — stakes returned 🤷"                         ║
║                                                  ║
║   Congratulations to {Argentina}                 ║
║   from everyone who played!                      ║
║                                                  ║
║   [📲 Share Result]                              ║
║                                                  ║
║   [Start New Room]                               ║
║                                                  ║
║  WinCup is for entertainment only.               ║
╚══════════════════════════════════════════════════╝
```

**WhatsApp share text (no winner):**
```
⚽ {flag} {country} won the tournament! We played WinCup but nobody owned them. Better luck next time! 🤷
```

### 6.4 `FullScreenConfetti.tsx` ("use client")

CSS-animated particles raining down from the top of the screen. Starts immediately on mount. Pure CSS transitions — no external library.

```typescript
interface FullScreenConfettiProps {
  active?: boolean;  // default true
}
```

**Implementation:**
- 40 particles, each a small `div` with:
  - Random `left` position: 0–100%
  - Random size: 5–12px
  - Random shape: square or circle (`border-radius: 50%` alternating)
  - Colors: gold (#FFD700), green (#10B981), white (#FFFFFF), blue (#60A5FA), red (#EF4444)
  - CSS animation: `confetti-fall` with duration 2.5–5s and delay 0–3s
  - `animation-fill-mode: both` — starts with opacity 0, falls, fades out
- Container: `position: fixed, inset: 0, pointer-events: none, z-index: 10, overflow: hidden`

**`globals.css` addition:**
```css
@keyframes confetti-fall {
  0%   { transform: translateY(-20px) rotate(0deg) scale(1);   opacity: 1; }
  80%  { opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg) scale(0.5); opacity: 0; }
}

.animate-confetti-fall {
  animation: confetti-fall linear both;
}
```

Each particle uses inline `style={{ animationDuration: '...',  animationDelay: '...' }}` to vary timing per particle.

---

## 7. Visual Design Details

### 7.1 Winner Screen Typography

| Element | Style |
|---------|-------|
| "WinCup Winner!" | `text-4xl font-extrabold text-gold sm:text-5xl` |
| Player name | `text-3xl font-bold text-white sm:text-4xl` |
| Country flag | `text-7xl sm:text-8xl` (emoji, centered) |
| Country name | `text-2xl font-semibold text-white` |
| Win message | `text-sm italic text-muted` |
| Stake amount | `text-xl font-bold text-gold` |

### 7.2 WhatsApp Button Styling

```tsx
<a
  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3 font-bold text-white hover:brightness-110"
>
  📲 Share to WhatsApp
</a>
```

### 7.3 Start New Room Button

```tsx
<Button href="/room/create" variant="outline" size="lg">
  Start New Room →
</Button>
```

---

## 8. Security Notes

| # | Control | Location | How |
|---|---------|----------|-----|
| 1 | Winner page requires auth | `page.tsx` | Server-side redirect |
| 2 | Resolution is idempotent | `resolveRoomIfComplete` | Status check before writing |
| 3 | `winner_player_id` set server-side only | Cron + `advanceMatch` | Never accepted from client |
| 4 | Winner page only shows 'finished' rooms | `page.tsx` | Wrong status → redirect |
| 5 | WhatsApp link uses `rel="noopener noreferrer"` | `WinnerScreen` | Standard external link security |

---

## 9. Testing Plan

### 9.1 Unit Tests

---

**`tests/unit/lib/resolution.test.ts`** — Core resolution logic

| Test | Assertion |
|------|-----------|
| strict + champion is player-owned → winner | Returns `{ winnerPlayerId: "pid", message: "..." }` |
| strict + champion is filler → no winner | Returns `{ winnerPlayerId: null, message: "..." }` |
| strict + no champion yet → null | Returns `null` (still ongoing) |
| strict + message contains "🏆" for winner | Message includes trophy emoji |
| strict + message contains "stakes returned" for no winner | Message mentions stakes |
| last_standing + 1 alive player team → winner | Returns that player's ID |
| last_standing + 0 alive player teams → null | Returns `null` |
| last_standing + 2 alive player teams → null | Returns `null` (still playing) |
| last_standing + winner message mentions "standing" | Message contains "standing" |

---

**`tests/unit/components/room/winner/WinnerScreen.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders "WinCup Winner!" heading | Text present |
| Renders player name | Player name visible |
| Renders country flag emoji | Flag emoji present |
| Renders country name | Country name visible |
| Renders WhatsApp share button | Button/link visible |
| WhatsApp button has correct href pattern | href contains `wa.me` |
| WhatsApp text includes player name | Encoded text in href |
| Renders "Start New Room" link | Link with `/room/create` href |
| Stake amount shown when non-null | X Birr visible |
| Stake section hidden when null | Birr not present |

---

**`tests/unit/components/room/winner/NoWinnerScreen.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders "No Winner" heading | "No Winner" text visible |
| Shows actual champion country name | Champion country visible |
| Shows "stakes returned" message | "stakes returned" text visible |
| Shows champion country flag emoji | Flag emoji visible |
| Renders "Start New Room" link | Link present |
| Renders WhatsApp share button | Share button visible |

---

### 9.2 E2E Tests (Playwright)

**`tests/e2e/winner.spec.ts`** — 8 scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| **Unauthenticated redirect** | Visit `/room/[id]/winner` without session | Redirects to sign-in |
| **Wrong status redirect** | Visit winner URL when room is still in knockout | Redirects to `/ladder` |
| **Winner page loads** | Room in `'finished'` status with winner; visit page | Player name, flag, country visible |
| **WhatsApp button present** | View winner page | `📲 Share to WhatsApp` button visible |
| **WhatsApp href correct** | Check share button href | Contains `wa.me` and encoded message |
| **Start New Room link** | View winner page | Link pointing to `/room/create` visible |
| **No-winner screen** | `strict` mode, filler champion | "No Winner" text + champion country shown |
| **Mobile layout** | 375px viewport; winner page | All elements visible; no overflow |

---

### 9.3 Type Safety

```bash
npm run typecheck   # 0 errors required
```

### 9.4 Build Verification

```bash
npm run build   # exit 0
```

Expected routes after Phase 6:
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
├ ƒ /room/[id]/ladder
├ ƒ /room/[id]/lobby
├ ƒ /room/[id]/winner    ← NEW
└ ƒ /room/create
```

---

## 10. Implementation Step Order

| Step | Task | Files |
|------|------|-------|
| 1 | `resolution.ts` — `resolveWinner` + `resolveRoomIfComplete` | `src/lib/resolution.ts` |
| 2 | Extend `advanceMatch` — call resolution when setting champion | `src/actions/room.ts` |
| 3 | Extend cron route — call resolution after knockout ingest | `src/app/api/cron/ingest/route.ts` |
| 4 | Add `confetti-fall` keyframe to globals.css | `src/app/globals.css` |
| 5 | `FullScreenConfetti.tsx` | `winner/_components/` |
| 6 | `WinnerScreen.tsx` (uses FullScreenConfetti) | `winner/_components/` |
| 7 | `NoWinnerScreen.tsx` | `winner/_components/` |
| 8 | Winner page server component | `winner/page.tsx` |
| 9 | Unit tests (3 suites) | `tests/unit/` |
| 10 | E2E tests | `tests/e2e/winner.spec.ts` |
| 11 | Typecheck + build + full test run | verification |

---

## 11. Phase 6 Definition of Done

| Check | Criterion |
|-------|-----------|
| `npm run typecheck` | Zero TypeScript errors |
| `npm run build` | Exit 0; 15 routes |
| `npm test` | All unit tests pass (269 existing + Phase 6 tests) |
| `resolveWinner` implements both rules correctly | Unit tests cover all cases |
| `resolveRoomIfComplete` idempotent | Calling twice → no double-write |
| Resolution triggered when Final champion set | Via `advanceMatch` (host) + cron |
| `rooms.winner_player_id` persisted server-side | Never set from client |
| `rooms.status = 'finished'` triggers Realtime | All ladder clients redirect to `/winner` |
| Winner page requires auth | Unauthenticated → sign-in |
| Winner page guards room status | Wrong status → correct page |
| Winner page shows player name + country | Name, flag, country name all visible |
| Confetti animation plays | Particles visible on winner screen |
| WhatsApp share button present | Correct `wa.me` link with pre-filled text |
| Text includes player name + country | Verified in unit test |
| Stake amount shown (when non-null) | Conditional rendering |
| Strict mode no-winner screen | "No winner" + champion country shown |
| "Start New Room" button links to `/room/create` | Link href correct |
| Mobile UX at 375px | All content visible |

---

## 12. The Complete WinCup Game Lifecycle (After Phase 6)

```
Landing page
  │
  ├─ Create Room (/room/create)
  │     ↓ createRoom() → /room/[id]/lobby
  │
  ├─ Join Room (/room/join → /room/[id]/join)
  │     ↓ joinRoom() → /room/[id]/lobby
  │
  └─ Lobby (/room/[id]/lobby)
        ↓ Start Draw → /room/[id]/draw
        │
        └─ Draw (/room/[id]/draw)
              ↓ startGroupStage() → /room/[id]/group-stage
              │
              └─ Group Stage (/room/[id]/group-stage)
                    ↓ buildKnockout() → /room/[id]/ladder
                    │
                    └─ Ladder (/room/[id]/ladder)
                          ↓ resolveRoomIfComplete() sets status='finished'
                          │  Realtime: all clients redirect
                          │
                          └─ Winner (/room/[id]/winner) ← Phase 6
                                ↓ "Start New Room" → /room/create
```

Phase 6 completes the full WinCup game loop. Every phase is now implemented end-to-end.
