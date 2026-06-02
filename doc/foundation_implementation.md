# WinCup — Stage 1: Foundation Implementation Plan

> **Scope:** Master Prompt deliverables only — project scaffold, Supabase setup, database schema + RLS + seed, landing page, environment config, and vercel.json. No feature screens yet.

---

## 1. Deliverable Summary

| # | Deliverable | Description |
|---|-------------|-------------|
| 1 | Next.js scaffold | App Router + TypeScript + Tailwind CSS, Vercel-ready |
| 2 | Supabase clients | Browser client (anon key) + server client (service role) |
| 3 | Auth setup | Anonymous sign-in + magic-link, session middleware |
| 4 | Database migrations | Schema, RLS policies, country seed data (3 SQL files) |
| 5 | Env config | `.env.example`, validated env module |
| 6 | Infrastructure config | `vercel.json` (cron entry), `README.md` |
| 7 | Landing page | Dark hero, How It Works, footer with disclaimer |
| 8 | No-op cron route | `GET /api/cron/ingest` — validates secret, returns 200 |
| 9 | Test suite scaffold | Unit (Jest + RTL) + E2E (Playwright) + DB schema assertions |

---

## 2. Project Folder Structure

```
wincup/
├── .env.example                  # Documented env vars — committed to git
├── .env.local                    # Actual secrets — gitignored, never committed
├── .gitignore
├── vercel.json                   # Cron entry (*/15 * * * *)
├── next.config.ts
├── tailwind.config.ts            # Design tokens (colors, fonts, animations)
├── tsconfig.json
├── package.json
├── README.md                     # Setup + deploy steps
│
├── doc/
│   └── foundation_implementation.md   # This file
│
├── supabase/
│   ├── config.toml               # Local dev config (supabase CLI)
│   └── migrations/
│       ├── 20240101000000_create_tables.sql
│       ├── 20240101000001_rls_policies.sql
│       └── 20240101000002_seed_countries.sql
│
├── src/
│   ├── middleware.ts             # Next.js middleware — refreshes Supabase auth session
│   │
│   ├── app/
│   │   ├── layout.tsx            # Root layout: font import, dark bg, metadata
│   │   ├── page.tsx              # Landing page (React Server Component)
│   │   ├── globals.css           # Tailwind directives + CSS custom properties
│   │   ├── error.tsx             # Global error boundary
│   │   ├── not-found.tsx         # 404 page, on-brand dark theme
│   │   └── api/
│   │       └── cron/
│   │           └── ingest/
│   │               └── route.ts  # No-op cron handler (CRON_SECRET validation only)
│   │
│   ├── components/
│   │   ├── ui/                   # Shared design system primitives (no business logic)
│   │   │   ├── Button.tsx        # Variant: primary (gold) | outline | ghost
│   │   │   └── Card.tsx          # Surface card with hover lift
│   │   └── landing/              # Landing page sections — co-located, RSC-safe
│   │       ├── Hero.tsx
│   │       ├── HowItWorks.tsx
│   │       └── Footer.tsx
│   │
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts         # Browser client — anon key, singleton
│       │   ├── server.ts         # Server client — two factories (session | service role)
│       │   └── middleware.ts     # updateSession helper used by middleware.ts
│       ├── types/
│       │   └── database.ts       # Hand-written DB types matching the schema
│       └── env.ts                # Validated env var access — throws fast on misconfiguration
│
└── tests/
    ├── unit/
    │   ├── lib/
    │   │   └── env.test.ts       # Env module: missing vars throw, server vars blocked client-side
    │   └── components/
    │       └── landing/
    │           ├── Hero.test.tsx
    │           ├── HowItWorks.test.tsx
    │           └── Footer.test.tsx
    ├── integration/
    │   └── db/
    │       └── schema_assertions.sql  # SQL assertions run against local Supabase
    └── e2e/
        └── landing.spec.ts            # Playwright: full landing page flow
```

---

