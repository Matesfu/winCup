# Realtime Definition for WinCup

## Short answer

Yes. WinCup can have realtime room updates with only:

- Next.js hosted on Vercel
- Supabase Auth
- Supabase Postgres
- Supabase Realtime

You do not need a separate backend hosted on a VPS just to make players see live updates.

The important detail is this: Vercel will host your Next.js pages, Server Actions, API routes, and cron route, but Vercel does not need to host a WebSocket server. The browser connects directly to Supabase Realtime over WebSocket. Supabase owns the long-lived realtime connection.

For this project, the main realtime pattern should be:

```text
Host clicks a button
  -> Next.js Server Action runs on Vercel
  -> Server Action verifies the host
  -> Server Action writes durable game state into Supabase Postgres
  -> Supabase Realtime detects the row change
  -> Every subscribed browser receives the event
  -> Client Component updates React state without refresh
```

That means Next.js is still your application backend, but it is a serverless backend on Vercel, not a long-running VPS.

## Why this works on Vercel

Vercel Functions are request/response functions. They are great for:

- Server Actions
- API routes
- auth callbacks
- secure Supabase admin writes
- cron jobs
- fetching external football data

They are not meant to act as your own WebSocket server. Vercel's official limits page says Vercel Functions do not support acting as a WebSocket server.

That is not a blocker here because Supabase Realtime is the WebSocket server. Your Next.js app does not keep a long-running socket open on Vercel. Your user's browser keeps the socket open to Supabase.

## The pieces

### 1. Durable state

Durable state is the real game state saved in Postgres. If the user refreshes the page, this state is still there.

For WinCup, durable state includes:

- `rooms.status`
- `players.assigned_country`
- `players.is_eliminated`
- `room_countries.qualified`
- `room_teams.current_stage`
- `room_teams.is_eliminated`
- `matches.winner_code`

Realtime should usually be a notification that durable state changed. It should not be the only place where important game state lives.

Example:

```text
Good:
  The host starts the draw.
  Server Action writes assigned countries into players.
  Everyone receives players UPDATE events.

Risky:
  The host broadcasts "Brazil goes to Alice" without saving it.
  A player refreshes and the assignment disappears.
```

### 2. Authoritative writes

An authoritative write is a write that your app trusts.

For WinCup, host-only actions should be authoritative:

- Start the draw
- Mark a group-stage country as qualified or knocked out
- Build the knockout bracket
- Advance a match manually

The browser should not directly update those rows just because a user clicked something. The browser should call a Next.js Server Action, and the Server Action should verify:

- the user is authenticated
- the user is the room host
- the room is in the correct phase
- the write is idempotent

This project already follows that shape in `src/actions/room.ts`.

### 3. Realtime subscription

A realtime subscription is a Client Component listening for changes.

This project already has a shared helper at:

```text
src/lib/supabase/realtime.ts
```

That helper creates room-scoped subscriptions such as:

- `subscribeLobby(roomId, callbacks)`
- `subscribeRoomUpdates(roomId, callback)`
- `subscribeGroupStage(roomId, callbacks)`
- `subscribeLadder(roomId, callbacks)`

The Client Component receives the event and updates local React state.

Example shape:

```tsx
"use client";

import { useEffect, useState } from "react";
import { subscribeGroupStage } from "@/lib/supabase/realtime";
import type { RoomCountry } from "@/lib/types/database";

export function GroupStageRealtimeExample({
  roomId,
  initialRoomCountries,
}: {
  roomId: string;
  initialRoomCountries: Pick<RoomCountry, "id" | "country_code" | "qualified">[];
}) {
  const [roomCountries, setRoomCountries] = useState(initialRoomCountries);

  useEffect(() => {
    const unsubscribe = subscribeGroupStage(roomId, {
      onCountryUpdated(updated) {
        setRoomCountries((previous) =>
          previous.map((country) =>
            country.country_code === updated.country_code
              ? { ...country, ...updated }
              : country
          )
        );
      },
      onPlayerUpdated() {},
      onRoomUpdated() {},
    });

    return unsubscribe;
  }, [roomId]);

  return null;
}
```

The key rule: subscribe inside `"use client"` components, not Server Components. Server Components render a snapshot. Client Components can keep a WebSocket subscription alive.

## Supabase Realtime options

Supabase Realtime has three useful modes.

### Postgres Changes

Postgres Changes lets clients listen to database row changes.

This is the best default for WinCup because the game state already lives in Postgres.

Use it for:

