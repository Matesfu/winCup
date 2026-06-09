# Room Message System Implementation Report

## Summary

Implemented the room-scoped group chat system described in the plan.

The feature adds:

- A `room_messages` Supabase table with RLS and Realtime publication.
- Authenticated `GET` and `POST` message API routes.
- Room-member access checks for host and joined players.
- Message body validation, page-size limits, and per-user rate limiting.
- One filtered Supabase Realtime chat channel per room page.
- A mobile-first bottom chat drawer with Telegram-style message bubbles.
- Unread badge support while the drawer is closed.
- History loading only when the drawer opens, with older-message pagination.
- Unit tests for message helpers and chat UI behavior.

## Implemented Files

### Database

- `supabase/migrations/20240113000000_room_messages.sql`

Adds:

- `room_messages` table.
- `idx_room_messages_room_created_at` index.
- `idx_room_messages_sender_user` index.
- RLS read policy for room hosts and joined players.
- Supabase Realtime publication registration.

### Types And Helpers

- `src/lib/types/database.ts`
- `src/lib/messages.ts`

Adds:

- `RoomMessage` and `RoomMessageInsert` types.
- Message normalization and validation helpers.
- Message pagination limit parser.
- LocalStorage key helper for last-seen chat state.

### API

- `src/app/api/rooms/[id]/messages/route.ts`

Adds:

- `GET /api/rooms/[id]/messages`
- `POST /api/rooms/[id]/messages`

Behavior:

- Requires authenticated Supabase user.
- Allows access only to the host or joined players.
- Fetches messages in pages of up to 50.
- Sends plain text messages up to 500 characters.
- Rate limits each user to 10 messages per 30 seconds per room.
- Derives sender name/avatar from trusted server-side room/player data.

### Realtime

- `src/lib/supabase/realtime.ts`

Adds:

- `subscribeRoomMessages(roomId, callbacks)`

Realtime behavior:

- Uses one room-filtered channel.
- Listens with `event: "*"` for `INSERT`, `UPDATE`, and `DELETE`.
- Inserts append messages.
- Updates patch existing messages.
- Deletes remove messages locally.
- No polling is used.

### UI

- `src/app/room/[id]/layout.tsx`
- `src/app/room/[id]/_components/RoomChatLauncher.tsx`
- `src/app/room/[id]/_components/RoomChatDrawer.tsx`
- `src/app/room/[id]/_components/RoomChatMessageList.tsx`
- `src/app/room/[id]/_components/RoomChatBubble.tsx`
- `src/app/room/[id]/_components/RoomChatComposer.tsx`

UI behavior:

- Chat icon appears on room pages for the host or joined players.
- Authenticated non-members do not get the chat launcher.
- After a user successfully joins a waiting room, the room layout is revalidated so chat appears immediately in the pre-draw lobby without a browser refresh.
- Drawer opens from the bottom on mobile.
- Messages align right for the current user and left for other players.
- Previous messages are fetched only when the drawer is opened.
- Older messages load through a top “Load earlier messages” button.
- Incoming messages update live through Supabase Realtime.
- Unread badge increments when other players send messages while the drawer is closed.

### Tests

- `tests/unit/lib/messages.test.ts`
- `tests/unit/components/room-chat.test.tsx`

Coverage includes:

- Empty message rejection.
- 500-character limit.
- Whitespace normalization.
- Pagination limit parsing.
- Last-seen key generation.
- Duplicate message detection.
- Pre-draw chat access for users who just joined a waiting room.
- Chat history fetch only after drawer open.
- Unread badge for closed drawer messages.
- Realtime update and delete handling.
- Sending messages through the API.

## Free-Tier Design Notes

The implementation is friendly to Vercel Hobby and Supabase Free because:

- It does not poll for messages.
- Message history loads only when the user opens chat.
- Message history is paginated to 50 messages.
- Realtime uses one filtered channel per room page.
- Typing indicators and read receipts were intentionally skipped.
- Message bodies are capped at 500 characters.
- Sending is rate-limited per user and room.

Expected cost shape:

- Opening chat: one API request and a small Supabase read.
- Sending chat: one API request, one insert, one Realtime event.
- Receiving chat: Supabase Realtime only, no Vercel invocation.

## Validation Results

Passed:

```bash
npm run test -- --runTestsByPath tests/unit/lib/messages.test.ts tests/unit/components/room-chat.test.tsx
```

Result:

- 2 test suites passed.
- 11 tests passed.

Passed:

```bash
npm run typecheck
```

Result:

- TypeScript completed successfully.

Passed:

```bash
npm run test
```

Result:

- 47 test suites passed.
- 361 tests passed.

Passed:

```bash
git diff --check
```

Result:

- No whitespace errors.

Not clean:

```bash
npm run lint
```

Result:

- Lint still fails on pre-existing unrelated files that already contain `any` casts and older React lint issues.
- The new chat files no longer appear in the lint failure output.

Attempted:

```bash
npm run build
```

Result:

- Build started with Turbopack and printed `Creating an optimized production build ...`.
- It did not finish within the validation window in the sandbox, so the result is inconclusive.
- TypeScript and Jest validation passed successfully.

## Follow-Up Recommendations

Before shipping to production:

- Apply the new Supabase migration.
- Test chat with two real browser sessions in the same room.
- Confirm Supabase Realtime is enabled for `room_messages`.
- Consider removing or reducing the existing lobby polling separately, because that remains a larger free-tier risk than chat.