## 3. Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | `^15.1.0` | Framework (App Router) |
| `react` / `react-dom` | `^19.0.0` | UI runtime |
| `@supabase/supabase-js` | `^2.45.0` | Supabase client |
| `@supabase/ssr` | `^0.5.0` | SSR-safe Supabase clients for Next.js |
| `server-only` | `^0.0.1` | Compile-time guard: prevents server modules from being bundled for the client |

### Development / Testing

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | `^5.6.0` | Type checking |
| `tailwindcss` | `^3.4.0` | Styling |
| `postcss` / `autoprefixer` | `^8` / `^10` | CSS build |
| `jest` | `^29.7.0` | Unit test runner |
| `jest-environment-jsdom` | `^29.7.0` | Browser-like test environment |
| `ts-jest` | `^29.2.0` | TypeScript support in Jest |
| `@testing-library/react` | `^16.0.0` | Component testing |
| `@testing-library/jest-dom` | `^6.4.0` | DOM matchers |
| `@playwright/test` | `^1.47.0` | E2E browser testing |
| `eslint` / `eslint-config-next` | bundled | Linting |

**Package manager:** `pnpm` (recommended — faster installs, strict dependency isolation). npm/yarn are viable alternatives.

---

## 4. Environment Variables

### `.env.example` content

```bash
# ─── Supabase ─────────────────────────────────────────────────────────────────
# Public — safe to expose to the browser
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Server-only — NEVER prefix with NEXT_PUBLIC_, never log, never return to client
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ─── football-data.org ────────────────────────────────────────────────────────
# Server-only API key. Free tier: ~10 requests/minute.
FOOTBALL_DATA_API_KEY=your-api-key-here

# ─── Cron ─────────────────────────────────────────────────────────────────────
# Random secret ≥32 chars. Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
# Generate: openssl rand -hex 32
CRON_SECRET=your-random-secret-min-32-chars
```

### `src/lib/env.ts` — validated access

```typescript
import 'server-only';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

// Called lazily per-request (not at module load) to allow test mocking
export function getServerEnv() {
  return {
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    footballDataApiKey:     requireEnv('FOOTBALL_DATA_API_KEY'),
    cronSecret:             requireEnv('CRON_SECRET'),
  };
}

// These are safe to import anywhere — Next.js validates NEXT_PUBLIC_ at build time
export const publicEnv = {
  supabaseUrl:     process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
};
```

> **Why `server-only`:** The `server-only` package causes a build error if this module is ever imported into a Client Component or the browser bundle. This makes the safety guarantee compile-time, not just runtime.

---

## 5. Supabase Client Architecture

Two distinct client factories — never mix them up.

### `src/lib/supabase/client.ts` — Browser (singleton)

```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `src/lib/supabase/server.ts` — Server (two modes)

```typescript
import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServerEnv } from '@/lib/env';
import type { Database } from '@/lib/types/database';

// For user-context reads/writes — uses the caller's session
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* cookie adapter */ } }
  );
}

// For privileged operations (cron, Server Actions requiring host enforcement)
// — bypasses RLS via service role key
export function createAdminClient() {
  const { supabaseServiceRoleKey } = getServerEnv();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseServiceRoleKey,
    { cookies: { getAll: () => [], setAll: () => {} }, auth: { persistSession: false } }
  );
}
```

> **Critical:** `createAdminClient` must never be called from a Client Component or any code reachable from the browser bundle. The `server-only` import in `env.ts` (which `server.ts` imports) enforces this at build time.

### `src/middleware.ts` — Session refresh

```typescript
import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Supabase requires the middleware to refresh the auth token on every request; without it, server components receive stale sessions.

---

## 6. Database Schema (Migration 001)

File: `supabase/migrations/20240101000000_create_tables.sql`