- player joined lobby
- player kicked from lobby
- room status changed from `lobby` to `drawn`
- player received `assigned_country`
- group-stage qualification changed
- knockout team advanced
- match winner changed
- room finished

Example:

```ts
const channel = supabase
  .channel(`group-stage:${roomId}`)
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "room_countries",
      filter: `room_id=eq.${roomId}`,
    },
    (payload) => {
      console.log("Country changed:", payload.new);
    }
  )
  .subscribe();
```

Why the `filter` matters:

```text
Without a filter:
  A user could receive events for every room they are allowed to read.

With room_id filter:
  The client only receives events for the room they are viewing.
```

### Broadcast

Broadcast sends low-latency messages between clients through Supabase channels.

Use it for temporary events that do not need to be saved forever:

- "play sound now"
- "show countdown"
- "host is hovering this bracket slot"
- "start animation at timestamp X"
- typing indicators

Do not use Broadcast as the only source of truth for country assignment, qualification, or match winners. Save those in Postgres first.

Example optional draw animation broadcast:

```ts
const channel = supabase.channel(`draw-animation:${roomId}`, {
  config: {
    broadcast: { self: true, ack: true },
  },
});

channel.on("broadcast", { event: "draw-started" }, ({ payload }) => {
  console.log("Start animation at:", payload.startedAt);
});

channel.subscribe((status) => {
  if (status !== "SUBSCRIBED") return;

  channel.send({
    type: "broadcast",
    event: "draw-started",
    payload: {
      startedAt: Date.now() + 1500,
      revealMs: 4500,
    },
  });
});
```

For WinCup, you may not need Broadcast at all for the first version. Postgres Changes is enough for the actual room state.

### Presence

Presence tracks who is currently connected to a channel.

Use it for:

- online players in the room
- "host is connected"
- "Alice is viewing the ladder"

Presence is useful, but it is not required for the draw, group stage, or knockout updates.

## How this maps to WinCup

### Lobby

Goal:

```text
When a player joins, everyone in the lobby sees the new player instantly.
When the host starts the draw, everyone moves to the draw page.
```

Write path:

```text
joinRoom Server Action inserts players row
  -> players INSERT event fires
  -> LobbyRealtime adds the player card
```

```text
startDraw Server Action updates rooms.status = 'drawn'
  -> rooms UPDATE event fires
  -> LobbyRealtime redirects every client to /room/[id]/draw
```

This is already implemented with:

```text
src/lib/supabase/realtime.ts
src/app/room/[id]/lobby/_components/LobbyRealtime.tsx
src/actions/room.ts
```

If players only appear after refreshing, the lobby probably missed the `players` INSERT event or the browser could not read that event through RLS. The lobby now uses two layers:

```text
Fast path:
  Supabase Realtime receives players INSERT/DELETE
  -> LobbyRealtime patches local player state immediately

Recovery path:
  LobbyRealtime calls /api/rooms/[id]/lobby-state every 2 seconds
  -> API route verifies the user is host or room member
  -> API route returns the latest players using the server admin client
  -> LobbyRealtime replaces the local player list without a browser refresh
```

This keeps the UI live even if one realtime event is missed.

### Random country draw

Goal:

```text
The room creator starts the draw.
Every player sees the assigned countries without refreshing.
```

The durable state should be:

```text
players.assigned_country
rooms.status = 'drawn'
```

Current project flow:

```text
Host clicks Start Draw
  -> startDraw verifies host
  -> startDraw shuffles countries
  -> startDraw updates players.assigned_country
  -> startDraw updates rooms.status = 'drawn'
  -> lobby clients receive rooms UPDATE
  -> lobby clients redirect to draw page
  -> draw page loads assigned countries from Postgres
```

That is a valid realtime flow because non-host players do not refresh manually. They are pushed from lobby to draw by the `rooms` realtime event.

If a player stays on "Waiting for the host to start the draw..." until they manually refresh, the browser probably missed the `rooms` UPDATE event. Common reasons:

- the `rooms` table was not added to the `supabase_realtime` publication in the live Supabase project
- the browser's channel was not fully subscribed yet when the host clicked Start Draw
- RLS allows the page's initial server read, but the client session cannot receive realtime rows
- the browser lost the WebSocket connection and did not receive that one event

Realtime events are not a replacement for checking the current state. A good lobby should both subscribe to `rooms` updates and occasionally re-check `rooms.status`. This project now does that in `LobbyRealtime`: Realtime is the fast path, and a small status check is the recovery path.

