# WinCup — Phase 1 Implementation Plan: Auth + Create Room

> **Prerequisites:** Stage 1 (Foundation) complete — project scaffolded, Supabase clients configured, DB schema + RLS + seed applied, landing page live.
> **Builds on:** `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/env.ts`, `src/lib/types/database.ts`

---

## 1. Scope & Deliverables

| # | Deliverable | Route / Location |
|---|-------------|-----------------|
| 1 | Sign-up page (username + email + password) | `/auth/sign-up` |
| 2 | Sign-in page (username or email + password) | `/auth/sign-in` |
| 3 | Auth Server Actions (signUp, signIn, signOut) | `src/actions/auth.ts` |
| 4 | Auth callback route (email confirmation) | `/auth/callback/route.ts` |
| 5 | Profiles table + DB function migration | `supabase/migrations/20240102000000_profiles.sql` |
| 6 | Create Room page — full form (auth-gated) | `/room/create` |
| 7 | `createRoom` Server Action | `src/actions/room.ts` |
| 8 | Room code generator | `src/lib/room-code.ts` |
| 9 | Input validation utilities | `src/lib/validation.ts` |
| 10 | New UI components (9 components) | `src/components/ui/` + `src/app/room/create/` |
| 11 | Competition search Route Handler (placeholder) | `/api/competitions/route.ts` |
| 12 | Unit tests (8 suites) | `tests/unit/` |
| 13 | E2E tests (2 new suites — auth + create room) | `tests/e2e/` |

**Out of scope for Phase 1:**
- Lobby page (Phase 2)
- Join Room flow (Phase 2)
- Live football-data.org competition search (Phase 4; placeholder UI only)
- Supabase Realtime subscriptions (Phase 2)
- OAuth providers (Google, GitHub) — only email+password in Phase 1

---

## 2. Folder Structure — Phase 1 Additions

```
src/
├── actions/                          ← NEW: all Server Actions live here
│   ├── auth.ts                       ← signUp(), signIn(), signOut()
│   └── room.ts                       ← createRoom()
│
├── app/
│   ├── auth/
│   │   ├── sign-in/
│   │   │   └── page.tsx              ← NEW: Sign-in page (Server Component shell)
│   │   ├── sign-up/
│   │   │   └── page.tsx              ← NEW: Sign-up page (Server Component shell)
│   │   └── callback/
│   │       └── route.ts              ← NEW: handles email confirmation redirect
│   └── room/
│       └── create/
│           ├── page.tsx              ← NEW: Server Component (auth redirect + country fetch)
│           └── _components/          ← NEW: co-located, client-only components
│               ├── CreateRoomForm.tsx     ← "use client" orchestrator, holds all form state
│               ├── HostNameInput.tsx      ← Name + avatar selection
│               ├── EmojiPicker.tsx        ← Emoji avatar grid
│               ├── WinRuleToggle.tsx      ← win rule selector cards
│               ├── CountryGrid.tsx        ← country selection grid + counter
│               ├── CountryCard.tsx        ← individual selectable country card
│               └── StakeInput.tsx         ← optional stake amount (display only)
│
├── components/
│   └── ui/                           ← EXTEND existing
│       ├── Button.tsx                ← (existing)
│       ├── Card.tsx                  ← (existing)
│       ├── Input.tsx                 ← NEW: labeled text input with error state
│       ├── PasswordInput.tsx         ← NEW: password input with show/hide toggle
│       ├── FormSection.tsx           ← NEW: section wrapper with title + description
│       ├── LoadingSpinner.tsx        ← NEW: inline spinner for async states
│       └── Badge.tsx                 ← NEW: small status chip (e.g., "Selected: 6")
│
└── lib/
    ├── room-code.ts                  ← NEW: generateRoomCode() — "WC-XXXX" format
    └── validation.ts                 ← NEW: shared validators (name, email, password, username)

supabase/
└── migrations/
    └── 20240102000000_profiles.sql   ← NEW: profiles table + lookup_email_by_username() function

src/app/
└── api/
    └── competitions/
        └── route.ts                  ← NEW: GET handler, placeholder for football-data.org search

tests/
├── unit/
│   ├── lib/
│   │   ├── room-code.test.ts         ← NEW
│   │   └── validation.test.ts        ← NEW (includes username/email/password validators)
│   └── components/
│       ├── ui/
│       │   ├── Input.test.tsx        ← NEW
│       │   └── PasswordInput.test.tsx← NEW
│       └── room/create/
│           ├── CountryCard.test.tsx  ← NEW
│           ├── WinRuleToggle.test.tsx← NEW
│           └── CreateRoomForm.test.tsx ← NEW (mocked Server Action)
└── e2e/
    ├── auth.spec.ts                  ← NEW: sign-up and sign-in flows
    └── create-room.spec.ts           ← NEW: create room form + submission
```

---

## 3. Auth Architecture

### 3.1 How Authentication Works in Phase 1

WinCup uses standard email + password authentication via Supabase Auth. Every host creates a permanent account — no anonymous sessions, no magic links.

| Action | Path | Description |
|--------|------|-------------|
| **Sign up** | `/auth/sign-up` | Register with username, email, and password |
| **Sign in** | `/auth/sign-in` | Log in with **username or email** + password |
| **Sign out** | `signOut()` action | Clears session; redirects to `/` |
| **Email confirm** | `/auth/callback` | Handles the one-time confirmation link from Supabase (if confirmation is enabled in Supabase settings) |

