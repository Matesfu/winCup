# Advanced UI Implementation Plan 1

## Goal

Redesign the authenticated WinCup experience around mobile-first use.

The current Dashboard mixes two different jobs in one page:

1. Discover public rooms that are waiting for players.
2. Manage rooms the user hosts or joined.

On mobile this creates visual overload. The plan is to make Dashboard focused on public room discovery, move personal rooms to a separate My Rooms page, add a Profile page, and introduce navigation that feels natural on phones.

## Design Direction

### Mobile-first Scene

A user opens WinCup on a phone, probably in a casual group chat moment, and wants to quickly find a public room, join by code, or check a room they already joined. The UI should feel direct, tappable, and low-friction.

### Product References

Use patterns from mature mobile products:

- Airbnb style discovery: compact search bar, filter chips, bottom-sheet style advanced filters, clear sort state.
- Marketplace style lists: one primary list per page, strong cards, obvious calls to action.
- Banking/profile apps: simple Profile page with separated account, password, and future wallet sections.
- Mobile app shells: persistent bottom navigation for primary authenticated pages.

### UX Principles

- One page, one main job.
- Important actions visible without scrolling too far.
- Filters should not dominate the first mobile screen.
- Cards should be easy to scan with one hand.
- Navigation should not depend on the hamburger menu alone.
- Desktop should still feel organized, but mobile drives layout decisions.

## Target Information Architecture

### Authenticated Routes

```text
/dashboard              Public room discovery only
/my-rooms               Rooms I host or joined
/profile                Profile, password, future wallet placeholder
/room/create            Create room
/room/join              Join private room by code
```

### Primary Navigation

Authenticated navigation should expose:

```text
Discover   -> /dashboard
My Rooms   -> /my-rooms
Create     -> /room/create
Join       -> /room/join
Profile    -> /profile
```

### Mobile Navigation

Mobile gets two navigation layers:

1. Bottom tab bar for the main authenticated routes.
2. Hamburger or top overflow menu for secondary actions such as Sign Out.

Bottom nav should be visible on:

```text
/dashboard
/my-rooms
/profile
```

Optional later extension:

```text
/room/create
/room/join
```

For room gameplay pages, keep the current room-specific header because users are inside a focused game flow.

## Current State Summary

### Current Dashboard

`src/app/dashboard/page.tsx` currently handles:

- fetching profile data,
- fetching hosted rooms,
- fetching joined rooms,
- fetching public lobby rooms,
- rendering top navigation,
- rendering My Rooms,
- rendering Public Rooms Waiting,
- rendering public room filters,
- rendering room cards.

This should be split into smaller route pages and shared components.

### Existing Filter Helper

`src/lib/public-room-filters.ts` already supports:

- search query,
- assignment mode,
- min stake,
- max stake,
- date range,
- sort.

This can be kept for public room discovery and extended or generalized for My Rooms.

## Implementation Phases

## Phase 1: Shared App Shell

### Objective

Create a reusable authenticated shell so Dashboard, My Rooms, and Profile share consistent navigation.

### New Components

```text
src/components/app/AppShell.tsx
src/components/app/TopAppBar.tsx
src/components/app/MobileBottomNav.tsx
src/components/app/NavLinkItem.tsx
src/components/app/UserMenu.tsx
```

### Behavior

- `TopAppBar` shows WinCup brand, current user, hamburger/overflow, and Sign Out.
- `MobileBottomNav` is fixed to the bottom on small screens.
- Bottom nav uses large tap targets, at least 44px high.
- Active route is visually clear.
- Main content gets bottom padding so cards are not hidden behind the bottom nav.
- Desktop uses a top nav with inline links or a compact horizontal nav.

### Notes

Use `usePathname()` in client nav components for active state.
Keep `signOut` in a server-action form where possible.

## Phase 2: Dashboard Becomes Public Discovery

### Objective

Make `/dashboard` show only public rooms waiting for players.

### Data

Keep public query logic from current `DashboardPage`:

```text
rooms.visibility = public
rooms.status = lobby
```

