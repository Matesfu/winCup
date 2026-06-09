# Room Message System Implementation Plan

## 1. Goal

Add a mobile-first group chat to every room so room members can talk from the lobby until the room is finished.

The chat should feel close to Telegram on mobile:

- A small chat icon is visible on room pages.
- Tapping the icon opens a bottom chat drawer.
- Users can read previous messages, send new messages, and see new messages live.
- The chat remains available on lobby, draw, group stage, knockout, bracket setup, and winner pages.
- The implementation must avoid polling and stay friendly to Vercel Hobby and Supabase Free usage.

## 2. Non-Goals For Version 1

Do not implement these in the first version:

- Typing indicators.
- Read receipts.
- Message reactions.
- File uploads, images, audio, or voice messages.
- Direct/private messages.
- Admin moderation dashboard.
- Push notifications.
- Full-text search inside chat history.

These features create extra Realtime messages, extra storage, and extra UI complexity. They can be added later after the basic room chat is stable.

## 3. Current Architecture Fit

The chat should attach to the existing room architecture instead of creating a separate backend.

Relevant current code paths:

- Room wrapper: `src/app/room/[id]/layout.tsx`
- Realtime helpers: `src/lib/supabase/realtime.ts`
- Supabase clients: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
- Room mutations: `src/actions/room.ts`
- Room phases:
  - `src/app/room/[id]/lobby/page.tsx`
  - `src/app/room/[id]/draw/page.tsx`
  - `src/app/room/[id]/group-stage/page.tsx`
  - `src/app/room/[id]/ladder/page.tsx`
  - `src/app/room/[id]/bracket-setup/page.tsx`
  - `src/app/room/[id]/winner/page.tsx`

Best integration point:

- Render the chat launcher from `src/app/room/[id]/layout.tsx`.
- This makes chat available across all room phases with one shared UI.
- The chat should not fetch message history until the drawer is opened.

## 4. Data Model

Create a new `room_messages` table.

Suggested migration:

```sql
CREATE TABLE IF NOT EXISTS room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  sender_name text NOT NULL CHECK (char_length(trim(sender_name)) BETWEEN 1 AND 40),
  sender_avatar_emoji text,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_room_messages_room_created_at
  ON room_messages (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_messages_sender_user
  ON room_messages (sender_user_id);
```

Why this shape:

- `room_id` keeps every message scoped to one room.
- `sender_name` and `sender_avatar_emoji` are snapshots, so old messages still display correctly if a user later changes their profile or avatar.
- `sender_player_id` connects messages to the player row when the user is a room player.
- `sender_user_id` allows ownership checks and future reporting/moderation.
- `deleted_at` allows soft-delete later without changing the schema.
- `body` is limited to 500 characters to prevent storage abuse and huge Realtime payloads.

## 5. Access Rules And Security

Only these users should read and send room messages:

- The room host.
- Players who joined the room.

Important edge case:

- A host may create a room while choosing not to play. That host may not have a `players` row, but should still be able to chat because they own the room.

Recommended membership helper:

```ts
async function assertRoomChatMember(admin, roomId: string, userId: string) {
  const [roomResult, playerResult] = await Promise.all([
    admin
      .from("rooms")
      .select("id,host_user_id")
      .eq("id", roomId)
      .maybeSingle(),
    admin
      .from("players")
      .select("id,name,avatar_emoji")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const room = roomResult.data;
  if (!room) return { ok: false, reason: "room_not_found" };

  const isHost = room.host_user_id === userId;
  const player = playerResult.data;

  if (!isHost && !player) return { ok: false, reason: "not_member" };

  return { ok: true, room, player, isHost };
}
```

RLS plan:

- Enable RLS on `room_messages`.
- Allow `SELECT` only when `auth.uid()` is host or a player in the same room.
- Do not allow direct browser `INSERT`.
- All message sending should go through a Route Handler or Server Action that validates membership and rate limits.

Suggested policy:

```sql
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_messages_read_members" ON room_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM rooms r
    WHERE r.id = room_messages.room_id
      AND r.host_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM players p
    WHERE p.room_id = room_messages.room_id
      AND p.user_id = auth.uid()
  )
);
```

Realtime publication:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;
  END IF;