Every authenticated host has a `auth.uid()` that becomes the room's `host_user_id`. Players who join rooms (Phase 2) will also have accounts.

### 3.2 Username Support

Supabase Auth stores users by email internally. Usernames are stored in a separate `profiles` table (one row per user) and looked up server-side when a user signs in with their username.

**How username → email lookup works:**

A `SECURITY DEFINER` Postgres function is used. This function runs with database-owner privileges and can access the `auth.users` table, which normal RLS policies cannot reach:

```sql
CREATE OR REPLACE FUNCTION lookup_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM   auth.users u
  JOIN   profiles   p ON p.id = u.id
  WHERE  lower(p.username) = lower(trim(p_username))
  LIMIT 1;
$$;
```

The sign-in Server Action calls this via `supabase.rpc('lookup_email_by_username', { p_username })`. No email addresses are exposed in any public-readable table — the profiles table stores only `id` and `username`.

### 3.3 Sign-Up Flow

```
User clicks "Create Room" → is not signed in
         │
         ▼
Redirected to /auth/sign-up?redirectTo=/room/create
         │
User fills form: username · email · password
         │
         ▼
signUp() Server Action
  ├─ Validate username (3–30 chars, alphanumeric + underscore)
  ├─ Validate email format
  ├─ Validate password strength (≥8 chars)
  ├─ Check username not already taken (profiles table)
  ├─ supabase.auth.signUp({ email, password })
  ├─ Insert into profiles { id: user.id, username }
  └─ redirect to /room/create (or redirectTo param)
         │
         ▼
Session established — host can create a room
```

> **Email confirmation:** If enabled in Supabase Auth settings, `signUp()` will not create a session immediately. The user is told to check their email. Clicking the link sends them to `/auth/callback`, which exchanges the code for a session and redirects to `/room/create`. For development, disable "Confirm email" in the Supabase dashboard to skip this step.

### 3.4 Sign-In Flow

```
User navigates to /auth/sign-in
         │
User fills: identifier (username OR email) · password
         │
         ▼
signIn() Server Action
  ├─ Identify type of identifier:
  │     contains "@" → treat as email (use directly)
  │     no "@"       → treat as username
  │                        └─ supabase.rpc('lookup_email_by_username')
  │                              found  → use the returned email
  │                              not found → return "Invalid credentials" (no hint)
  ├─ supabase.auth.signInWithPassword({ email, password })
  │     success → redirect to redirectTo param (default /room/create)
  └─     failure → return { error: "Invalid username/email or password" }
```

**Why not reveal "username not found" separately:** Merging both failure cases into one generic message prevents username enumeration — an attacker cannot determine whether an account exists by watching which error message appears.

### 3.5 Profiles Table Migration

New file: `supabase/migrations/20240102000000_profiles.sql`

```sql
-- ── profiles (one row per auth user) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text UNIQUE NOT NULL
               CHECK (char_length(trim(username)) BETWEEN 3 AND 30)
               CHECK (username ~ '^[a-zA-Z0-9_]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Anyone can read profiles (needed for username lookups on sign-in page)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_own_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Usernames are permanent in Phase 1 — no UPDATE policy
-- (add one later if username changes are allowed)

-- ── Username → email lookup function ─────────────────────────────────────────
-- SECURITY DEFINER: runs as db owner so it can access auth.users
CREATE OR REPLACE FUNCTION lookup_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM   auth.users u
  JOIN   profiles   p ON p.id = u.id
  WHERE  lower(p.username) = lower(trim(p_username))
  LIMIT 1;
$$;

-- Revoke direct execute from anon/authenticated so only server-side calls work
REVOKE EXECUTE ON FUNCTION lookup_email_by_username(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION lookup_email_by_username(text) TO service_role;

-- Index for fast username lookup
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON profiles (lower(username));
```

> **Why revoke from anon/authenticated:** The lookup function accesses `auth.users` (email addresses). We restrict it to `service_role` so only the server-side sign-in action can call it — not arbitrary browser requests. The `createAdminClient()` (service role) is used in the `signIn` Server Action for this RPC call.

### 3.6 Auth Pages

Both pages are **React Server Components** that act as shells, checking for an existing session and redirecting authenticated users away:

**`/auth/sign-in/page.tsx`:**
- If session exists → `redirect('/room/create')`
- Renders `<SignInForm>` Client Component
- Accepts `?redirectTo=` query param (forwarded to the form)
- Link at bottom: "Don't have an account? Sign up →"

**`/auth/sign-up/page.tsx`:**
- If session exists → `redirect('/room/create')`
- Renders `<SignUpForm>` Client Component
- Link at bottom: "Already have an account? Sign in →"

**`/auth/callback/route.ts`:**
```typescript
// GET /auth/callback?code=<code>&redirectTo=/room/create
// 1. Exchange code for session (email confirmation click)
// 2. Redirect to redirectTo (default /room/create)
// 3. On error → redirect /?error=auth_failed
```

### 3.7 Auth Guard on Create Room Page

The Create Room page is a protected route. In its Server Component:

```typescript
// src/app/room/create/page.tsx
const { data: { user } } = await (await createSessionClient()).auth.getUser()
if (!user) redirect(`/auth/sign-in?redirectTo=/room/create`)
```

