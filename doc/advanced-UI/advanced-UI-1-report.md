# Advanced UI Implementation Report 1

## Summary

Implemented the mobile-first authenticated app redesign described in `doc/advanced-UI/advanced-UI-1-plan.md`.

The Dashboard is now focused on public room discovery only, personal rooms moved to `/my-rooms`, Profile was added as an account-management page, and the authenticated experience now has a shared app shell with desktop navigation, mobile hamburger access, and a fixed mobile bottom tab bar.

## What Changed

### Shared Authenticated Shell

- Added `src/components/app/AppShell.tsx` to wrap authenticated pages with consistent layout and mobile bottom spacing.
- Added `src/components/app/TopAppBar.tsx` for brand, desktop navigation, mobile menu, signed-in user label, and sign out.
- Added `src/components/app/MobileBottomNav.tsx` and `src/components/app/NavLinkItem.tsx` for persistent mobile-first navigation.
- Added `src/components/app/nav-items.ts` so Discover, My Rooms, Create, Join, and Profile links are defined once.

### Dashboard Discovery

- Refactored `src/app/dashboard/page.tsx` so it only shows public lobby rooms waiting for players.
- Excluded rooms already hosted or joined by the current user from public discovery.
- Added compact discovery controls in `src/app/dashboard/_components/PublicRoomDiscoveryControls.tsx`.
- Kept public room search, assignment-mode filter, stake range, date range, and sort support while making the first mobile screen lighter.

### My Rooms

- Added `src/app/my-rooms/page.tsx` for hosted and joined rooms.
- Added `src/app/my-rooms/_components/MyRoomsControls.tsx` with mobile-friendly search, chips, filters, and sorting.
- Added `src/lib/my-room-filters.ts` for pure, testable My Rooms filtering.
- My Rooms supports filtering by role, room status, assignment mode, search text, and sort order.

### Profile

- Added `src/app/profile/page.tsx` for account settings.
- Added `src/app/profile/_components/ProfileForm.tsx`, `PasswordForm.tsx`, and `WalletPreviewCard.tsx`.
- Added `src/actions/profile.ts` with username update and password update server actions.
- Added `supabase/migrations/20240113000000_profiles_update_policy.sql` so authenticated users can update their own profile row through RLS.
- Profile updates use the authenticated Supabase session for the update so the RLS policy is enforced.

### Shared Room UI

- Added `src/lib/room-list.ts` for room list mapping, counts, labels, colors, routes, and display helpers.
- Added `src/components/rooms/RoomCard.tsx` for reusable room cards across Dashboard and My Rooms.
- Added `src/components/rooms/RoomEmptyState.tsx` for consistent empty states.
- Room cards now share route behavior for public rooms, hosted rooms, joined rooms, and finished rooms.

## Testing Added

- Added `tests/unit/lib/my-room-filters.test.ts`.
- Added `tests/unit/components/app/MobileBottomNav.test.tsx`.
- Added `tests/unit/components/rooms/RoomCard.test.tsx`.
- Added `tests/unit/components/profile/ProfileForms.test.tsx`.

## Validation Results

### Passed

```bash
npm run typecheck
```

Result: passed.

```bash
npm test -- --runInBand
```

Result: passed, 44 test suites and 348 tests.

```bash
npx eslint src/lib/room-list.ts src/lib/my-room-filters.ts src/actions/profile.ts src/components/app/AppShell.tsx src/components/app/MobileBottomNav.tsx src/components/app/NavLinkItem.tsx src/components/app/TopAppBar.tsx src/components/app/UserMenu.tsx src/components/app/nav-items.ts src/components/rooms/RoomCard.tsx src/components/rooms/RoomEmptyState.tsx src/app/dashboard/page.tsx src/app/dashboard/_components/PublicRoomDiscoveryControls.tsx src/app/my-rooms/page.tsx src/app/my-rooms/_components/MyRoomsControls.tsx src/app/profile/page.tsx src/app/profile/_components/ProfileForm.tsx src/app/profile/_components/PasswordForm.tsx src/app/profile/_components/WalletPreviewCard.tsx tests/unit/lib/my-room-filters.test.ts tests/unit/components/app/MobileBottomNav.test.tsx tests/unit/components/rooms/RoomCard.test.tsx tests/unit/components/profile/ProfileForms.test.tsx
```

Result: passed.

### Attempted With Notes

```bash
npm run lint
```

Result: failed on existing repository-wide lint issues outside this implementation, mostly `no-explicit-any` and older React hook lint issues in existing files such as `src/actions/room.ts`, `src/lib/ingest.ts`, and existing route components. The new/changed Advanced UI files pass targeted ESLint.

```bash
timeout 120s npm run build
```

Result: Turbopack build did not finish within 120 seconds and produced no actionable error output.

```bash
timeout 180s npx next build --webpack
```

Result: failed with `Build failed because of webpack errors`, but Next.js did not print the underlying webpack error. A targeted webpack compile for the new app routes completed successfully.

## Decisions

- Dashboard hides rooms already hosted or joined by the user and keeps them in My Rooms.
- Advanced filters use inline expandable panels instead of a modal bottom sheet for simpler accessibility and testing.
- Wallet is shown as a future-ready Profile section but no wallet/payment logic was added.
- Profile username updates validate uniqueness and password updates use Supabase Auth.

## Follow-Up Recommendations

- Add seeded Playwright coverage for Dashboard, My Rooms, and Profile once a stable local E2E test account/database fixture exists.
- Investigate the existing repository-wide ESLint issues separately so `npm run lint` can become a reliable CI gate.
- Investigate the silent full production build failure separately, starting with Next.js build diagnostics or running in a clean local shell outside the Codex sandbox.