```sql
-- ─── Countries (shared reference, seeded once) ───────────────────────────────
CREATE TABLE countries (
  code             text PRIMARY KEY,
  name             text NOT NULL,
  flag_emoji       text NOT NULL,
  external_team_id integer          -- football-data.org team id, nullable; set via admin sync
);

-- ─── Rooms ───────────────────────────────────────────────────────────────────
CREATE TABLE rooms (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    text UNIQUE NOT NULL,
  host_user_id            uuid NOT NULL,
  host_name               text NOT NULL,
  host_secret             text,           -- optional secondary guard for host hand-off
  status                  text NOT NULL DEFAULT 'lobby'
                            CHECK (status IN ('lobby','drawn','group_stage','knockout','finished')),
  win_rule                text NOT NULL DEFAULT 'last_standing'
                            CHECK (win_rule IN ('strict','last_standing')),
  stake_amount            numeric,        -- display only, no payment processing
  external_competition_id integer,        -- football-data.org competition id, nullable
  external_season_id      integer,        -- football-data.org season id, nullable
  winner_player_id        uuid,           -- null until resolved
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Prevent host_secret from being readable by non-service-role connections
-- Column-level privilege: rls policies still apply; this adds a second layer
REVOKE SELECT (host_secret) ON rooms FROM authenticated, anon;
GRANT  SELECT (host_secret) ON rooms TO service_role;

-- ─── Players ─────────────────────────────────────────────────────────────────
CREATE TABLE players (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id          uuid,                  -- auth.uid() of the player's Supabase session
  name             text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 40),
  avatar_emoji     text,
  assigned_country text REFERENCES countries(code),  -- set at draw time; null before draw
  is_eliminated    boolean NOT NULL DEFAULT false,
  joined_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── Room Countries (host-selected group-stage pool) ─────────────────────────
CREATE TABLE room_countries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  country_code text NOT NULL REFERENCES countries(code),
  qualified    boolean,                   -- null=undecided, true=qualified, false=eliminated
  UNIQUE (room_id, country_code)
);

-- ─── Room Teams (knockout bracket slots) ─────────────────────────────────────
CREATE TABLE room_teams (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  country_code     text NOT NULL REFERENCES countries(code),
  player_id        uuid REFERENCES players(id),   -- NULL = filler (no player)
  bracket_position int NOT NULL,                  -- 1..16 for R16
  current_stage    text NOT NULL DEFAULT 'r16'
                     CHECK (current_stage IN ('r16','qf','sf','final','champion','out')),
  is_eliminated    boolean NOT NULL DEFAULT false
);

-- ─── Matches ─────────────────────────────────────────────────────────────────
CREATE TABLE matches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  external_match_id integer,                       -- football-data.org match id (idempotent key)
  stage             text NOT NULL CHECK (stage IN ('r16','qf','sf','final')),
  team_a_code       text REFERENCES countries(code),
  team_b_code       text REFERENCES countries(code),
  winner_code       text REFERENCES countries(code),  -- null until decided
  bracket_position  int,                              -- slot the winner advances into
  match_order       int,                              -- ordering within a stage
  UNIQUE (room_id, external_match_id)
);

-- ─── Indices ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_rooms_code                ON rooms(code);
CREATE INDEX idx_players_room_id           ON players(room_id);
CREATE INDEX idx_players_user_id           ON players(user_id);
CREATE INDEX idx_room_countries_room_id    ON room_countries(room_id);
CREATE INDEX idx_room_teams_room_id        ON room_teams(room_id);
CREATE INDEX idx_matches_room_id_stage     ON matches(room_id, stage);
CREATE INDEX idx_matches_external_match_id ON matches(external_match_id);
```

---

## 7. RLS Policies (Migration 002)

File: `supabase/migrations/20240101000001_rls_policies.sql`

**Design principles:**
- Enable RLS on every table from day one.
- Privileged writes (draw, lock room, ingest) use the admin client (service role bypasses RLS); the service role enforces its own checks in Server Actions.
- Direct client INSERT into game-controlling tables is blocked at the policy level — it must go through a Server Action.
- `host_secret` is protected by column-level privilege (Migration 001) + never returned from Server Actions to non-host callers.

