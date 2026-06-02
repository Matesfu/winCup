# WinCup — Full Build Prompt for a Local Coding Agent

> **How to use this:** Give the entire "MASTER PROMPT" section to your coding agent first to establish full project context and scaffold the project + database. Then feed the "BUILD PHASES" one at a time. Building phase-by-phase and verifying each before moving on produces far better results than one giant request. The "REFERENCE" section at the end contains schema, algorithms, and integration details the agent should re-read as needed.

---

## MASTER PROMPT (give this first)

You are an expert full-stack engineer. Build a production-quality web app called **WinCup**. Read this entire brief before writing any code. After reading, scaffold the project and set up the database only — do not build feature screens yet. I will request each build phase separately.

### What WinCup does

WinCup is a social game for small groups of friends (4–8 people) to play during a football World Cup (and reusable for any knockout tournament). A host creates a room and picks a set of group-stage countries. Friends join the room with a short code. The host triggers a one-time random draw that assigns each player exactly one country using a cryptographically secure Fisher-Yates shuffle, revealed with a dramatic animation. Players then follow their assigned country through the real tournament. Match results are pulled automatically from the football-data.org API (with a manual host override as fallback). As teams lose, the owning players are eliminated. A knockout "ladder" (bracket tree) visualizes who is climbing. At the end, a winner is decided based on a rule the host chose.

The app does NOT handle money — stakes are settled offline between friends. Show a clear, persistent disclaimer: "WinCup is for entertainment only. It does not handle, hold, or process any payments."

### Tech stack (use exactly this)

- **Frontend:** Next.js (App Router, TypeScript, React Server Components where sensible, Client Components for interactive screens). Tailwind CSS for styling.
- **Hosting:** Vercel. Structure the app so it deploys cleanly to Vercel with zero custom server.
- **Database:** Supabase PostgreSQL.
- **Auth:** Supabase Auth. Use it to identify the host (anonymous or email/magic-link sign-in is fine) so host ownership is tied to a real `auth.uid()` rather than only a client-side secret. Players joining a room may remain anonymous (Supabase anonymous sign-in) so each player still has a stable `auth.uid()` for their session.
- **Realtime:** Supabase Realtime — all players in a room see updates instantly (players joining, the draw starting, results updating, the ladder advancing).
- **Scheduler:** Vercel Cron — a scheduled route that periodically polls football-data.org, ingests new results, advances brackets, eliminates players, and resolves finished rooms.
- **Football data:** football-data.org REST API — the source of truth for fixtures and results. The API key lives only in server-side environment variables, never in client code.

Mobile-first design (most users are on phones). Use Next.js Route Handlers / Server Actions for all privileged writes; never let the browser write game-controlling fields directly.

### Environment variables (document these in `.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never exposed to client
FOOTBALL_DATA_API_KEY=            # server-only
CRON_SECRET=                      # server-only, validates Vercel Cron requests
```

### Design system

- Dark theme only. Background `#0A0E1A`, surface/cards `#151B2E`.
- Primary accent gold `#FFD700` (highlights, winners, active player teams).
- Success green `#10B981` (alive / confirmed). Danger red `#EF4444` (eliminated).
- Text white `#FFFFFF`, muted text `#94A3B8`.
- Clean modern font (Inter, Poppins, or Plus Jakarta Sans). Tabular/monospace numerals for amounts and counters.
- Smooth transitions (200–300ms), cards lift on hover, generous spacing, rounded corners.
- Country flags rendered as emoji (🇧🇷 🇫🇷 🇦🇷) — no image assets needed.
- Brand: the name "WinCup" with a trophy motif. Keep the visual identity premium and sporty.

### The game lifecycle (build toward this in this order)