If you also want the draw page itself to update while already open, add a subscription to `players` UPDATE events filtered by `room_id`.

Example helper:

```ts
export function subscribeDrawAssignments(
  roomId: string,
  onPlayerAssigned: (player: { id: string; assigned_country: string | null }) => void,
  onRoomUpdated: (room: { status?: string }) => void
) {
  const supabase = createClient();

  const channel = supabase
    .channel(`draw:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "players",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        onPlayerAssigned(payload.new as { id: string; assigned_country: string | null });
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        onRoomUpdated(payload.new as { status?: string });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
```

Client example:

```tsx
useEffect(() => {
  const unsubscribe = subscribeDrawAssignments(
    roomId,
    (updatedPlayer) => {
      setPlayers((previous) =>
        previous.map((player) =>
          player.id === updatedPlayer.id
            ? { ...player, assigned_country: updatedPlayer.assigned_country }
            : player
        )
      );
    },
    (updatedRoom) => {
      if (updatedRoom.status === "group_stage") {
        router.push(`/room/${roomId}/group-stage`);
      }
    }
  );

  return unsubscribe;
}, [roomId, router]);
```

For a synchronized reveal animation, do not write a database row for every animation frame. Save a start timestamp and let each browser animate locally.

Recommended durable fields for a very synchronized draw:

```sql
alter table rooms
  add column if not exists draw_started_at timestamptz;

alter table players
  add column if not exists draw_order integer;
```

Then the host writes:

```text
players.assigned_country
players.draw_order
rooms.status = 'drawn'
rooms.draw_started_at = now()
```

Every browser can compute the same reveal:

```ts
const revealMs = 4500;
const startTime = new Date(room.draw_started_at).getTime();
const elapsed = Date.now() - startTime;
const currentRevealIndex = Math.floor(elapsed / revealMs);
```

This is better than broadcasting every tick because:

- late joiners can load the current state from Postgres
- refresh still works
- clients can recover after reconnect
- the database is not spammed with animation updates

### Group stage

Goal:

```text
When the room creator edits a group-stage result, every player sees the cards move instantly.
```

Write path:

```text
Host clicks Qualified or Knocked out
  -> markQualification Server Action verifies host
  -> updates room_countries.qualified
  -> updates players.is_eliminated when needed
  -> Supabase emits UPDATE events
  -> GroupStageRealtime updates local state
```

This is already implemented with:

```text
src/app/room/[id]/group-stage/_components/GroupStageRealtime.tsx
src/lib/supabase/realtime.ts
src/actions/room.ts
```

The key subscription listens to:

```text
room_countries UPDATE where room_id = current room
players UPDATE where room_id = current room
rooms UPDATE where id = current room
```

So if the host marks England as knocked out:

```text
room_countries.qualified = false
players.is_eliminated = true
```

Every connected client receives those updates and React rerenders:

```text
Undecided section -> Knocked Out in Groups section
```

### Knockout / round of 16 / ladder

Goal:

```text
When the room creator edits the knockout bracket or advances a match, everyone sees the bracket update.
```

Write path for manual match advance:

```text
Host chooses winner
  -> advanceMatch Server Action verifies host
  -> updates winner room_teams.current_stage
  -> updates loser room_teams.is_eliminated
  -> upserts matches.winner_code
  -> may update rooms.status = 'finished'
  -> LadderRealtime receives events
  -> bracket rerenders without refresh