```sql
-- ─── Enable RLS everywhere ────────────────────────────────────────────────────
ALTER TABLE countries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE players      ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches      ENABLE ROW LEVEL SECURITY;

-- ─── countries ───────────────────────────────────────────────────────────────
-- Public read (any client, including unauthenticated)
CREATE POLICY "countries_public_read" ON countries
  FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE for regular users; only service_role writes here

-- ─── rooms ───────────────────────────────────────────────────────────────────
-- Any authenticated user can read a room (needed to join by code)
-- host_secret is protected separately by column-level privilege (see migration 001)
CREATE POLICY "rooms_authenticated_read" ON rooms
  FOR SELECT TO authenticated USING (true);

-- Only the host can update their own room
CREATE POLICY "rooms_host_update" ON rooms
  FOR UPDATE TO authenticated USING (auth.uid() = host_user_id);

-- Room creation goes through a Server Action (admin client) — no direct INSERT policy

-- ─── players ─────────────────────────────────────────────────────────────────
-- A player can read other players in rooms they belong to
CREATE POLICY "players_read_room_members" ON players
  FOR SELECT TO authenticated USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

-- A player may update their own row only (avatar, name — not elimination status)
CREATE POLICY "players_update_own" ON players
  FOR UPDATE TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No direct INSERT policy — joining goes through the Server Action (admin client)
-- which enforces: lobby status, capacity check, and auth.uid() binding

-- ─── room_countries ──────────────────────────────────────────────────────────
-- Room members can read
CREATE POLICY "room_countries_read_members" ON room_countries
  FOR SELECT TO authenticated USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );
-- All writes (host override, cron ingest) use the admin client

-- ─── room_teams ──────────────────────────────────────────────────────────────
CREATE POLICY "room_teams_read_members" ON room_teams
  FOR SELECT TO authenticated USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );
-- All writes use admin client

-- ─── matches ─────────────────────────────────────────────────────────────────
CREATE POLICY "matches_read_members" ON matches
  FOR SELECT TO authenticated USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );
-- All writes use admin client
```

> **Why no direct INSERT policies on most tables:** Every game-controlling operation (create room, join room, start draw, mark qualifier, advance bracket) goes through a Server Action that uses the admin client. This guarantees server-side validation (capacity, status checks, idempotency) before any write happens. Direct client writes would bypass these invariants.

---

## 8. Seed Data (Migration 003)

File: `supabase/migrations/20240101000002_seed_countries.sql`

```sql
INSERT INTO countries (code, name, flag_emoji) VALUES
  ('ARG','Argentina','🇦🇷'), ('BRA','Brazil','🇧🇷'),
  ('FRA','France','🇫🇷'), ('ENG','England','🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
  ('GER','Germany','🇩🇪'), ('ESP','Spain','🇪🇸'),
  ('POR','Portugal','🇵🇹'), ('NED','Netherlands','🇳🇱'),
  ('BEL','Belgium','🇧🇪'), ('CRO','Croatia','🇭🇷'),
  ('MAR','Morocco','🇲🇦'), ('JPN','Japan','🇯🇵'),
  ('KOR','South Korea','🇰🇷'), ('USA','USA','🇺🇸'),
  ('MEX','Mexico','🇲🇽'), ('URU','Uruguay','🇺🇾'),
  ('SEN','Senegal','🇸🇳'), ('SUI','Switzerland','🇨🇭'),
  ('DEN','Denmark','🇩🇰'), ('POL','Poland','🇵🇱'),
  ('SRB','Serbia','🇷🇸'), ('GHA','Ghana','🇬🇭'),
  ('CMR','Cameroon','🇨🇲'), ('ECU','Ecuador','🇪🇨'),
  ('CAN','Canada','🇨🇦'), ('AUS','Australia','🇦🇺'),
  ('IRN','Iran','🇮🇷'), ('TUN','Tunisia','🇹🇳'),
  ('KSA','Saudi Arabia','🇸🇦'), ('CRC','Costa Rica','🇨🇷'),
  ('NGA','Nigeria','🇳🇬'), ('EGY','Egypt','🇪🇬'),
  ('COL','Colombia','🇨🇴'), ('CHI','Chile','🇨🇱'),
  ('ITA','Italy','🇮🇹'), ('PER','Peru','🇵🇪')
ON CONFLICT (code) DO NOTHING;  -- idempotent: safe to re-run
```