1. **Setup** — Host signs in, creates a room, sets a win rule, picks N group-stage countries, optionally links the room to a real football-data.org competition/season, and gets a short room code.
2. **Lobby** — Exactly N players join (player count must equal country count). Host locks the room.
3. **The Draw (one time)** — Host clicks Draw. A secure Fisher-Yates shuffle assigns each player one country. A dramatic animated reveal plays per player. Assignments persist to the database.
4. **Group Stage** — A status grid (no bracket yet). Teams are marked qualified/knocked-out. This is driven automatically from football-data.org when the room is linked to a real competition, with a manual host override. Players whose country is knocked out become eliminated and move to a "Knocked out in groups" section.
5. **Build Knockout** — When the real group stage ends, the 16 qualifiers and their bracket positions are established (auto-populated from football-data.org when linked, or entered by the host otherwise). The app auto-links: any surviving player-owned country gets the player attached (gold + name); other qualifiers become neutral "filler" teams (flag only, no player). Player teams eliminated in groups do NOT appear on the bracket.
6. **The Ladder** — A knockout bracket tree. Match winners advance automatically from football-data.org (host manual override available). Winning teams climb; player teams climb with the player's name shown; filler teams climb neutral; losing teams fade and get a red ❌.
7. **Resolution** — Decide the winner based on the room's win rule. Triggered automatically by the cron ingest when the final is decided.

### Win rules (host picks one per room at creation)

- `strict` — A player wins ONLY if their country wins the entire tournament. If the actual champion is a filler team (not owned by any player), show "No winner — the Cup winner wasn't in this room. Stakes returned."
- `last_standing` — The last player whose country is still alive wins (so there is always a winner).

Implement the difference as a single resolution function (see REFERENCE).

### Important structural rule

The draw happens on GROUP-STAGE teams, but the knockout ladder is built from KNOCKOUT QUALIFIERS. A player's team can be knocked out in the group stage and never appear in the bracket. Handle gracefully: flag those players eliminated during the group stage and show them in a separate "Knocked out in groups" section below the ladder — visible, but not on the tree. The bracket tree only ever contains the (up to) 16 knockout teams (mix of player-owned and filler).

### Football-data.org integration (core to this build)

- All calls happen server-side (Route Handlers / cron), using `FOOTBALL_DATA_API_KEY` from env. Respect the free tier rate limit (roughly 10 requests/minute) — cache responses and avoid redundant calls.
- On room creation, optionally let the host pick a real competition + season (e.g., World Cup). Store its external IDs on the room so ingestion knows what to poll.
- Map football-data.org team identifiers to your internal `countries.code` via a stored mapping (`external_team_id` column) so results can be applied to the right teams.
- A Vercel Cron route (e.g., every 10–15 minutes) polls finished matches for each active linked room, writes/updates `matches`, advances `room_teams` through stages, eliminates beaten teams' players, and calls the resolver when the final completes.
- Always provide a **manual host override** for marking qualifiers and match winners, for rooms not linked to a real competition or when the API lags. Auto-ingest and manual override write to the same tables; the latest authoritative update wins, and ingestion must be idempotent (re-running must not double-advance).

### Security (required — implement carefully)

1. Enable Row-Level Security (RLS) on every table.
2. **Reads:** clients may read room state they need (`countries`, and the `rooms`, `players`, `room_countries`, `room_teams`, `matches` for rooms they are in or that they hold the code for). Never expose secret columns.
3. **Host ownership** is tied to `auth.uid()`. Store `host_user_id uuid` on the room. RLS allows host-only writes (lock room, run draw, mark qualifiers, build knockout, manual result entry, resolve) only when `auth.uid() = host_user_id`. Implement these through Server Actions / Route Handlers that use the user's session; do not let arbitrary clients write game-controlling fields.
4. Keep the legacy `host_secret` as a secondary share-link guard if you want host hand-off without login, but the primary gate is `auth.uid()`. Never return secret columns to non-host clients.
5. **Joining:** a player may join only while `rooms.status = 'lobby'` and the room isn't full. Enforce in a Server Action/RPC, not raw client insert. Tie each player row to the joiner's `auth.uid()`.
6. The cron route must reject requests without the correct `CRON_SECRET` (check the `Authorization` header against the env value).
7. The Supabase **service-role key** is used only in server contexts (cron, privileged Route Handlers) and never shipped to the client.
8. Validate all inputs server-side: names (non-empty, trimmed, max length), country codes (must exist), counts (players must equal countries before the draw). Make all privileged operations idempotent.
9. Add basic rate-limiting on room creation, joins, and the cron-triggered ingest where practical.

### For now (this first step only)