Exclude rooms already joined or hosted by the current user if desired, or show them with a small `Joined`/`Host` badge and route to the correct room page. Recommended first implementation: exclude them from public discovery and keep them in My Rooms.

### Mobile Layout

Top area:

```text
Welcome back, username
Find a public room waiting for players
[Search rooms]
[Filter] [Sort: Newest]
```

The first mobile screen should show:

- title,
- primary search,
- compact filter chips,
- first room card or empty state.

### Search And Filters

Replace the large always-visible filter form with a compact discovery control.

Recommended components:

```text
src/app/dashboard/_components/PublicRoomSearchBar.tsx
src/app/dashboard/_components/PublicRoomFilterChips.tsx
src/app/dashboard/_components/PublicRoomFilterPanel.tsx
src/app/dashboard/_components/PublicRoomSortControl.tsx
```

Mobile behavior:

- Search input is visible.
- Common filters appear as horizontal chips:
  - Random
  - Player choice
  - Low stake
  - High stake
- Advanced filters open in an inline expandable panel or bottom-sheet style panel.
- Avoid a full-page filter block before room results.

Desktop behavior:

- Search bar and chips can sit in a single toolbar.
- Advanced filters can expand below the toolbar.

### Public Room Cards

Create or reuse a shared card component:

```text
src/components/rooms/RoomCard.tsx
src/components/rooms/RoomMetaPill.tsx
src/components/rooms/RoomStatusBadge.tsx
```

Card should show:

- room name,
- stake in Birr,
- players/countries count,
- assignment mode,
- host name,
- created date,
- `Join Room` CTA.

Mobile card priorities:

1. Room name and stake.
2. Players and mode.
3. Join button.
4. Secondary metadata.

## Phase 3: Add My Rooms Page

### Objective

Move hosted and joined rooms into `/my-rooms`.

### New Route

```text
src/app/my-rooms/page.tsx
src/app/my-rooms/_components/MyRoomsToolbar.tsx
src/app/my-rooms/_components/MyRoomsTabs.tsx
src/app/my-rooms/_components/MyRoomsEmptyState.tsx
```

### Data

Use logic currently in `src/app/dashboard/page.tsx`:

- query `players` by `user_id`,
- fetch joined rooms,
- fetch hosted rooms,
- merge by room id,
- mark role as `host` or `player`,
- count players and selected countries.

### Filters

My Rooms needs its own search, filter, and sort because a user can host and join many rooms.

Recommended URL params:

```text
/my-rooms?q=&role=all|host|player&status=all|lobby|drawn|group_stage|knockout|finished&mode=all|random|player_choice&sort=recent|oldest|stake_high|stake_low
```

### New Helper

```text
src/lib/my-room-filters.ts
```

Filter support:

- Search by room name or room code.
- Role filter: all, hosted, joined.
- Status filter: all, waiting, active, finished, or exact room statuses.
- Assignment mode filter.
- Stake sort.
- Date sort.

### UI Layout

Mobile first:

```text
My Rooms
[Search my rooms]
[Hosted] [Joined] [Active] [Finished]
[Sort]
Room cards...
```

For clarity, use segmented chips instead of a large form.

### Empty States

- No rooms at all: show Create Room and Join by Code actions.
- No hosted rooms: show Create Room.
- No joined rooms: show Dashboard public room discovery and Join by Code.
- No filtered result: show Clear filters.

## Phase 4: Add Profile Page

### Objective

Give users a place to manage profile information now and prepare for wallet management later.

### New Route

```text
src/app/profile/page.tsx
src/app/profile/_components/ProfileForm.tsx
src/app/profile/_components/PasswordForm.tsx
src/app/profile/_components/WalletPreviewCard.tsx
src/actions/profile.ts
```

### Profile Fields

Current `profiles` table supports:

```text
id
username
created_at
```

Initial Profile page should show:

- username,
- email from Supabase auth user,
- account created date if available,
- password update form,
- future wallet card placeholder.

### Required Database/RLS Check

