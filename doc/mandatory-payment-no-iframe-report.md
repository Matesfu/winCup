# Mandatory Stake, Waiting Room Deletion, And FIFA Link Cleanup Report

## Summary

Implemented four requested corrections:

1. Room stake is now mandatory before a host can create a room.
2. Hosts can delete rooms only while they are still waiting in the lobby.
3. Old frontend copy saying WinCup does not support payments was removed.
4. The removed FIFA iframe explanation/card no longer renders, while the official FIFA fixtures link remains.

## Mandatory Stake

### Frontend

Updated the Create Room flow so stake is required before the submit button can enable.

Changed files:

```text
src/app/room/create/_components/CreateRoomForm.tsx
src/app/room/create/_components/StakeInput.tsx
```

Behavior:

- The stake section is now titled `Stake`, not `Stake (Optional)`.
- The visible stake input is marked required.
- The Create Room button stays disabled until the host enters a number greater than `0`.
- The helper message explains that the host must enter a stake amount greater than `0`.
- Old payment-disclaimer copy was removed from the stake section.

### Server Validation

Updated:

```text
src/lib/validation.ts
src/actions/room.ts
```

Behavior:

- Empty stake is rejected.
- Whitespace-only stake is rejected.
- `0` and negative values are rejected.
- Positive values such as `10` and `9.99` are accepted.
- The room creation action now parses stake as a required numeric value.

### Database

Added:

```text
supabase/migrations/20240112000000_require_room_stake.sql
```

Database behavior:

- New room rows must include `stake_amount IS NOT NULL`.
- New room rows must include `stake_amount > 0`.
- The constraint is added as `NOT VALID`, so existing old rooms with `NULL` stake do not break the migration.
- Future inserts and updates are still protected by the constraint.

## Host Room Deletion

Added:

```text
src/app/room/[id]/lobby/_components/DeleteRoomButton.tsx
```

Updated:

```text
src/actions/room.ts
src/app/room/[id]/lobby/_components/LobbyRealtime.tsx
src/app/room/[id]/lobby/_components/StartDrawButton.tsx
src/lib/supabase/realtime.ts
```

Behavior:

- Only the host sees `Delete waiting room`.
- The first click opens an inline caution panel.
- The caution explains that deleting removes the room, room code, joined players, and selected countries.
- The host must click `Yes, delete room` before the server action runs.
- The server action refuses deletion unless:
  - the user is authenticated,
  - the user is the room host,
  - the room status is still `lobby`.
- Started rooms cannot be deleted.
- Successful deletion redirects the host to `/dashboard` with replace navigation.
- Other lobby viewers are routed to `/dashboard` if the room disappears.

## Payment Copy Cleanup

Removed old visible frontend copy saying the app does not handle or process payments.

Updated:

```text
src/components/landing/Footer.tsx
src/app/room/[id]/draw/_components/DrawSummary.tsx
src/app/room/[id]/winner/_components/WinnerScreen.tsx
src/app/room/[id]/winner/_components/NoWinnerScreen.tsx
```

Also removed the old `Settle up offline with friends` note from the winner screen.

The frontend now keeps stake/prize language, but no longer says that payment support is unavailable.

## FIFA Fixture Cleanup

Updated:

```text
src/app/room/[id]/group-stage/_components/WorldCupStandingsEmbed.tsx
```

Removed:

- `First Stage fixtures on FIFA.com`
- `FIFA blocks third-party iframe display with browser security headers...`
- the extra secondary `View fixtures` card

Kept:

- `Official FIFA Fixtures`
- the explanation telling users to open the selected FIFA stage directly
- the `Open official page` button

## Tests Added Or Updated

Updated:

```text
tests/unit/lib/validation.test.ts
tests/unit/components/room/create/CreateRoomForm.test.tsx
tests/unit/components/landing/Footer.test.tsx
tests/e2e/create-room.spec.ts
tests/e2e/landing.spec.ts
tests/unit/components/room/winner/WinnerScreen.test.tsx
tests/unit/components/room/winner/NoWinnerScreen.test.tsx
```

Added:

```text
tests/unit/components/room/lobby/DeleteRoomButton.test.tsx
tests/unit/components/room/group-stage/WorldCupStandingsEmbed.test.tsx
```

Coverage:

- Stake validation rejects empty, whitespace, zero, negative, and non-numeric values.
- Create Room submit stays disabled until stake and required countries are present.
- Delete Room button shows a caution panel before final deletion.
- Delete Room form carries the room id.
- Delete confirmation can be canceled.
- Footer no longer renders the old unsupported-payment disclaimer.
- FIFA fixture component keeps the official link and does not render the removed iframe-blocked explanation.

## Validation Results

Passed:

```bash
npm run typecheck
```

Passed focused unit tests:

```bash
npm test -- --runInBand tests/unit/components/room/winner/WinnerScreen.test.tsx tests/unit/components/room/winner/NoWinnerScreen.test.tsx tests/unit/components/room/lobby/DeleteRoomButton.test.tsx tests/unit/components/room/group-stage/WorldCupStandingsEmbed.test.tsx tests/unit/components/room/create/CreateRoomForm.test.tsx tests/unit/lib/validation.test.ts tests/unit/components/landing/Footer.test.tsx
```

Passed full unit test suite:

```bash
npm test -- --runInBand
```

Result:

- 40 test suites passed
- 333 tests passed

Passed targeted ESLint for changed UI, validation, realtime, winner, and test files.

Attempted browser E2E:

```bash
npx playwright test tests/e2e/landing.spec.ts --project=chromium
```

Result:

- The local Next.js server could start after elevated permission.
- Playwright could not run assertions because the Chromium browser binary is not installed locally.
- Error shown by Playwright: run `npx playwright install`.

## Manual Checks To Perform

Before deploying, manually verify:

1. Create Room cannot submit without stake.
2. Create Room can submit with stake greater than `0` and at least two countries.
3. Host sees `Delete waiting room` in lobby.
4. Delete warning appears before deletion.
5. Deleted waiting room returns host to Dashboard.
6. Started rooms do not show a usable deletion path and are rejected by the server action.
7. Group Stage shows only the official FIFA fixture link section.