No client-side auth handling needed — the redirect happens on the server before any HTML is sent. The `CreateRoomForm` component receives the authenticated user as a prop and can show their username.

### 3.8 Sign-In / Sign-Up Form Components

Both forms are **Client Components** co-located with their pages:

**`SignInForm.tsx`** (`/auth/sign-in/_components/SignInForm.tsx`):
```
┌──────────────────────────────┐
│  Welcome back to WinCup 🏆   │
│                              │
│  Username or email           │
│  [_________________________] │
│                              │
│  Password              [👁]  │
│  [_________________________] │
│                              │
│  [         Sign In         ] │
│                              │
│  Don't have an account?      │
│  Sign up →                   │
└──────────────────────────────┘
```

**`SignUpForm.tsx`** (`/auth/sign-up/_components/SignUpForm.tsx`):
```
┌──────────────────────────────┐
│  Create your WinCup account  │
│                              │
│  Username  (3–30 chars)      │
│  [_________________________] │
│                              │
│  Email                       │
│  [_________________________] │
│                              │
│  Password (min 8 chars) [👁] │
│  [_________________________] │
│                              │
│  [        Create Account    ]│
│                              │
│  Already have an account?    │
│  Sign in →                   │
└──────────────────────────────┘
```

Both forms:
- Use the existing `Input` and `PasswordInput` UI components
- Show inline field errors (client-side first, then server-side)
- Display a gold `LoadingSpinner` on submission
- Show a dismissible error banner for server-side failures
- Are fully keyboard-navigable and accessible

---

## 4. New UI Components

### 4.1 `Input.tsx` (UI primitive)

A labeled text input with:
- Label (above)
- Optional helper text (below)
- Error state (red border + error message)
- Character count display (for name field)
- Fully accessible (`id`, `aria-describedby`)

```typescript
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
  maxLength?: number;
}
```

**Visual:** Dark surface background (`#151B2E`), white text, gold focus ring, red border on error.

### 4.2 `FormSection.tsx` (UI primitive)

A visual divider for multi-step forms:
```typescript
interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}
```

Renders a heading, optional muted description, and a bordered container around the children.

### 4.3 `PasswordInput.tsx` (UI primitive)

A password text input with a show/hide toggle button:
- Renders as `type="password"` by default
- Eye icon button toggles to `type="text"` and back
- Inherits all `Input` props (label, error, helperText)
- `aria-label` on the toggle button ("Show password" / "Hide password")
- Never stores or logs the value

```typescript
interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  helperText?: string;
}
```

### 4.4 `LoadingSpinner.tsx` (UI primitive)

A small animated spinner for async states (auth loading, form submission):
- Sizes: `sm` | `md` | `lg`
- Color: gold (default) or white
- Accessible: `role="status"` + `aria-label`

### 4.5 `Badge.tsx` (UI primitive)

A small pill chip for counters and status:
```typescript
interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "gold" | "success" | "danger";
}
```

Used for the "Selected: X" counter on the country grid.

### 4.6 `EmojiPicker.tsx` (create room component)

A grid of 20 curated avatar emojis. Tapping one selects it with a gold highlight ring. Selected emoji displayed prominently next to the name input.

**Emoji set:**
```
🏆 ⚽ 🎯 🏃 🦁 🦅 🐉 🌟 🔥 💪
🎪 🏅 👑 ⚡ 🎭 🌈 🦊 🐺 🦋 🎸
```

**Behaviour:**
- One selected at any time (radio-group semantic)
- Default: first emoji (🏆)
- Selected state: `ring-gold` class + scale-110

### 4.7 `WinRuleToggle.tsx` (create room component)

Two option cards displayed side-by-side (mobile: stacked):

| Option | Label | Explanation |
|--------|-------|-------------|
| `last_standing` | "Last Team Standing" (default) | "The last player whose country is still alive wins. There is always a winner." |
| `strict` | "Must Win the Cup" | "Your player only wins if their country wins the entire tournament. If the champion has no owner, stakes are returned." |

**Visual:** Unselected card = dark surface. Selected card = gold left border + subtle gold background tint (`bg-gold/5`). Clicking toggles between them. Clear radio semantics (`role="radiogroup"`).

### 4.8 `CountryCard.tsx` (create room component)

Individual selectable country card:
- Shows: large flag emoji, country name
- Default: `bg-surface` card
- Selected: `ring-gold` (gold glow outline), checkmark overlay in gold
- Transition: 200ms
- Accessible: `role="checkbox"`, `aria-checked`, `aria-label`

```typescript
interface CountryCardProps {
  code: string;
  name: string;
  flagEmoji: string;
  selected: boolean;
  onToggle: (code: string) => void;
}
```

### 4.9 `CountryGrid.tsx` (create room component)

Manages the full country selection experience:
- Receives: list of all 36 countries from the server
- Maintains: `selected: Set<string>` (passed down from form orchestrator)
- Renders: responsive grid of `CountryCard`s
- Shows: `Badge` counter "Selected: X / 36"
- Shows: minimum requirement hint "Select at least 4 countries"
- Optional: search filter input to find countries quickly

**Grid layout:**
- Mobile (< 640px): 3 columns
- Tablet (640px–1024px): 4 columns
- Desktop (> 1024px): 6 columns