1. Scaffold a Next.js (App Router + TypeScript + Tailwind) project ready for Vercel.
2. Add the Supabase client setup (browser client with anon key; server client with service role for privileged ops) and Supabase Auth (support anonymous sign-in and magic-link).
3. Create the database schema, RLS policies, and seed data from the REFERENCE section as SQL migration files.
4. Add `.env.example`, a README with setup/deploy steps (Supabase project, Vercel env vars, football-data.org key, cron schedule), and a `vercel.json` with the cron entry (disabled/no-op handler for now).
5. Build ONLY the **Landing Page**: a dark hero with the WinCup name + trophy, tagline ("Pick a country. Follow the cup. One winner takes it all."), two large buttons "Create Room" and "Join Room", a 3-step "How it works" section, and the entertainment-only disclaimer in the footer.

Stop after the landing page. Confirm the schema, RLS, and project scaffold are in place. I will request each next phase separately.

---

## BUILD PHASES (give one at a time, after the master prompt)

### Phase 1 — Auth + Create Room (Host)

Wire up Supabase Auth (anonymous sign-in by default; offer magic-link to claim a host account). Build the Create Room page. The signed-in host enters their display name and picks an emoji avatar. They toggle the win rule between "Last team standing" (default) and "Strict — must win the whole Cup", each with a one-line explanation. They select countries from a grid of all teams in `countries` (cards with flag + name, grouped visually; tap toggles selection with a gold glow; live counter "Selected: X"). Optionally they link the room to a real football-data.org competition + season via a server-side lookup (store external IDs). Optional stake amount (display only). "Create Room" is disabled until at least 4 countries are selected. On submit, a Server Action generates a unique short room code (format like "WC-7842"), sets `host_user_id = auth.uid()`, inserts the room and its `room_countries`, and navigates to the lobby. Never expose secret columns to other clients.

### Phase 2 — Join Room & Lobby

Build the Join flow and Lobby. Join: a visitor enters a room code, gets an anonymous Supabase session if they don't have one, then enters name + emoji avatar; a Server Action validates the room exists, is in `lobby` status, and isn't full (players < selected countries), then inserts the player tied to their `auth.uid()`. Lobby: room code shown prominently with a copy button; selected countries as flag chips; joined players as live cards via Supabase Realtime (appear instantly); progress "4 of 6 players joined". The host sees a "Start Draw" button (enabled only when players == countries); non-hosts see "Waiting for the host to start…" with a subtle pulse.

### Phase 3 — The Draw (the showpiece)

Build the Draw page. When the host starts it, a host-only Server Action runs the secure Fisher-Yates shuffle and saves each player's `assigned_country` (idempotent — a second call must not re-draw). Then a dramatic reveal plays per player (~4–6s each): screen darkens, "Drawing for [Player Name]…" appears, a horizontal carousel of flags scrolls fast then slows like a slot machine with tick sounds, lands on the assigned country with a thud, the flag bursts with particles/confetti, and the country name shows in large gold letters. All players watch in sync via Realtime. After the last reveal, show a summary grid of every player + their country and a "Go to Group Stage" button. Include a mute toggle.

### Phase 4 — Group Stage grid + ingestion + host override

Build the Group Stage view: every player as a card with flag, name, and status (green border = alive; red ❌ + faded = knocked out). For rooms linked to football-data.org, the cron ingest sets each `room_countries.qualified` and eliminates owners of teams that fail to advance. Provide a host-only control panel as a manual override: each selected country gets "Qualified" / "Knocked out" actions (host Server Action). Knocked-out players move to a "Knocked out in groups" section. When all countries are decided, a "Build Knockout Bracket" action becomes available. Build the Vercel Cron route now: validate `CRON_SECRET`, fetch finished matches for active linked rooms from football-data.org, upsert into `matches`, update `room_countries`/`players` idempotently, and broadcast changes via Realtime.

### Phase 5 — Build Knockout + The Ladder