Current `profiles` migration allows public read and own insert, but it does not show an own update policy. To let users update their profile, add a migration if needed:

```text
supabase/migrations/20240113000000_profiles_update_policy.sql
```

Expected policy:

```sql
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

### Server Actions

`src/actions/profile.ts` should include:

```text
updateProfile
updatePassword
```

Validation:

- username uses existing `Validation.username`.
- username uniqueness check excludes current user.
- password uses existing `Validation.password`.

Supabase password update:

```ts
supabase.auth.updateUser({ password })
```

### Wallet Placeholder

Show a disabled or informational card:

```text
Wallet
Coming soon: deposit, withdraw, and room payment history.
```

Do not implement actual wallet logic yet unless a later plan asks for it.

## Phase 5: Refactor Dashboard Code Into Shared Modules

### Objective

Avoid keeping all fetching/rendering logic inside one huge route file.

### Shared Files

```text
src/lib/room-routes.ts
src/lib/room-display.ts
src/lib/room-queries.ts
src/components/rooms/RoomCard.tsx
src/components/rooms/RoomList.tsx
src/components/rooms/RoomEmptyState.tsx
```

Move from `dashboard/page.tsx`:

- `ROOM_COLUMNS`,
- `STATUS_LABEL`,
- `STATUS_COLOR`,
- `roomRoute`,
- `withRoomCounts`,
- `toDashboardRoom`,
- `RoomCard`.

Recommended shared type:

```ts
type RoomListItem = RoomRow & {
  playerCount: number;
  countryCount: number;
  userRole: "host" | "player" | "public";
};
```

## Phase 6: Mobile Visual Polish

### Dashboard Discovery Polish

- Use a rounded search bar at the top.
- Keep filter chips horizontally scrollable on mobile.
- Use an expandable advanced filter area.
- Make card CTAs full-width on small screens.
- Keep one strong primary button per card.

### My Rooms Polish

- Add role/status chips.
- Use clearer badges:
  - Host
  - Joined
  - Waiting
  - Active
  - Finished
- Make room status more visible than room code.
- Keep room code visible but secondary.

### Bottom Navigation Polish

- Fixed bottom nav, hidden on desktop.
- Use icons plus labels.
- Suggested icons:
  - Discover: 🔎
  - My Rooms: 🏟️
  - Create: ➕
  - Join: 🎟️
  - Profile: 👤
- Active item uses gold accent and a soft selected background.
- Respect safe-area padding with `pb-[env(safe-area-inset-bottom)]` or equivalent Tailwind arbitrary value.

## Phase 7: Accessibility And Responsive Requirements

### Accessibility

- All navigation items need text labels.
- Filter panels need accessible labels and keyboard focus.
- Search inputs need visible or screen-reader labels.
- Bottom nav should be `<nav aria-label="Primary">`.
- Filter chips should use buttons or links with clear selected state.
- Avoid tiny tap targets.

### Mobile Requirements

Test at:

```text
320px width
375px width
390px width
430px width
```

No horizontal overflow.
Primary actions reachable without precision taps.
Bottom nav does not cover page content.

## Testing Plan

## Unit Tests

### Navigation Components

Add:

```text
tests/unit/components/app/MobileBottomNav.test.tsx
tests/unit/components/app/TopAppBar.test.tsx
```

Test:

- renders main navigation links,
- highlights active route,
- has accessible labels,
- includes Profile and My Rooms links,
- sign out form remains available in top/overflow area.

### Dashboard Public Discovery

Add/update:

```text
tests/unit/pages/dashboard-public-discovery.test.ts
```

Because the page is server-rendered, consider extracting pure helpers and testing them directly.

Test:

- Dashboard does not render My Rooms section.
- Public room filters parse and apply correctly.
- Public discovery only includes `visibility = public` and `status = lobby`.
- Joined/hosted rooms are excluded from public discovery if that rule is chosen.

### My Rooms Filtering

Add:

```text
tests/unit/lib/my-room-filters.test.ts
tests/unit/pages/my-rooms-filtering.test.ts
```

Test:

- role filter parses all, host, player,
- status filter parses active and finished,
- search matches room name and code,
- sort by recent, oldest, stake high, stake low,
- invalid params fall back safely.

### Profile Actions

Add:

```text
tests/unit/actions/profile.test.ts
```

Test:

- invalid username rejected,
- duplicate username rejected,
- current user's same username allowed,
- password shorter than 8 rejected,
- updateUser called with new password.

If direct server action tests are difficult with current setup, extract validation helpers and test those first.

### Room Card Component

Add:

```text
tests/unit/components/rooms/RoomCard.test.tsx
```

Test:

- public room card routes to join page,
- hosted/joined room card routes to correct room phase,
- stake renders in Birr,
- role/status badges render correctly,
- CTA is accessible.

## E2E Tests

Update or add Playwright specs:

```text
tests/e2e/dashboard.spec.ts
tests/e2e/my-rooms.spec.ts
tests/e2e/profile.spec.ts
```

Dashboard:

- signed-in user lands on Dashboard,
- Dashboard shows public discovery,
- Dashboard does not show My Rooms section,
- search/filter UI is visible and usable on mobile viewport,
- bottom nav links to My Rooms and Profile.

My Rooms:

- My Rooms page lists hosted and joined rooms,
- role filter switches between hosted and joined,
- search by room code works,
- empty state appears when filters match nothing.

Profile:

- Profile page loads user email and username,
- username form validates invalid usernames,
- password form validates short passwords,
- wallet placeholder appears.

Mobile E2E:

- viewport 375px,
- bottom nav visible,
- no horizontal overflow on Dashboard, My Rooms, Profile,
- filter UI does not occupy the entire first screen.

## Suggested Implementation Order

1. Create shared app shell and bottom nav.
2. Extract room card and room route helpers.
3. Refactor Dashboard into public discovery only.
4. Add compact public search/filter/sort UI.
5. Add My Rooms route and filters.
6. Add Profile route and server actions.
7. Add profile update RLS migration if needed.
8. Add mobile polish and accessibility pass.
9. Add unit tests.
10. Add/update E2E tests.
11. Run typecheck, lint, unit tests, and selected E2E.

## Validation Commands

Use these during implementation:

```bash
npm run typecheck
npm test -- --runInBand
npx eslint src/app/dashboard src/app/my-rooms src/app/profile src/components/app src/components/rooms src/lib/my-room-filters.ts
```

If Playwright browsers are installed:

```bash
npx playwright test tests/e2e/dashboard.spec.ts tests/e2e/my-rooms.spec.ts tests/e2e/profile.spec.ts --project=chromium
```

If browsers are not installed, run:

```bash
npx playwright install
```

## Risks And Decisions To Confirm

### Public Rooms Exclusion

Decision needed:

Should public rooms already joined or hosted by the user be hidden from Dashboard discovery, or shown with a `Joined`/`Host` badge?

Recommended:

Hide them from Dashboard and show them only in My Rooms.

### Profile Username Changes

Decision needed:

Can users change usernames after sign-up?

Recommended:

Yes, but validate uniqueness and add the RLS update policy.

### Wallet Placeholder

Decision needed:

Should wallet be visible now as `Coming soon`, or hidden until payment work starts?

Recommended:

Show a small `Coming soon` card on Profile so the page architecture is ready without pretending wallet exists.

### Filter Panel Pattern

Decision needed:

Should advanced filters be an inline expandable panel or a mobile bottom sheet?

Recommended first implementation:

Use an inline expandable panel. It is simpler, accessible, easier to test, and avoids modal complexity. Later, upgrade to a bottom sheet if needed.

## Expected Outcome

After implementation:

- `/dashboard` becomes a clean public room discovery page.
- `/my-rooms` becomes the user’s personal room management page.
- `/profile` becomes the account settings and future wallet page.
- Mobile users get a bottom navigation bar for the main app areas.
- Search, filters, and sorting become compact and less overwhelming.
- Room cards become reusable and consistent across pages.
- Tests cover the new routes, filters, navigation, and profile actions.