### 4.10 `StakeInput.tsx` (create room component)

Optional numeric input for the stake amount:
- Placeholder: "e.g. 10"
- Prefix: currency label (Birr, plain text, not enforced)
- Disclaimer below: "Display only — WinCup does not handle payments."
- Validates: positive number or empty (blank = no stake)

---

## 5. Create Room Page

### 5.1 Page Structure (`/room/create/page.tsx`)

A **React Server Component** that:
1. Reads the current session via `createSessionClient()`
2. If no session → immediately `redirect('/auth/sign-in?redirectTo=/room/create')`
3. Fetches all 36 countries (public read, fast)
4. Renders `<CreateRoomForm>` Client Component, passing countries + username as props

```typescript
// src/app/room/create/page.tsx  (Server Component)
import { redirect } from "next/navigation"
import { createSessionClient } from "@/lib/supabase/server"
import { CreateRoomForm } from "./_components/CreateRoomForm"

export default async function CreateRoomPage() {
  const supabase = await createSessionClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/sign-in?redirectTo=/room/create")

  // Fetch username from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single()

  // Fetch all countries (public read — no auth needed)
  const { data: countries } = await supabase
    .from("countries")
    .select("code, name, flag_emoji")
    .order("name")

  return (
    <main className="flex flex-1 flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <h1 className="mb-8 text-3xl font-bold text-white">Create a Room</h1>
        <CreateRoomForm
          countries={countries ?? []}
          defaultHostName={profile?.username ?? ""}
        />
      </div>
    </main>
  )
}
```

**Why redirect server-side:** The auth check happens before any HTML is sent to the browser. The user lands on the sign-in page immediately, with the correct `redirectTo` param — no flash of form content or client-side redirects.

**Why pre-fill hostName with username:** The username is the natural default display name for the host in their room. They can still change it before submitting.

### 5.2 Form Orchestrator (`CreateRoomForm.tsx`)

A **Client Component** that owns all create-room form state. No auth logic needed here — auth is enforced server-side before this component renders.

```typescript
"use client"

// Props received from page.tsx:
// - countries: { code, name, flag_emoji }[]
// - defaultHostName: string  (pre-filled from username)

// State managed:
// - hostName: string  (initialised to defaultHostName)
// - avatarEmoji: string
// - winRule: WinRule
// - selectedCountries: Set<string>
// - stakeAmount: string
// - fieldErrors: Record<string, string>
// - formError: string | null
// - isSubmitting: boolean

// On submit:
// 1. Client-side validate (name non-empty, ≥4 countries)
// 2. Show inline errors if invalid
// 3. Build FormData
// 4. Call createRoom() Server Action
// 5. Next.js handles redirect() internally
// 6. On error thrown by action: display formError banner
```

**No loading skeleton needed:** The user is already authenticated when they reach this page. The form renders fully on first paint.

**Form sections in order:**
1. Host name input (pre-filled with username) + avatar emoji picker
2. Win rule toggle
3. Country selection grid (the biggest section)
4. Optional stake amount
5. Optional competition link (placeholder — "coming in Phase 4")
6. Submit button

### 5.3 Create Room Page Visual Layout (Mobile-first)

```
┌─────────────────────────────────┐
│  ← Back           Create a Room │
├─────────────────────────────────┤
│ ── 1. Your Info ──────────────  │
│  [Name input         ] [Avatar] │
│  🏆 ⚽ 🎯 ... (emoji grid)      │
├─────────────────────────────────┤
│ ── 2. Win Rule ───────────────  │
│  ┌──────────┐  ┌──────────────┐ │
│  │Last Team │  │ Must Win Cup │ │
│  │Standing ✓│  │              │ │
│  └──────────┘  └──────────────┘ │
├─────────────────────────────────┤
│ ── 3. Pick Countries ─────────  │
│  Selected: 6 / 36               │
│  [search filter...]             │
│  🇦🇷 🇧🇷 🇫🇷 🇪🇸 🇩🇪 🇵🇹    (grid)  │
│  🇳🇱 🇧🇪 🇨🇷 🇯🇵 🇰🇷 🇺🇸          │
│  ...                            │
├─────────────────────────────────┤
│ ── 4. Stake (Optional) ───────  │
│  Birr [_____] (display only)    │
├─────────────────────────────────┤
│ [Create Room]  ← disabled <4   │
└─────────────────────────────────┘
```

---

## 6. Server Actions

### 6.1 `src/actions/auth.ts`

Three exported Server Actions. All use `createSessionClient()` for the sign-up / sign-in calls (session must be written to cookies), and `createAdminClient()` only for the username lookup RPC (needs service role to call `SECURITY DEFINER` function).

---

**`signUp(formData: FormData)`**

```
Input:
  username   string  required
  email      string  required
  password   string  required

Steps:
1. Parse + server-side validate all three fields (Validation.username, .email, .password)
   └ On error → return { errors: { field: message } }

2. Check username uniqueness (session client, public read):
   supabase.from("profiles").select("id").eq("username", username).maybeSingle()
   └ Found → return { errors: { username: "Username already taken" } }

3. supabase.auth.signUp({ email, password })
   └ AuthError → return { errors: { form: "Could not create account. Try a different email." } }

4. Insert profile:
   admin.from("profiles").insert({ id: user.id, username })
   └ Conflict on username (race condition) → return { errors: { username: "Username already taken" } }

5a. Email confirmation enabled (Supabase setting):
    → return { success: true, message: "Check your email to confirm your account." }

5b. Email confirmation disabled:
    → redirect(redirectTo ?? "/room/create")
```