> **Note:** `external_team_id` is populated separately via a one-time admin sync script once the football-data.org competition is chosen. This is intentionally deferred — it requires a real API key and a specific competition ID.

---

## 9. Tailwind Design System

`tailwind.config.ts` design tokens derived from the spec:

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0A0E1A',
        surface:    '#151B2E',
        gold:       '#FFD700',
        success:    '#10B981',
        danger:     '#EF4444',
        muted:      '#94A3B8',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontVariantNumeric: { tabular: 'tabular-nums' },
      transitionDuration: {
        DEFAULT: '200ms',
        slow:    '300ms',
      },
      boxShadow: {
        'lift': '0 8px 32px 0 rgba(0,0,0,0.45)',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'fade-in':  'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
    },
  },
} satisfies Config;
```

---

## 10. Landing Page Specification

### Layout (`src/app/layout.tsx`)
- Import Plus Jakarta Sans from Google Fonts (or self-host via `next/font`)
- Set `<html>` background to `#0A0E1A`, text-white, antialiased
- Include global `<meta>` tags (title, description, OG)

### Hero (`src/components/landing/Hero.tsx`)
- Full viewport height, centered flex column
- `🏆 WinCup` wordmark in gold, large (responsive: `text-5xl md:text-7xl`)
- Tagline: `"Pick a country. Follow the cup. One winner takes it all."`
- Two buttons stacked on mobile, side-by-side on desktop:
  - **Create Room** — `bg-gold text-black font-bold` (primary, links to `/room/create`)
  - **Join Room** — `border-2 border-gold text-gold` (outline, links to `/room/join`)
- Subtle radial gradient glow behind the trophy

### HowItWorks (`src/components/landing/HowItWorks.tsx`)
- Section heading: `"How it works"`
- Three step cards, horizontal on desktop / stacked on mobile:
  1. `🎯 Pick Countries` — "The host selects countries and invites friends"
  2. `🎲 The Draw` — "One random country per player, revealed with drama"
  3. `🏟️ Follow the Cup` — "Watch your country climb. Last one standing wins"
- Cards use `bg-surface` with hover lift

### Footer (`src/components/landing/Footer.tsx`)
- Centered disclaimer in muted text:
  > "WinCup is for entertainment only. It does not handle, hold, or process any payments."
- Optional 18+ note: "18+ only. Check local regulations before wagering."
- Copyright line

---

## 11. No-op Cron Route

`src/app/api/cron/ingest/route.ts`:

```typescript
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Placeholder — full implementation in Phase 4
  console.log('[cron/ingest] triggered, no-op');
  return Response.json({ ok: true, processed: 0 });
}

// Prevent static analysis from caching this route
export const dynamic = 'force-dynamic';
```

**Why validate now:** The secret check is the hardest invariant to test retroactively. Building it from day one means every Phase 4 integration test starts with a working security gate.

---

## 12. `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/ingest",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

> Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` (configured in Vercel project env vars). The cron fires every 15 minutes; football-data.org free tier allows ~10 req/min which is sufficient for small player counts.

---

## 13. Database Types (`src/lib/types/database.ts`)

Hand-written types matching the schema. Once Supabase CLI is configured, these can be auto-generated with `supabase gen types typescript`. For Stage 1, a hand-written file bootstraps type safety immediately.

```typescript
export type RoomStatus = 'lobby' | 'drawn' | 'group_stage' | 'knockout' | 'finished';
export type WinRule = 'strict' | 'last_standing';
export type KnockoutStage = 'r16' | 'qf' | 'sf' | 'final' | 'champion' | 'out';
export type MatchStage = 'r16' | 'qf' | 'sf' | 'final';