Build the Build-Knockout step and the Ladder. Build-Knockout: for linked rooms, auto-populate the 16 qualifiers and bracket positions from football-data.org; otherwise the host enters them. Run the auto-link logic to populate `room_teams` (surviving player-owned countries get the player attached, gold + name; others are filler, flag only). The Ladder: a mobile-friendly horizontally-scrolling knockout bracket rendered from `room_teams` and `matches`. Match winners advance automatically via the cron ingest (host manual override available): winners advance (update `current_stage`/`bracket_position`), losers get `is_eliminated = true` and fade with a red ❌; player teams advance with their name in gold, fillers advance neutral. All clients update via Realtime. Advancement must be idempotent.

### Phase 6 — Winner screen + auto-resolution

Build the Winner screen and hook up auto-resolution. When the final completes (detected by the cron ingest), run the resolution function based on `room.win_rule`, persist `rooms.winner_player_id`, and set `rooms.status = 'finished'`. Winner: full-screen confetti, winner's name in giant gold text, their country flag large, the stake displayed, and a "Share to WhatsApp" button with pre-filled text like "🏆 I won WinCup! 🇦🇷 Argentina took the cup and I took the pot!". For strict mode with no qualifying champion: a friendly "No winner — the Cup winner wasn't in this room. Stakes returned" screen that still congratulates the real champion. Include a "Start New Room" button.

---

## REFERENCE (the agent should re-read these as needed)

### Database schema (Supabase Postgres — create as a migration)

```sql
-- Master list of all nations (seed once, shared by all rooms)
CREATE TABLE countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  flag_emoji text NOT NULL,
  external_team_id integer        -- football-data.org team id, nullable
);

-- Rooms
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_user_id uuid NOT NULL,            -- = auth.uid() of the host
  host_name text NOT NULL,
  host_secret text,                      -- optional secondary share-link guard
  status text DEFAULT 'lobby',           -- lobby / drawn / group_stage / knockout / finished
  win_rule text DEFAULT 'last_standing', -- 'strict' or 'last_standing'
  stake_amount numeric,                  -- display only, optional
  external_competition_id integer,       -- football-data.org competition id, nullable
  external_season_id integer,            -- football-data.org season id, nullable
  winner_player_id uuid,                 -- null until resolved
  created_at timestamptz DEFAULT now()
);

-- Players in a room
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid,                          -- = auth.uid() of this player's session
  name text NOT NULL,
  avatar_emoji text,
  assigned_country text REFERENCES countries(code),  -- set at draw time
  is_eliminated boolean DEFAULT false,
  joined_at timestamptz DEFAULT now()
);

-- The countries the host selected for the draw (group-stage pool)
CREATE TABLE room_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  country_code text REFERENCES countries(code),
  qualified boolean,                     -- null = undecided, true = into knockout, false = out in groups
  UNIQUE (room_id, country_code)
);

-- The knockout bracket slots (assigned + filler teams)
CREATE TABLE room_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  country_code text REFERENCES countries(code),
  player_id uuid REFERENCES players(id),  -- NULL = filler team (no player)
  bracket_position int NOT NULL,          -- 1..16 for Round of 16
  current_stage text DEFAULT 'r16',       -- r16 / qf / sf / final / champion / out
  is_eliminated boolean DEFAULT false
);

-- Knockout matches
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  external_match_id integer,              -- football-data.org match id, for idempotent ingest
  stage text NOT NULL,                    -- r16 / qf / sf / final
  team_a_code text REFERENCES countries(code),
  team_b_code text REFERENCES countries(code),
  winner_code text REFERENCES countries(code),  -- null until decided
  bracket_position int,                   -- the slot the winner advances into
  match_order int,                        -- ordering within a stage
  UNIQUE (room_id, external_match_id)
);
```