---

**`signIn(formData: FormData)`**

```
Input:
  identifier  string  username OR email
  password    string
  redirectTo  string  optional (from query param, validated against allowed paths)

Steps:
1. Validate: identifier non-empty, password non-empty

2. Resolve email:
   identifier.includes("@")
     → use as email directly
   else
     → admin.rpc("lookup_email_by_username", { p_username: identifier })
       null result → do NOT reveal "not found" — fall through to signInWithPassword
                     (it will fail and return the same generic error)

3. supabase.auth.signInWithPassword({ email: resolvedEmail, password })
   AuthError → return { error: "Invalid username/email or password" }

4. redirect(redirectTo ?? "/room/create")
   Validate redirectTo: must start with "/" and not contain "://" (prevents open redirect)
```

---

**`signOut()`**

```
Steps:
1. supabase.auth.signOut()
2. redirect("/")
```

### 6.2 `src/actions/room.ts` — `createRoom()`

This is the most critical Server Action in Phase 1. Full logic:

```
Input (FormData):
  hostName        string  required, 1–40 chars (trimmed)
  avatarEmoji     string  required, must be in allowed emoji set
  winRule         string  required, "strict" | "last_standing"
  countries       string[] required, ≥4 codes, all must exist in countries table
  stakeAmount     string  optional, positive number or empty

Steps:
1. Get user session → createSessionClient().auth.getUser()
   └ No session → throw "Not authenticated"

2. Server-side validation
   ├ hostName: non-empty, 1–40 chars after trim
   ├ avatarEmoji: in ALLOWED_AVATARS set
   ├ winRule: "strict" | "last_standing"
   ├ countries.length >= 4
   ├ stakeAmount: undefined or positive number
   └ country codes: all exist in DB (batch lookup)

3. Rate limit check (simple):
   └ Count rooms created by user.id in last 10 minutes
   └ If count >= 3 → throw "Too many rooms created recently"

4. Generate unique room code
   └ generateRoomCode() → "WC-XXXX"
   └ Check uniqueness in rooms table (up to 5 retries)
   └ If all fail → throw "Server error"

5. Generate host_secret (UUID) for optional hand-off guard

6. Insert room (via admin client — bypasses RLS for server-controlled fields)
   └ { code, host_user_id: user.id, host_name, status: 'lobby', win_rule, stake_amount, host_secret }
   └ On error → throw "Failed to create room"

7. Insert room_countries (batch insert via admin client)
   └ [{ room_id, country_code, qualified: null }, ...]
   └ On error → rollback room (delete) + throw "Failed to save countries"

8. Also insert the host as the first player in the room:
   └ { room_id, user_id: user.id, name: hostName, avatar_emoji: avatarEmoji, is_eliminated: false }
   └ On error → rollback (delete room, cascades room_countries)

9. redirect(`/room/${room.id}/lobby`)
   └ (Next.js throws internally — caller does not need to handle this)
```

**Why insert host as first player:** The lobby needs to show the host as a participant. Inserting them at creation time (with the same `user_id`) means the host joins their own room seamlessly, and the lobby RLS query (players in same room) will include them.

**Why admin client for the inserts:** The host owns the room they just created, but the RLS INSERT policy is absent for rooms (all writes go through Server Actions). Using the admin client here keeps the RLS policies clean — no need for a complex "allow insert on own behalf" rule.

### 6.3 `src/app/auth/callback/route.ts`

Handles the one-click confirmation link Supabase sends when email confirmation is enabled. Also handles any future OAuth flows.

```typescript
// GET /auth/callback?code=<code>&redirectTo=/room/create
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get("code")
  const redirectTo = searchParams.get("redirectTo") ?? "/room/create"

  // Validate redirectTo to prevent open-redirect
  const safeRedirect = redirectTo.startsWith("/") && !redirectTo.includes("://")
    ? redirectTo
    : "/room/create"

  if (code) {
    const supabase = await createSessionClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL("/?error=auth_failed", origin))
    }
  }

  return NextResponse.redirect(new URL(safeRedirect, origin))
}
```

---

## 7. Library Utilities

### 7.1 `src/lib/room-code.ts`

```typescript
// Charset excludes visually ambiguous characters: 0/O, 1/I/L
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  // 31 chars

export function generateRoomCode(): string {
  const bytes = new Uint32Array(4)
  crypto.getRandomValues(bytes)
  const suffix = Array.from(bytes)
    .map(b => CHARSET[b % CHARSET.length])
    .join("")
  return `WC-${suffix}`
}
```

**Properties:**
- 31^4 ≈ 923,000 unique codes — far more than needed for early adoption
- No 0/O/1/I/L confusion when reading aloud or typing
- `crypto.getRandomValues` — cryptographic randomness, not `Math.random()`

### 7.2 `src/lib/validation.ts`

All validators return `string` (error message) or `null` (valid). Used by both Server Actions and client-side form components for consistent rules in both places.