END $$;
```

## 6. API Design

Use Route Handlers instead of directly inserting from the browser.

Create:

- `src/app/api/rooms/[id]/messages/route.ts`

### GET `/api/rooms/[id]/messages`

Purpose:

- Fetch previous messages when the chat drawer opens.
- Load older messages when the user scrolls upward.

Query parameters:

- `limit`: default `50`, max `50`.
- `before`: optional ISO timestamp or message id cursor.

Behavior:

- Authenticate with `createSessionClient()`.
- Verify room membership with admin client.
- Return newest 50 messages, sorted oldest-first in the response for easy display.
- Exclude soft-deleted bodies later if delete support is added.

Expected Supabase operations:

- 1 auth call.
- 1 room membership check, parallel room/player lookup.
- 1 messages query.

### POST `/api/rooms/[id]/messages`

Purpose:

- Send one message.

Body:

```json
{
  "body": "Good luck everyone"
}
```

Behavior:

- Authenticate with `createSessionClient()`.
- Verify membership with admin client.
- Trim message body.
- Reject empty messages.
- Reject messages longer than 500 characters.
- Rate limit per user per room.
- Insert message using admin client.
- Return inserted message.

Rate limit:

- Allow 10 messages per 30 seconds per user per room.
- Use a count query on `room_messages`:

```ts
.eq("room_id", roomId)
.eq("sender_user_id", user.id)
.gte("created_at", thirtySecondsAgo)
```

This is enough for version 1 and avoids needing Redis or a separate backend.

## 7. Realtime Design

Add a focused Realtime helper:

- `subscribeRoomMessages(roomId, callbacks)` in `src/lib/supabase/realtime.ts`

Listen to:

- `INSERT` on `room_messages` filtered by `room_id`.
- `UPDATE` on `room_messages` filtered by `room_id`.
- `DELETE` on `room_messages` filtered by `room_id`.

Do not listen to:

- typing events
- read receipt events

Reason:

- Message inserts are the normal high-frequency event.
- Message updates and deletes should be rare, so including them keeps every client accurate without creating meaningful extra load.
- Avoiding typing/read-receipt events prevents message volume from exploding.

Suggested helper:

```ts
export function subscribeRoomMessages(
  roomId: string,
  callbacks: {
    onInserted: (message: RoomMessage) => void;
    onUpdated: (message: Partial<RoomMessage>) => void;
    onDeleted: (messageId: string) => void;
  }
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`room-chat:${roomId}`)
    .on(
      "postgres_changes" as any,
      {
        event: "*",
        schema: "public",
        table: "room_messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          callbacks.onInserted(payload.new as RoomMessage);
          return;
        }

        if (payload.eventType === "UPDATE") {
          callbacks.onUpdated(payload.new as Partial<RoomMessage>);
          return;
        }

        if (payload.eventType === "DELETE") {
          callbacks.onDeleted((payload.old as { id: string }).id);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
```

Free-tier note:

- Supabase Realtime uses one WebSocket connection per browser client, with channels inside it.
- Adding chat should add one filtered channel, not polling.
- Using `event: "*"` is acceptable here because updates/deletes are rare compared with inserts.
- The app must not poll for messages.

## 8. Frontend Component Plan

Create these components:

- `src/app/room/[id]/_components/RoomChatLauncher.tsx`
- `src/app/room/[id]/_components/RoomChatDrawer.tsx`
- `src/app/room/[id]/_components/RoomChatMessageList.tsx`
- `src/app/room/[id]/_components/RoomChatBubble.tsx`
- `src/app/room/[id]/_components/RoomChatComposer.tsx`

### RoomChatLauncher

Responsibilities:

- Fixed chat icon button on room pages.
- Shows unread count when drawer is closed.
- Opens the drawer from the bottom.
- Must avoid covering the mobile bottom nav.

Mobile placement:

- `fixed right-4 bottom-24`
- Use safe-area spacing with `env(safe-area-inset-bottom)` if needed.

Desktop placement:

- `fixed right-6 bottom-6`
- Drawer can open as a bottom-right panel or centered bottom sheet.

Visual direction:

- Use the existing dark surface and gold accent.
- Icon should be simple and obvious: `💬` or an SVG chat bubble.
- Badge should be small, high contrast, and capped at `99+`.

### RoomChatDrawer

Mobile behavior:

- Opens from bottom.
- Height around `78svh` to `85svh`.
- Rounded top corners.
- Header remains sticky.
- Composer remains sticky at bottom.
- Message list scrolls independently.

Desktop behavior:

- Use a compact bottom-right chat panel.
- Width around `380px` to `440px`.
- Height around `620px`.

Telegram-like UX:

- Own messages align right.
- Other users align left.
- Show avatar/name for other users.
- Show compact timestamps.
- Auto-scroll to latest when user is already near bottom.
- Do not force-scroll if user is reading older messages.
- Show “New messages” pill if messages arrive while user is scrolled up.
- “Load earlier messages” appears at the top.

### RoomChatComposer

Behavior:

- Single text box with send button.
- Enter sends on desktop.
- Shift + Enter creates a new line.
- On mobile, normal keyboard send behavior should remain comfortable.
- Disable send while the body is empty or sending.
- Show failed state with retry if POST fails.

Limits:

- Max 500 characters.
- Show a small character counter only after 420 characters.

## 9. State Management

Keep state local to the chat component.

State values:

- `isOpen`
- `messages`
- `isLoadingInitial`
- `isLoadingOlder`
- `hasMore`
- `isSending`
- `sendError`
- `unreadCount`
- `lastSeenMessageAt`

Persistence:

- Store last seen timestamp per room in `localStorage`.
- Key: `wincup:room-chat:last-seen:${roomId}`

Why localStorage:

- No database writes for read receipts.
- No extra Realtime messages.
- Good enough for version 1.

## 10. Free-Tier Resource Strategy

The chat must be designed around these constraints:

- No polling.
- Fetch history only when drawer opens.
- Fetch only 50 messages per page.
- Subscribe only to new message inserts.
- Limit message body to 500 characters.
- Rate limit sends per user per room.
- Avoid typing indicators and read receipts.
- Avoid storing images/files in chat.

Estimated usage:

- Opening chat: 1 Vercel Function invocation and about 3 Supabase operations.
- Sending a message: 1 Vercel Function invocation, 2 to 4 Supabase operations, and 1 Realtime insert event.
- Receiving a message: no Vercel Function invocation, only Supabase Realtime delivery.

Example room with 20 players:

- If 20 players send 5 messages each, that is 100 POST invocations, 100 inserts, and about 2,000 Realtime message deliveries.
- This is acceptable for small rooms.
- It becomes expensive only if chat becomes very active across hundreds of rooms, so version 1 intentionally avoids noisy events.

## 11. Implementation Steps

### Step 1: Add Database Migration

Add:

- `supabase/migrations/20240113000000_room_messages.sql`

Include:

- `room_messages` table.
- Indexes.
- RLS policy.
- Realtime publication addition.

Also update:

- `src/lib/types/database.ts`

### Step 2: Add Message Validation Helpers

Create:

- `src/lib/messages.ts`

Include:

- `MAX_MESSAGE_LENGTH = 500`
- `MESSAGE_PAGE_SIZE = 50`
- `validateMessageBody(body)`
- `normalizeMessageBody(body)`
- `isRoomChatMember(...)` or a server-only helper in `src/lib/room-membership.ts`

### Step 3: Add Message API Route

Create:

- `src/app/api/rooms/[id]/messages/route.ts`

Implement:

- `GET` for history pagination.
- `POST` for sending messages.
- Authentication.
- Membership checks.
- Rate limiting.
- Safe server-derived sender name/avatar.

### Step 4: Add Realtime Helper

Update:

- `src/lib/supabase/realtime.ts`

Add:

- `subscribeRoomMessages(roomId, callbacks)`

Subscribe to all row changes with `event: "*"` and handle:

- `INSERT`: append the new message.
- `UPDATE`: patch the existing message, useful for future soft-delete or edit support.
- `DELETE`: remove the message locally if hard-delete is ever used.

### Step 5: Add Chat UI Components

Create the room chat components under:

- `src/app/room/[id]/_components/`

The launcher should be rendered from:

- `src/app/room/[id]/layout.tsx`

Only render chat launcher for authenticated users who can access the room.

### Step 6: Integrate Across Room Pages

Because the chat launcher lives in the room layout, it should automatically appear on:

- Lobby
- Join preview after access is allowed
- Draw
- Group stage
- Ladder
- Bracket setup
- Winner

If a page renders unauthenticated children, do not show chat.

### Step 7: Polish Mobile UX

Check:

- Drawer does not hide behind bottom nav.
- Composer stays visible above mobile keyboard as much as possible.
- Message list has enough bottom padding.
- Tap targets are at least 44px.
- Focus ring is visible.
- Escape closes drawer on desktop.
- Backdrop tap closes drawer on mobile.

### Step 8: Add Documentation Notes

Add a short note to the final report when implemented:

- Chat is room-scoped.
- Chat uses Supabase Realtime.
- Chat intentionally avoids polling and typing indicators to stay free-tier friendly.

## 12. Testing Plan

### Unit Tests

Add tests for:

- `normalizeMessageBody`
- `validateMessageBody`
- Empty message rejection.
- 500 character limit.
- Whitespace trimming.
- Message grouping by date if implemented.
- Unread count logic.
- LocalStorage last-seen key generation.

Suggested files:

- `src/lib/messages.test.ts`
- `src/app/room/[id]/_components/RoomChatDrawer.test.tsx`

Run:

```bash
npm run test
```

### API Integration Tests

Test `GET /api/rooms/[id]/messages`:

- Unauthenticated user receives `401`.
- Non-member receives `403`.
- Room member receives latest messages.
- `limit` is capped at 50.
- `before` cursor returns older messages.

Test `POST /api/rooms/[id]/messages`:

- Unauthenticated user receives `401`.
- Non-member receives `403`.
- Empty body is rejected.
- Long body is rejected.
- Valid player message is inserted.
- Host who is not playing can send.
- Rate limit returns `429`.

Suggested file:

- `src/app/api/rooms/[id]/messages/route.test.ts`

### Realtime Tests

Use component-level tests with a mocked `subscribeRoomMessages`:

- New incoming message appears in the list.
- Updated message patches the existing list item.
- Deleted message is removed from the visible list.
- Duplicate message id is ignored.
- Own message aligns right.
- Other user message aligns left.
- Unread count increases while drawer is closed.
- Unread count clears when drawer opens.

### E2E Tests

Add Playwright tests:

- Host creates a room.
- Host opens chat and sends a message.
- Player joins the room.
- Player opens chat and sees previous host message.
- Player sends a reply.
- Host sees reply without refreshing.
- Host starts the room.
- Chat remains available on draw/group-stage page.
- Mobile viewport verifies drawer layout and composer usability.

Suggested file:

- `tests/e2e/room-chat.spec.ts`

Run:

```bash
npm run test:e2e
```

### Security Tests

Verify:

- Non-member cannot fetch messages by guessing a room id.
- Non-member cannot post messages by guessing a room id.
- Client-provided sender name is ignored.
- HTML/script text is displayed as plain text.
- Deleted room cascades chat messages through `ON DELETE CASCADE`.

### Performance Checks

Manual or automated checks:

- Open one room with 20 messages, drawer opens smoothly.
- Open one room with 200 messages, initial load still fetches only 50.
- Confirm no network polling occurs while chat is open.
- Confirm no network polling occurs while chat is closed.
- Confirm only one chat Realtime channel is created per room page.

Run:

```bash
npm run typecheck
npm run lint
npm run test
```

## 13. Rollout Plan

Phase 1:

- Add table, API route, realtime helper, and chat drawer.
- Support plain text messages only.
- Support history pagination.
- Support unread count with localStorage.

Phase 2:

- Add soft delete for own messages or host moderation.
- Add simple admin delete action if abuse becomes a concern.
- Add “message failed, tap to retry” polish.

Phase 3:

- Consider typing indicators only if the app is already on a paid Supabase plan.
- Consider attachments only after storage, moderation, and cost controls are designed.

## 14. Acceptance Criteria

The feature is complete when:

- Every authenticated room member can open chat from every room phase.
- Messages send successfully and appear without refresh.
- New messages from other members arrive live.
- Previous messages load when the drawer opens.
- Older messages can be loaded without fetching the full room history.
- Non-members cannot read or send messages.
- The chat works well on mobile and does not collide with the bottom nav.
- There is no message polling.
- Unit, API, and E2E tests pass.

## 15. Recommended Final File Checklist

Expected new or changed files:

- `supabase/migrations/20240113000000_room_messages.sql`
- `src/lib/types/database.ts`
- `src/lib/messages.ts`
- `src/lib/messages.test.ts`
- `src/lib/supabase/realtime.ts`
- `src/app/api/rooms/[id]/messages/route.ts`
- `src/app/api/rooms/[id]/messages/route.test.ts`
- `src/app/room/[id]/layout.tsx`
- `src/app/room/[id]/_components/RoomChatLauncher.tsx`
- `src/app/room/[id]/_components/RoomChatDrawer.tsx`
- `src/app/room/[id]/_components/RoomChatMessageList.tsx`
- `src/app/room/[id]/_components/RoomChatBubble.tsx`
- `src/app/room/[id]/_components/RoomChatComposer.tsx`
- `tests/e2e/room-chat.spec.ts`