### Seed the countries table

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
('ITA','Italy','🇮🇹'), ('PER','Peru','🇵🇪');
```
Populate `external_team_id` for each country once you know the football-data.org team IDs for your chosen competition (a one-time admin sync script is fine).

### RLS policy intent (express in SQL migrations)

- Enable RLS on all tables.
- `countries`: public read. Writes restricted to service role.
- `rooms`: read allowed for the row (clients fetch by code/id); never select `host_secret` for non-hosts. Update/delete only when `auth.uid() = host_user_id`.
- `players`: read allowed for players of the same room. Insert only via the join Server Action while `status='lobby'` and not full, tied to the inserter's `auth.uid()`. A player may update only their own row (e.g., avatar), and only the host action eliminates players.
- `room_countries`, `room_teams`, `matches`: read allowed for room members. Writes only by host (`auth.uid() = host_user_id`) or by the service role used in the cron ingest.
- Cron/service-role writes bypass RLS via the service key and must enforce their own checks (valid `CRON_SECRET`, idempotency).

### Secure Fisher-Yates draw

```javascript
export function shuffleSecurely(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);  // cryptographic randomness, NOT Math.random()
    const j = randomBytes[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function drawCountries(players, countries) {
  if (players.length !== countries.length) {
    throw new Error("Player and country counts must match");
  }
  const shuffled = shuffleSecurely(countries);
  return players.map((player, i) => ({
    playerId: player.id,
    playerName: player.name,
    country: shuffled[i],
  }));
}
```
Run on the server inside the host-only "Start Draw" action; persist `players.assigned_country`. The reveal animation only reads already-saved assignments. Guard against re-draw: refuse if any assignment already exists for the room.

### Auto-link logic (building the knockout bracket)

```javascript
function buildKnockoutBracket(knockoutTeams, assignedPlayers) {
  // knockoutTeams = [{ code, position }, ...]
  // assignedPlayers = [{ playerId, country }, ...]  (only players still alive)
  return knockoutTeams.map((team) => {
    const owner = assignedPlayers.find((p) => p.country === team.code);
    return {
      country_code: team.code,
      bracket_position: team.position,
      player_id: owner ? owner.playerId : null,  // NULL = filler team
      current_stage: "r16",
      is_eliminated: false,
    };
  });
}
```

### Resolution logic

```javascript
function resolveWinner(room, roomTeams) {
  const alivePlayerTeams = roomTeams.filter((t) => !t.is_eliminated && t.player_id);

  if (room.win_rule === "strict") {
    const champ = roomTeams.find((t) => t.current_stage === "champion");
    return champ && champ.player_id
      ? { winnerPlayerId: champ.player_id, message: "Champion's owner wins the pot! 🏆" }
      : { winnerPlayerId: null, message: "The Cup winner wasn't in this room — stakes returned 🤷" };
  }

  // last_standing
  if (alivePlayerTeams.length === 1) {
    return { winnerPlayerId: alivePlayerTeams[0].player_id, message: "Last team standing wins! 🏆" };
  }
  return null; // still ongoing
}
```

### football-data.org ingest (server-side, called by Vercel Cron)

- Auth header: `X-Auth-Token: <FOOTBALL_DATA_API_KEY>`.
- For each active linked room, fetch finished matches for its competition/season, e.g. matches filtered by status `FINISHED`.
- For each finished match not already stored (dedupe on `external_match_id`): map both teams via `countries.external_team_id`, determine the winner, upsert into `matches`, then advance `room_teams`/`room_countries` and eliminate beaten players — all idempotently.
- When the final is finished, call `resolveWinner` and persist the outcome.
- Respect rate limits (≈10 req/min on the free tier): cache, batch per room, and stagger if many rooms are active.
- Validate the incoming cron request's `Authorization` header equals `CRON_SECRET` before doing any work.

### vercel.json cron entry (example)

```json
{
  "crons": [
    { "path": "/api/cron/ingest", "schedule": "*/15 * * * *" }
  ]
}
```

---

## Notes to keep in mind while building

- Verify each phase end-to-end (ideally with a few real friends) before moving on; the Draw and the Ladder are the two screens worth polishing most.
- WinCup is tied to a World Cup (every 4 years), but the same engine works for AFCON, the Euros, the Champions League, or any knockout tournament — keep "tournament name" generic and rely on the football-data.org competition link so it's reusable.
- Offline cash settlement relies on trust between friends; the app intentionally does not enforce payment. Keep the entertainment-only disclaimer visible.
- Depending on your jurisdiction, staking money on outcomes may be regulated. Keeping all money handling outside the app (WinCup only assigns teams and tracks results) is the safer position. Consider an 18+ note.
- Make every privileged/server operation idempotent — the cron ingest will run repeatedly over the same data and must never double-advance a bracket or double-eliminate a player.