export interface Country {
  code: string;
  name: string;
  flag_emoji: string;
  external_team_id: number | null;
}

export interface Room {
  id: string;
  code: string;
  host_user_id: string;
  host_name: string;
  host_secret?: string;       // only returned to service role
  status: RoomStatus;
  win_rule: WinRule;
  stake_amount: number | null;
  external_competition_id: number | null;
  external_season_id: number | null;
  winner_player_id: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  user_id: string | null;
  name: string;
  avatar_emoji: string | null;
  assigned_country: string | null;
  is_eliminated: boolean;
  joined_at: string;
}

export interface RoomCountry {
  id: string;
  room_id: string;
  country_code: string;
  qualified: boolean | null;
}

export interface RoomTeam {
  id: string;
  room_id: string;
  country_code: string;
  player_id: string | null;
  bracket_position: number;
  current_stage: KnockoutStage;
  is_eliminated: boolean;
}

export interface Match {
  id: string;
  room_id: string;
  external_match_id: number | null;
  stage: MatchStage;
  team_a_code: string | null;
  team_b_code: string | null;
  winner_code: string | null;
  bracket_position: number | null;
  match_order: number | null;
}

export interface Database {
  public: {
    Tables: {
      countries:     { Row: Country; Insert: Omit<Country,'external_team_id'> & { external_team_id?: number|null }; Update: Partial<Country> };
      rooms:         { Row: Room;    Insert: Omit<Room,'id'|'created_at'|'winner_player_id'|'host_secret'>; Update: Partial<Room> };
      players:       { Row: Player;  Insert: Omit<Player,'id'|'joined_at'>; Update: Partial<Player> };
      room_countries:{ Row: RoomCountry; Insert: Omit<RoomCountry,'id'>; Update: Partial<RoomCountry> };
      room_teams:    { Row: RoomTeam;    Insert: Omit<RoomTeam,'id'>; Update: Partial<RoomTeam> };
      matches:       { Row: Match;       Insert: Omit<Match,'id'>; Update: Partial<Match> };
    };
  };
}
```

---

## 14. Testing Plan

### 14.1 Unit Tests — `tests/unit/`

**Run command:** `pnpm test`

#### `env.test.ts` — Environment module
| Test | Assertion |
|------|-----------|
| Missing `SUPABASE_SERVICE_ROLE_KEY` | `getServerEnv()` throws with clear message |
| Missing `FOOTBALL_DATA_API_KEY` | `getServerEnv()` throws with clear message |
| Missing `CRON_SECRET` | `getServerEnv()` throws with clear message |
| All vars present | `getServerEnv()` returns object without throwing |

#### `Hero.test.tsx` — Landing Hero
| Test | Assertion |
|------|-----------|
| Renders tagline | "Pick a country. Follow the cup." text present |
| Renders Create Room button | `<a href="/room/create">` or button with text present |
| Renders Join Room button | `<a href="/room/join">` or button with text present |
| No broken links | All hrefs defined (not `#` or `undefined`) |

#### `HowItWorks.test.tsx`
| Test | Assertion |
|------|-----------|
| Renders 3 steps | 3 step elements present |
| Step texts present | "Pick Countries", "Draw", "Follow the Cup" content |

#### `Footer.test.tsx`
| Test | Assertion |
|------|-----------|
| Disclaimer present | "entertainment only" text in document |
| Disclaimer visible | Not hidden or `aria-hidden` |
| No payment language | Does not mention "bet", "wager", "pay" as actionable claims |

### 14.2 Schema Assertions — `tests/integration/db/`

**Run against local Supabase:** `supabase db reset && psql -f tests/integration/db/schema_assertions.sql`

