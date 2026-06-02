# WinCup 🏆

> Pick a country. Follow the cup. One winner takes it all.

WinCup is a social game for small groups of friends (4–8 people) to play during a football World Cup or any knockout tournament. A host creates a room, picks countries, and friends join. A cryptographically secure draw assigns each player one country. Match results update automatically from football-data.org. The player whose country survives longest wins.

**WinCup is for entertainment only. It does not handle, hold, or process any payments.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript, RSC) |
| Styling | Tailwind CSS 4 |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (anonymous + magic-link) |
| Realtime | Supabase Realtime |
| Hosting | Vercel |
| Scheduler | Vercel Cron |
| Football data | football-data.org REST API |

---

## Local Development Setup

### 1. Prerequisites

- Node.js 22+
- npm 9+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A free [football-data.org](https://www.football-data.org) API key

### 2. Clone and install

```bash
git clone <your-repo-url> wincup
cd wincup
npm install
```

### 3. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Set environment variables

```bash
cp .env.example .env.local
# Edit .env.local and fill in all five values
```

Required variables:

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (secret) |
| `FOOTBALL_DATA_API_KEY` | football-data.org dashboard |
| `CRON_SECRET` | `openssl rand -hex 32` |

### 5. Apply database migrations

**Option A — Supabase CLI (recommended for local dev):**

```bash
supabase init          # first time only
supabase start         # starts local Postgres + Supabase stack
supabase db push       # applies all migrations in supabase/migrations/
```

**Option B — Supabase dashboard (cloud project):**

1. Open your project in the Supabase dashboard.
2. Go to **SQL Editor**.
3. Paste and run each migration file in order:
   - `supabase/migrations/20240101000000_create_tables.sql`
   - `supabase/migrations/20240101000001_rls_policies.sql`
   - `supabase/migrations/20240101000002_seed_countries.sql`

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Testing

### Unit tests (Jest + React Testing Library)

```bash
npm test
```

Covers: environment variable validation, and all three landing page components.

### Schema assertion tests (requires local Supabase)

```bash
supabase db reset    # apply migrations fresh
psql "$DATABASE_URL" -f tests/integration/db/schema_assertions.sql
```

Verifies: all 6 tables, RLS enabled everywhere, `host_secret` blocked, 36 countries seeded, key constraints and indices present.

### E2E tests (Playwright)

```bash
# Install browsers once
npx playwright install chromium

# Run tests (starts dev server automatically)
npm run test:e2e

# Interactive mode
npm run test:e2e:ui
```

### Type checking

```bash
npm run typecheck
```

### Production build

```bash
npm run build
```

---

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial WinCup scaffold"
git push
```

### 2. Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
2. In **Environment Variables**, add all five variables from `.env.example`.
   - Set `CRON_SECRET` to the same value you generated locally.

### 3. Enable Vercel Cron

The `vercel.json` file already declares the cron entry:

```json
{ "path": "/api/cron/ingest", "schedule": "*/15 * * * *" }
```

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` with each cron invocation. The route validates this header before doing any work.

> **Note:** The cron handler is a no-op in Stage 1. Full football-data.org ingestion is implemented in Phase 4.

### 4. Configure Supabase Auth

In your Supabase project → **Authentication → Settings**:
- Add your Vercel deployment URL to **Site URL** and **Redirect URLs**
- Enable **Anonymous sign-ins**
- Optionally enable **Email (magic link)** for host accounts

---

## Project Structure

```
wincup/
├── src/
│   ├── app/                   # Next.js App Router pages + API routes
│   │   ├── layout.tsx         # Root layout (font, dark background, metadata)
│   │   ├── page.tsx           # Landing page
│   │   ├── error.tsx          # Global error boundary
│   │   ├── not-found.tsx      # 404 page
│   │   └── api/cron/ingest/   # Vercel Cron endpoint
│   ├── components/
│   │   ├── ui/                # Shared design primitives (Button, Card)
│   │   └── landing/           # Landing page sections
│   ├── lib/
│   │   ├── supabase/          # Browser + server Supabase clients
│   │   ├── types/             # Database type definitions
│   │   └── env.ts             # Validated env var access (server-only)
│   └── middleware.ts          # Auth session refresh
├── supabase/migrations/       # SQL migration files (apply in order)
├── tests/
│   ├── unit/                  # Jest + RTL component and lib tests
│   ├── integration/db/        # SQL schema assertion scripts
│   └── e2e/                   # Playwright end-to-end tests
├── .env.example               # Document all required env vars (commit this)
├── vercel.json                # Cron schedule
└── doc/                       # Implementation plans and reports
```

---

## Build Phases

This project is built phase by phase. Each phase is documented and verified before the next begins.

| Phase | Status | Description |
|-------|--------|-------------|
| Stage 1 (Master Prompt) | ✅ Complete | Scaffold, DB schema, landing page |
| Phase 1 | 🔜 Next | Auth + Create Room |
| Phase 2 | ⏳ | Join Room + Lobby + Realtime |
| Phase 3 | ⏳ | The Draw (secure shuffle + animation) |
| Phase 4 | ⏳ | Group Stage + Cron ingestion |
| Phase 5 | ⏳ | Knockout Bracket (The Ladder) |
| Phase 6 | ⏳ | Winner screen + auto-resolution |

---

## Security Notes

- The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is **never** sent to the browser.
- `host_secret` is blocked from `authenticated`/`anon` Postgres roles at the column level.
- All game-controlling writes go through Server Actions (not direct client inserts).
- The cron route rejects requests without the correct `Authorization: Bearer <CRON_SECRET>` header.
- RLS is enabled on every table from the first migration.