```typescript
export const Validation = {
  // ── Auth validators ────────────────────────────────────────────────────────

  username(value: string): string | null {
    const trimmed = value.trim()
    if (trimmed.length < 3)  return "Username must be at least 3 characters"
    if (trimmed.length > 30) return "Username must be 30 characters or fewer"
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed))
      return "Username may only contain letters, numbers, and underscores"
    return null
  },

  email(value: string): string | null {
    if (!value.trim()) return "Email is required"
    // RFC-5322 simplified check — full validation happens in Supabase
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
      return "Enter a valid email address"
    return null
  },

  password(value: string): string | null {
    if (value.length < 8) return "Password must be at least 8 characters"
    return null
  },

  // ── Room form validators ───────────────────────────────────────────────────

  hostName(value: string): string | null {
    const trimmed = value.trim()
    if (trimmed.length < 1) return "Display name is required"
    if (trimmed.length > 40) return "Display name must be 40 characters or fewer"
    return null
  },

  stakeAmount(value: string): string | null {
    if (!value || value.trim() === "") return null  // optional
    const n = Number(value)
    if (isNaN(n) || n < 0) return "Stake must be a positive number"
    return null
  },

  countrySelection(codes: string[]): string | null {
    if (codes.length < 4) return `Select at least 4 countries (currently ${codes.length})`
    if (codes.length > 36) return "Too many countries selected"
    return null
  },

  winRule(value: string): string | null {
    if (!["strict", "last_standing"].includes(value)) return "Invalid win rule"
    return null
  },
}
```

### 7.3 `src/app/api/competitions/route.ts` (Placeholder)

```typescript
// GET /api/competitions?q=world+cup
// Phase 4 will implement real football-data.org lookup
// For now: returns empty results if no API key, or a static list
export async function GET(request: NextRequest) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    return Response.json({ competitions: [], message: "Competition search requires FOOTBALL_DATA_API_KEY" })
  }
  // Phase 4: fetch from https://api.football-data.org/v4/competitions
  return Response.json({ competitions: [] })
}
```

---

## 8. Security Checklist for Phase 1

| # | Control | Location | How |
|---|---------|----------|-----|
| 1 | Passwords never stored in plain text | Supabase Auth | Supabase hashes passwords with bcrypt — app never sees or stores raw passwords |
| 2 | Username enumeration prevented | `signIn` action | Both "username not found" and "wrong password" return the same generic error |
| 3 | Open-redirect prevented | `/auth/callback` + `signIn` | `redirectTo` validated: must start with `/`, must not contain `://` |
| 4 | `lookup_email_by_username` restricted to service role | Migration 004 | `REVOKE EXECUTE FROM anon, authenticated` — only server-side admin client calls this |
| 5 | Email addresses not exposed in public tables | `profiles` table | Profiles stores only `id` and `username`; email lives only in `auth.users` |
| 6 | Host identity tied to `auth.uid()` | `createRoom` action | `host_user_id: user.id` — never a client-provided value |
| 7 | No direct client INSERT on `rooms` | RLS (Stage 1) | No INSERT policy; all writes via admin client in Server Action |
| 8 | `host_secret` never returned to client | Page + action | Column-level REVOKE (Stage 1); action returns room id only |
| 9 | All inputs validated server-side | Both Server Actions | Validation runs in the action before any DB call; client-side validation is UX only |
| 10 | Country codes validated against DB | `createRoom` action | Batch SELECT against `countries` table; unknown codes rejected |
| 11 | Rate limiting on room creation | `createRoom` action | Count rooms by user.id in last 10 min; reject if ≥ 3 |
| 12 | No secrets in client bundle | Server Actions | `"use server"` boundary; admin client only in server-only files |
| 13 | Stake amount is display-only | UI + DB | `stake_amount numeric`; no payment code anywhere in the app |
| 14 | Avatar emoji validated server-side | `createRoom` action | Must be in the `ALLOWED_AVATARS` constant defined on the server |

---

## 9. Testing Plan

### 9.1 Unit Tests

All run with: `npm test`

---

**`tests/unit/lib/room-code.test.ts`** — Room code generator

| Test | Assertion |
|------|-----------|
| Format is "WC-XXXX" | Matches `/^WC-[A-Z0-9]{4}$/` |
| No ambiguous characters (0, O, 1, I, L) | No match against `/[01ILO]/` |
| 1000 calls produce no exact duplicates | `new Set(codes).size === 1000` |
| Uses only charset characters | All suffix chars in `ABCDEFGHJKMNPQRSTUVWXYZ23456789` |

---

**`tests/unit/lib/validation.test.ts`** — Input validators

| Test | Assertion |
|------|-----------|
| Username < 3 chars → error | Returns minimum length message |
| Username > 30 chars → error | Returns max length message |
| Username with spaces → error | Returns character restriction message |
| Username "valid_User1" → null | No error |
| Empty email → error | Returns required message |
| "notanemail" → error | Returns format error |
| "user@example.com" → null | No error |
| Password < 8 chars → error | Returns minimum length message |
| Password "12345678" → null | No error |
| Empty display name → error | Returns required message |
| 41-char display name → error | Returns max-length error |
| 40-char display name → null | No error |
| Valid stake "10" → null | No error |
| Negative stake → error | Returns validation error |
| Non-numeric stake → error | Returns validation error |
| Empty stake → null | Optional, no error |
| < 4 countries → error | Returns minimum error |
| 4 countries → null | No error |
| Invalid win rule → error | Returns error |
| "strict" → null | No error |
| "last_standing" → null | No error |