```sql
-- Verify all 6 tables exist
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN ('countries','rooms','players','room_countries','room_teams','matches')) = 6,
  'Not all 6 tables were created';
END $$;

-- Verify RLS enabled on all tables
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM pg_tables
          WHERE schemaname = 'public' AND rowsecurity = true
          AND tablename IN ('countries','rooms','players','room_countries','room_teams','matches')) = 6,
  'RLS not enabled on all tables';
END $$;

-- Verify room code UNIQUE constraint
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM information_schema.table_constraints
          WHERE constraint_type = 'UNIQUE' AND table_name = 'rooms' AND constraint_name LIKE '%code%') >= 1,
  'rooms.code UNIQUE constraint missing';
END $$;

-- Verify external_match_id UNIQUE per room in matches
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM information_schema.table_constraints
          WHERE constraint_type = 'UNIQUE' AND table_name = 'matches'
          AND constraint_name LIKE '%external_match_id%') >= 1,
  'matches UNIQUE(room_id, external_match_id) missing';
END $$;

-- Verify 36 countries seeded
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM countries) = 36,
  format('Expected 36 countries, got %s', (SELECT count(*) FROM countries)::text);
END $$;

-- Verify host_secret is NOT accessible to authenticated role
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM information_schema.role_column_grants
          WHERE table_name = 'rooms' AND column_name = 'host_secret'
          AND grantee IN ('authenticated','anon') AND privilege_type = 'SELECT') = 0,
  'host_secret is readable by authenticated/anon role — security violation';
END $$;

SELECT 'All schema assertions passed ✓' AS result;
```

### 14.3 E2E Tests — Playwright — `tests/e2e/`

**Run command:** `pnpm test:e2e`

`landing.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/WinCup/);
  });

  test('dark background applied', async ({ page }) => {
    const bg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );
    // #0A0E1A = rgb(10, 14, 26)
    expect(bg).toBe('rgb(10, 14, 26)');
  });

  test('hero heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /WinCup/i })).toBeVisible();
  });

  test('tagline visible', async ({ page }) => {
    await expect(page.getByText(/Pick a country/i)).toBeVisible();
  });

  test('Create Room button present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Create Room/i })).toBeVisible();
  });

  test('Join Room button present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Join Room/i })).toBeVisible();
  });

  test('How it works has 3 steps', async ({ page }) => {
    const steps = page.locator('[data-testid="how-step"]');
    await expect(steps).toHaveCount(3);
  });

  test('entertainment disclaimer visible', async ({ page }) => {
    await expect(page.getByText(/entertainment only/i)).toBeVisible();
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    expect(errors).toHaveLength(0);
  });
});
```

### 14.4 Type Safety Check

```bash
pnpm typecheck   # alias for: tsc --noEmit
```

Zero TypeScript errors required before considering Stage 1 complete.

### 14.5 Build Verification

```bash
pnpm build       # Next.js production build — must complete with zero errors/warnings
```

---

## 15. Security Checklist

| # | Control | Where Enforced |
|---|---------|----------------|
| 1 | `.env.local` in `.gitignore` | `.gitignore` |
| 2 | No `NEXT_PUBLIC_` prefix on secret vars | `.env.example` naming convention |
| 3 | `server-only` guard on `env.ts` and `server.ts` | Import statements |
| 4 | `host_secret` blocked via column-level privilege | Migration 001 `REVOKE` statement |
| 5 | `host_secret` stripped from all Server Action responses | Application layer |
| 6 | Cron route rejects requests without `Authorization: Bearer <CRON_SECRET>` | `route.ts` first check |
| 7 | RLS enabled on all 6 tables from migration 001 | Migration 002 |
| 8 | No direct client INSERT allowed on game-controlling tables | Absence of INSERT policies |
| 9 | Admin client never instantiated in browser context | `server-only` build guard |
| 10 | Player name length validated at DB level (`CHECK` constraint) | Migration 001 |
| 11 | Room status transitions only via Server Actions | Architecture (no client writes) |
| 12 | Service role key never returned to client | `server-only` + Server Action response shaping |

---

## 16. Implementation Step Order

