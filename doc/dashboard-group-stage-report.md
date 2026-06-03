# Dashboard To Group Stage Navigation Report

## Summary

Fixed the browser-back behavior after users create/join a room, complete the draw, and move to Group Stage.

Previously, the browser history could remain like this for the host:

```text
Dashboard → Create Room → Lobby → Draw → Group Stage
```

And like this for a joined player:

```text
Dashboard → Join Room → Room Join Page → Lobby → Draw → Group Stage
```

So when users pressed the browser Back button from Group Stage, the browser could return to `/room/create`, `/room/[id]/join`, or the old Draw page instead of returning to Dashboard.

The corrected behavior uses replace-style navigation for the committed room flow, so create/join/setup/phase pages are not kept as stale history entries.

Expected history after the fix:

```text
Dashboard → Group Stage
```

Pressing Back from Group Stage now returns the user to Dashboard instead of replaying the Draw page.

## Root Cause

The issue was caused by push-style navigation during both entry and phase changes.

Push navigation adds a new browser history entry:

```text
router.push("/room/id/group-stage")
```

That is useful for normal navigation, but the committed room lifecycle is different. Once a user has created or joined a room, and once a room has moved from Lobby to Draw or Draw to Group Stage, previous setup/phase pages should not behave like normal pages the user can return to.

For room phases, replace-style navigation is safer:

```text
router.replace("/room/id/group-stage")
```

Replace navigation changes the current history entry instead of adding another one.

## Changes Made

### Server Action Redirects

Updated `src/actions/room.ts` to use `RedirectType.replace` for phase-transition redirects:

- create-room success to Lobby
- room-code lookup to Room Join Page
- join-room success to Lobby
- already-joined fallback to Lobby
- player-choice start directly to Group Stage
- random draw start to Draw
- already-drawn fallback to Draw
- already-group-stage fallback to Group Stage
- drawn to Group Stage transition

This makes server-driven phase movement replace the current history entry.

### Server Page Guard Redirects

Updated stale-route guards in these pages to use `RedirectType.replace`:

```text
src/app/room/[id]/join/page.tsx
src/app/room/[id]/lobby/page.tsx
src/app/room/[id]/draw/page.tsx
src/app/room/[id]/group-stage/page.tsx
```

These guards are a safety net for browser history restores and direct visits to stale room phases.

### Lobby Realtime Redirect

Updated `src/app/room/[id]/lobby/_components/LobbyRealtime.tsx`.

When Supabase Realtime reports a phase change:

- `lobby → drawn`
- `lobby → group_stage`
- `lobby → knockout`
- `lobby → finished`

the client now uses:

```ts
router.replace(nextPath);
```

instead of:

```ts
router.push(nextPath);
```

### Draw Realtime Redirect

Updated `src/app/room/[id]/draw/_components/DrawOrchestrator.tsx`.

When Supabase Realtime reports:

```text
drawn → group_stage
```

the client now uses:

```ts
router.replace(`/room/${roomId}/group-stage`);
```

This prevents the completed Draw page from staying behind Group Stage in browser history.

## Tests Added

Added:

```text
tests/unit/navigation/room-flow-redirects.test.ts
```

Coverage:

- verifies create/join action redirects use `RedirectType.replace`
- verifies stale room phase page guards use `RedirectType.replace`

Added:

```text
tests/unit/components/room/draw/DrawOrchestrator.test.tsx
```

Coverage:

- simulates a Realtime `group_stage` room update
- verifies `router.replace("/room/room-1/group-stage")`
- verifies `router.push` is not used

Added:

```text
tests/unit/components/room/lobby/LobbyRealtime.test.tsx
```

Coverage:

- simulates a Realtime `drawn` room update
- verifies `router.replace("/room/room-1/draw")`
- verifies the draw transition is not pushed into browser history

## Validation Results

Passed:

```bash
npm run typecheck
```

Passed focused tests:

```bash
npm test -- --runInBand tests/unit/navigation/room-flow-redirects.test.ts tests/unit/components/room/draw/DrawOrchestrator.test.tsx tests/unit/components/room/lobby/LobbyRealtime.test.tsx
```

Passed full unit test suite:

```bash
npm test -- --runInBand
```

Result:

- 38 test suites passed
- 327 tests passed

Passed targeted lint for changed client components and new tests:

```bash
npx eslint 'src/app/room/[id]/join/page.tsx' 'src/app/room/[id]/lobby/page.tsx' 'src/app/room/[id]/draw/page.tsx' 'src/app/room/[id]/group-stage/page.tsx' 'src/app/room/[id]/lobby/_components/LobbyRealtime.tsx' 'src/app/room/[id]/draw/_components/DrawOrchestrator.tsx' tests/unit/components/room/draw/DrawOrchestrator.test.tsx tests/unit/components/room/lobby/LobbyRealtime.test.tsx tests/unit/navigation/room-flow-redirects.test.ts
```

Known lint note:

- Running ESLint directly on `src/actions/room.ts` still reports existing Supabase `any` casts and unused imports in that file.
- This was pre-existing repository lint debt and is unrelated to the navigation behavior.
- TypeScript compilation passed with the updated `RedirectType.replace` server action redirects.

## Manual Browser Check

Recommended manual check:

1. Sign in and go to Dashboard.
2. Create a random-assignment room as host.
3. Start the draw.
4. Continue to Group Stage.
5. Press the browser Back button.
6. Repeat as a joined player from the room-code/join flow.

Expected:

```text
Group Stage → Dashboard
```

Not expected:

```text
Group Stage → Draw
```

## Result

Create, join, lobby, and draw pages are no longer treated as normal historical destinations after the user commits to the room flow and reaches Group Stage. Room setup and phase transitions now behave like forward-only state transitions, while normal navigation such as Dashboard links still works normally.