---

**`tests/unit/components/ui/Input.test.tsx`** — Input component

| Test | Assertion |
|------|-----------|
| Renders label | Label text visible |
| Renders helper text when provided | Helper text visible |
| Error state shows red styling | Error message rendered; `aria-invalid="true"` |
| Character count shown when showCount=true | Count updates on change |
| Forwards ref correctly | `ref.current` is the input element |

---

**`tests/unit/components/ui/PasswordInput.test.tsx`** — Password input component

| Test | Assertion |
|------|-----------|
| Renders as type="password" by default | Input type is "password" |
| Toggle button shows password | Clicking eye icon changes type to "text" |
| Toggle button hides password again | Second click restores type to "password" |
| Toggle button has descriptive aria-label | "Show password" / "Hide password" |
| Error state inherited from Input | Error message rendered when error prop set |

---

**`tests/unit/components/room/create/CountryCard.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders flag emoji and name | Both visible |
| Unselected: no gold ring class | `ring-gold` absent |
| Selected: gold ring class present | `ring-gold` present |
| Calls onToggle with code on click | Mock called with country code |
| Accessible: `aria-checked` matches selected | `aria-checked="true"` when selected |

---

**`tests/unit/components/room/create/WinRuleToggle.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders both options | "Last Team Standing" and "Must Win the Cup" visible |
| Default = last_standing selected | last_standing card has selected styling |
| Clicking strict → onChange called with "strict" | Mock called with "strict" |
| Explanation text visible for each option | Description text rendered |
| Accessible: `role="radiogroup"` present | Correct ARIA role |

---

**`tests/unit/components/room/create/CreateRoomForm.test.tsx`**

This test mocks `createRoom` Server Action → resolves or rejects.
No auth mocking needed — the component only renders when already authenticated (auth is enforced server-side).

| Test | Assertion |
|------|-----------|
| Renders with defaultHostName pre-filled | Name input value equals defaultHostName prop |
| Submit button disabled with < 4 countries | Button has `disabled` attribute |
| Submit button enabled with ≥ 4 countries | Button does not have `disabled` |
| Submitting shows loading state | Spinner visible during submission |
| Server Action error displayed | Error banner appears on rejection |
| Name field: empty submit → inline error | Error shown without Server Action call |

---