Steps are ordered to minimize rework — each step builds on a stable foundation.

| Step | Task | Est. Time |
|------|------|-----------|
| 1 | Scaffold Next.js project (`create-next-app`) + install deps | 20 min |
| 2 | Configure Tailwind design tokens + `globals.css` | 15 min |
| 3 | Write `.env.example` + `vercel.json` + `next.config.ts` | 10 min |
| 4 | Write `src/lib/env.ts` — validated env accessor | 10 min |
| 5 | Write Supabase browser client (`client.ts`) | 10 min |
| 6 | Write Supabase server clients (`server.ts`) + middleware | 20 min |
| 7 | Write `src/lib/types/database.ts` — hand-written DB types | 20 min |
| 8 | Write Migration 001 — schema (tables + indices + column privileges) | 30 min |
| 9 | Write Migration 002 — RLS policies | 20 min |
| 10 | Write Migration 003 — seed data | 5 min |
| 11 | Write no-op cron route + CRON_SECRET validation | 10 min |
| 12 | Write root layout + `globals.css` | 15 min |
| 13 | Build `Hero`, `HowItWorks`, `Footer` components | 40 min |
| 14 | Wire landing page (`src/app/page.tsx`) | 10 min |
| 15 | Write unit tests (env, components) | 25 min |
| 16 | Write schema assertion SQL | 15 min |
| 17 | Write Playwright E2E tests | 20 min |
| 18 | Configure Jest + Playwright (`jest.config.ts`, `playwright.config.ts`) | 15 min |
| 19 | Write `README.md` (setup + deploy steps) | 15 min |
| 20 | Run full verification: `pnpm typecheck && pnpm build && pnpm test` | 15 min |
| **Total** | | **~5.5 hrs** |

---

## 17. Stage 1 Completion Criteria (Definition of Done)

All of the following must pass before requesting Phase 1:

- [ ] `pnpm install` completes without errors
- [ ] `pnpm dev` starts the dev server and landing page renders at `http://localhost:3000`
- [ ] Landing page visually matches the design spec (dark bg, gold accents, trophy, tagline, 2 buttons, 3 steps, disclaimer)
- [ ] `pnpm typecheck` — zero TypeScript errors
- [ ] `pnpm build` — Next.js production build completes with no errors or warnings
- [ ] `pnpm test` — all unit tests pass
- [ ] `pnpm test:e2e` — all Playwright tests pass
- [ ] Supabase migrations applied locally (`supabase db reset`) without errors
- [ ] Schema assertion SQL reports "All schema assertions passed ✓"
- [ ] 36 countries present in `countries` table
- [ ] RLS enabled on all 6 tables (verified by schema assertions)
- [ ] `host_secret` inaccessible to `authenticated`/`anon` roles (verified by schema assertions)
- [ ] Cron route returns `401` without correct `Authorization` header
- [ ] Cron route returns `200 { ok: true }` with correct `Authorization` header
- [ ] `.env.example` documents all 5 env vars accurately
- [ ] `README.md` covers: Supabase project setup, Vercel env vars, local dev, deploy steps

---

## 18. What Stage 1 Does NOT Include

The following are intentionally deferred to their respective Build Phases:

| Deferred Item | Phase |
|---------------|-------|
| Auth UI (sign-in page, magic-link flow) | Phase 1 |
| Create Room page | Phase 1 |
| Join Room flow + Lobby | Phase 2 |
| The Draw (Fisher-Yates + animation) | Phase 3 |
| Group Stage grid + cron ingestion | Phase 4 |
| Knockout bracket (Ladder) | Phase 5 |
| Winner screen + auto-resolution | Phase 6 |
| `external_team_id` admin sync script | Phase 4 setup |
| Supabase Realtime subscriptions | Phase 2 |
| Rate limiting middleware | Phase 1+ |

---

*Prepared for WinCup Stage 1 — Master Prompt implementation.*
*Next: await user evaluation → implement → proceed to Phase 1 planning.*