```

This is already implemented with:

```text
src/app/room/[id]/ladder/_components/LadderRealtime.tsx
src/lib/supabase/realtime.ts
src/actions/room.ts
```

The subscription listens to:

```text
room_teams UPDATE where room_id = current room
matches INSERT/UPDATE/DELETE where room_id = current room
rooms UPDATE where id = current room
```

## Required Supabase setup

For Postgres Changes to work, the table must be added to the `supabase_realtime` publication.

This project already has migrations for that:

```text
supabase/migrations/20240103000000_realtime.sql
supabase/migrations/20240104000000_realtime_phase4.sql
supabase/migrations/20240105000000_realtime_phase5.sql
```

Example SQL:

```sql
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_countries;
alter publication supabase_realtime add table room_teams;
alter publication supabase_realtime add table matches;
```

If you need full previous row data for UPDATE or DELETE events, set replica identity:

```sql
alter table players replica identity full;
```

Use this carefully because it can increase replication volume. For many WinCup events, the new row is enough.

## Security and RLS

Realtime does not mean public data.

For Postgres Changes, Supabase sends records only to clients that are allowed to read those records by Row Level Security policies. This means your read policies still matter.

For WinCup:

- room members should read rows for their room
- non-members should not read private room rows
- host-only writes should happen through Server Actions
- service role or secret keys should only exist on the server
- never expose service role keys in `NEXT_PUBLIC_` variables

Correct browser env vars:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Correct server-only env vars:

```text
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
FOOTBALL_DATA_API_KEY
```

The browser Supabase client in this project uses the public key:

```text
src/lib/supabase/client.ts
```

The server/admin client should stay in server-only code:

```text
src/lib/supabase/server.ts
src/actions/room.ts
src/app/api/cron/ingest/route.ts
```

## The recommended Next.js structure

Use this pattern for every realtime page:

```text
1. Server Component fetches the initial state from Supabase.
2. Server Component passes initial state into a Client Component.
3. Client Component stores that state in useState.
4. Client Component subscribes in useEffect.
5. Realtime events patch the local state.
6. useEffect cleanup removes the channel.
```

Why initial fetch still matters:

```text
Realtime is not a replacement for loading the current state.
Realtime tells you what changes after you subscribe.
The initial query tells you what already happened before you arrived.
```

That is exactly why the existing pages load state first, then subscribe.

## Idempotency

Realtime can deliver events during reconnects, and users can double-click buttons. Your writes should be safe to repeat.

Examples already used in this project:

- `startDraw` does not reshuffle if players already have `assigned_country`
- `markQualification` can be called again with the same result
- `buildKnockout` skips ahead if `room_teams` already exist
- `advanceMatch` checks whether a winner already advanced

This is important. Realtime makes the UI fast, but idempotency makes the game reliable.

## When to use a database transaction or RPC

Supabase JavaScript calls are separate database requests. If you need several writes to succeed or fail together, use a Postgres function and call it with `rpc()`.

For example, a stricter draw could be one transaction:

```sql
create or replace function start_room_draw(
  p_room_id uuid,
  p_draw_started_at timestamptz
)
returns void
language plpgsql
security definer
as $$
begin
  -- Validate host and room status here, or keep validation in the Server Action.
  -- Update players.assigned_country and players.draw_order here.
  -- Update rooms.status and rooms.draw_started_at here.

  update rooms
  set status = 'drawn',
      draw_started_at = p_draw_started_at
  where id = p_room_id;
end;
$$;
```

Then the Server Action calls:

```ts
await supabase.rpc("start_room_draw", {
  p_room_id: roomId,
  p_draw_started_at: new Date().toISOString(),
});
```

For the current app size, the existing Server Action approach is reasonable. For higher confidence in all-or-nothing game phase transitions, an RPC is stronger.

## Common mistakes to avoid

- Do not try to run your own WebSocket server in a Vercel Function.
- Do not put Supabase service role keys in browser code.
- Do not use realtime events as the only source of truth for important game state.
- Do not subscribe to an entire table when a `room_id` filter is enough.
- Do not forget SELECT policies. A client can subscribe but still receive no rows if RLS does not allow reads.
- Do not forget to remove channels in `useEffect` cleanup.
- Do not expect realtime to replay every missed event after a refresh. Fetch initial state first.
- Do not write animation frames to Postgres. Save timestamps and animate locally.
- Do not assume the host's browser is trustworthy. Verify host permissions on the server.

## Final recommendation for WinCup

Use Supabase Postgres Changes for all durable room state:

```text
Lobby:
  players INSERT/DELETE
  rooms UPDATE

Draw:
  rooms UPDATE
  optionally players UPDATE for already-open draw pages

Group stage:
  room_countries UPDATE
  players UPDATE
  rooms UPDATE

Knockout:
  room_teams UPDATE
  matches INSERT/UPDATE
  rooms UPDATE
```

Use Broadcast only if you want extra live effects that are not durable:

```text
countdown
sound cue
animation start signal
hover indicators
```

Use Presence only if you want online-player awareness:

```text
who is currently viewing the room
whether the host is connected
```

With this approach, Vercel plus Supabase is enough. No VPS is required.

## Official references

- Supabase Realtime overview: https://supabase.com/docs/guides/realtime
- Supabase Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase Broadcast: https://supabase.com/docs/guides/realtime/broadcast
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase Realtime with Next.js: https://supabase.com/docs/guides/realtime/realtime-with-nextjs
- Vercel limits, WebSockets section: https://vercel.com/docs/limits