**`tests/unit/components/room/create/EmojiPicker.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders 20 emoji options | 20 buttons present |
| Default first emoji selected | First emoji has selected styling |
| Clicking another emoji → onChange called | Mock called with new emoji |
| Only one emoji selected at a time | Only one has gold ring class |

---

### 9.2 E2E Tests (Playwright)

Two test files. Both require `.env.local` with valid Supabase credentials and email confirmation **disabled** in the Supabase dashboard (for CI convenience).

---

**`tests/e2e/auth.spec.ts`** — Sign-up and sign-in flows

| Scenario | Steps | Expected |
|----------|-------|----------|
| **Sign-up page renders** | Navigate to `/auth/sign-up` | Form with username, email, password fields visible |
| **Successful sign-up** | Fill valid username/email/password; submit | Redirected to `/room/create`; session cookie set |
| **Duplicate username** | Sign up with an already-taken username | Inline error "Username already taken" |
| **Duplicate email** | Sign up with an already-registered email | Inline error on the form |
| **Invalid email format** | Enter "notanemail"; submit | Inline validation error |
| **Short password** | Enter 7-char password; submit | Inline validation error |
| **Sign-in page renders** | Navigate to `/auth/sign-in` | Form with identifier + password fields |
| **Sign-in with email** | Use email + correct password | Redirected to `/room/create` |
| **Sign-in with username** | Use username + correct password | Redirected to `/room/create` |
| **Wrong password** | Enter wrong password | Generic error "Invalid username/email or password" |
| **Sign out** | Trigger sign-out | Redirected to `/`; session cleared |
| **Already signed-in redirect** | Visit `/auth/sign-in` while logged in | Redirected to `/room/create` |

---

**`tests/e2e/create-room.spec.ts`** — Create room form (requires signed-in user)

Each test signs in via `page.request` (API-level auth) in `beforeEach` to avoid UI login overhead.

| Scenario | Steps | Expected |
|----------|-------|----------|
| **Auth gate** | Visit `/room/create` without session | Redirected to `/auth/sign-in?redirectTo=/room/create` |
| **Page loads with form** | Navigate to `/room/create` (signed in) | All form sections visible; no loading skeleton |
| **Username pre-fills host name** | Check name field after load | Name field contains the signed-in user's username |
| **CTA disabled below minimum** | Select 0–3 countries | "Create Room" button disabled |
| **CTA enabled at minimum** | Select 4 countries | "Create Room" button enabled |
| **Name validation** | Clear name field; click CTA | Inline error shown; no server call |
| **Country toggle** | Click a country card twice | Selected then deselected; counter updates |
| **Win rule toggle** | Click "Must Win the Cup" | Visual selection changes from default |
| **Full happy path** | Fill form; select 4+ countries; submit | Redirected to `/room/<id>/lobby`; URL has room id |
| **Mobile layout** | Set viewport 375×812; load page | Form scrollable; no horizontal overflow |

---

### 9.3 Type Safety

```bash
npm run typecheck   # must report 0 errors after Phase 1
```

All new Server Actions, components, and lib files are fully typed. Key type requirements:
- `createRoom()` returns `never` (due to `redirect()`) or throws `Error`
- `CountryCard`, `WinRuleToggle`, `EmojiPicker` have complete prop types
- `Validation.*` functions return `string | null`

### 9.4 Build Verification

```bash
npm run build   # must exit 0
```

Expected routes after Phase 1:
```
Route (app)
┌ ○ /                         (Static)
├ ○ /_not-found               (Static)
├ ƒ /auth/sign-in             (Dynamic — session check)
├ ƒ /auth/sign-up             (Dynamic — session check)
├ ƒ /auth/callback            (Dynamic — code exchange)
├ ƒ /room/create              (Dynamic — auth guard + country fetch)
├ ƒ /api/competitions         (Dynamic)
└ ƒ /api/cron/ingest          (Dynamic)
```

---

## 10. Implementation Step Order

Steps are ordered to minimize rework — foundational pieces first.

| Step | Task | Files Created/Modified |
|------|------|----------------------|
| 1 | Profiles DB migration (table + function) | `supabase/migrations/20240102000000_profiles.sql` |
| 2 | Room code generator + validation utilities | `src/lib/room-code.ts`, `src/lib/validation.ts` |
| 3 | New UI primitives | `src/components/ui/Input.tsx`, `PasswordInput.tsx`, `FormSection.tsx`, `LoadingSpinner.tsx`, `Badge.tsx` |
| 4 | Auth Server Actions + callback route | `src/actions/auth.ts`, `src/app/auth/callback/route.ts` |
| 5 | Sign-up form + page | `src/app/auth/sign-up/_components/SignUpForm.tsx`, `src/app/auth/sign-up/page.tsx` |
| 6 | Sign-in form + page | `src/app/auth/sign-in/_components/SignInForm.tsx`, `src/app/auth/sign-in/page.tsx` |
| 7 | `EmojiPicker.tsx` | `src/app/room/create/_components/EmojiPicker.tsx` |
| 8 | `WinRuleToggle.tsx` | `src/app/room/create/_components/WinRuleToggle.tsx` |
| 9 | `CountryCard.tsx` + `CountryGrid.tsx` | `src/app/room/create/_components/CountryCard.tsx`, `CountryGrid.tsx` |
| 10 | `HostNameInput.tsx` + `StakeInput.tsx` | `src/app/room/create/_components/HostNameInput.tsx`, `StakeInput.tsx` |
| 11 | `createRoom` Server Action | `src/actions/room.ts` |
| 12 | `CreateRoomForm.tsx` orchestrator | `src/app/room/create/_components/CreateRoomForm.tsx` |
| 13 | Create Room page with auth guard | `src/app/room/create/page.tsx` |
| 14 | Competition search Route Handler (placeholder) | `src/app/api/competitions/route.ts` |
| 15 | Unit tests (all 8 suites) | `tests/unit/lib/`, `tests/unit/components/` |
| 16 | E2E test suites (auth + create room) | `tests/e2e/auth.spec.ts`, `tests/e2e/create-room.spec.ts` |
| 17 | Typecheck + build verification | `npm run typecheck && npm run build` |

---

## 11. Phase 1 Definition of Done

| Check | Criterion |
|-------|-----------|
| `npm run typecheck` | Zero TypeScript errors |
| `npm run build` | Exit 0; 8 routes listed (see §9.4) |
| `npm test` | All unit tests pass (22 existing + new Phase 1 tests) |
| Profiles migration | `profiles` table + `lookup_email_by_username()` function created successfully |
| Sign-up | Valid username + email + password creates Supabase Auth user + profiles row |
| Sign-up duplicate username | Returns "Username already taken" error; no new user created |
| Sign-in with email | Correct email + password establishes session; redirects to `/room/create` |
| Sign-in with username | Correct username + password resolves to email; session established |
| Wrong credentials | Generic "Invalid username/email or password" — no enumeration hint |
| Auth guard on create room | Unauthenticated visit to `/room/create` redirects to `/auth/sign-in?redirectTo=/room/create` |
| Username pre-fills host name | Create Room form opens with name field pre-filled from user's username |
| Form validation | Name, country count, win rule validated client-side + server-side |
| Room creation | Valid submission creates room + room_countries + host player row in DB |
| Room code | Generated in "WC-XXXX" format; unique in rooms table |
| Navigation | Successful submit redirects to `/room/<id>/lobby` |
| `host_secret` | Never returned to client; protected by column-level REVOKE |
| `host_user_id` | Set from `auth.uid()` — never a client-provided value |
| Rate limiting | User blocked after 3 room creations in 10 minutes |
| Mobile UX | Sign-up, sign-in, and create room forms are fully usable on 375px viewport |

---

## 12. What Phase 2 Builds Next

Phase 1 ends with a room created and the host redirected to `/room/<id>/lobby`. Phase 2 picks up immediately:
- The **Lobby page** (`/room/[id]/lobby`) — displays room code, joined players, country chips
- The **Join Room flow** — code entry form + player name/avatar + Server Action that validates capacity + status
- **Supabase Realtime** — players joining appear instantly for everyone in the lobby
- The host's "Start Draw" button (enabled when `player count == country count`)
