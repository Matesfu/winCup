# Cron Correction Plan

## Goal

Remove the 15-minute Vercel Cron schedule for the current version of WinCup because the app no longer depends on an external API to decide country status.

Current country state is controlled directly from Supabase through:

- `countries.is_knocked_out`
- `rooms.fifa_stage`

That means there is no need for Vercel to call `/api/cron/ingest` every 15 minutes right now.

## Why This Change Makes Sense

The previous cron schedule:

```json
{
  "path": "/api/cron/ingest",
  "schedule": "*/15 * * * *"
}
```

means:

- run every 15 minutes,
- run about 96 times per day,
- fetch football API data,
- update room/country status automatically.

That was useful when the app depended on API ingestion.

The current app does not need that because country knockout state is managed from the database. Supabase Realtime already updates the frontend when `countries.is_knocked_out` changes, so scheduled API polling is unnecessary.

## Current Decision

Remove the Vercel cron configuration now.

Recommended current behavior:

- No scheduled API sync.
- Admin/database owner manually updates `countries.is_knocked_out`.
- Frontend reacts through Supabase Realtime.
- Rooms use the latest database country status.
- Vercel Hobby deployment is not blocked by frequent cron limits.

## Implementation Steps

### 1. Remove Vercel Cron Schedule

Update `vercel.json`.

Current:

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

Recommended:

- If `vercel.json` only contains cron config, delete `vercel.json`.
- If future Vercel configuration is needed, keep the file but remove the `crons` block.

Example minimal file if keeping it:

```json
{}
```

### 2. Keep The Cron Route For Future Use

Do not delete:

```text
src/app/api/cron/ingest/route.ts
```

Reason:

- It is already protected by `CRON_SECRET`.
- It can be reused later when API-based updates return.
- Removing it now creates unnecessary future work.

Optional cleanup:

- Update comments in `route.ts` to say the route is currently dormant unless called manually or by a future scheduler.

### 3. Keep Existing Environment Variables For Now

Current API-related environment variables:

```text
FOOTBALL_DATA_API_KEY
CRON_SECRET
```

Recommended now:

- Keep them locally if you may test ingestion manually.
- Do not rely on them for normal production behavior.
- In Vercel, they can remain configured, but no scheduled call will use them.

Security note:

- Rotate secrets that were exposed in chat or screenshots.
- Especially rotate `SUPABASE_SERVICE_ROLE_KEY`.

### 4. Confirm Database-Driven Realtime Still Works

Manual test:

1. Open a room group-stage page in two browser sessions.
2. Update a country in Supabase:

```sql
UPDATE countries
SET is_knocked_out = true
WHERE code = 'ARG';
```

3. Confirm both browsers update the country status without refresh.
4. Set it back if needed:

```sql
UPDATE countries
SET is_knocked_out = false
WHERE code = 'ARG';
```

Expected result:

- No cron job is needed.
- Supabase Realtime broadcasts the database change.
- Frontend applies the knocked-out effect.

## Future API Update Plan

When WinCup needs automatic API updates again, do not use frequent Vercel Cron on the Hobby plan.

Recommended future path:

Use Supabase Cron or Supabase scheduled functions to run the 15-minute job.

Future schedule:

```text
*/15 * * * *
```

Future flow:

1. Supabase Cron runs every 15 minutes.
2. It calls an Edge Function or a protected endpoint.
3. The function fetches football API data.
4. It updates Supabase tables:
   - `countries.is_knocked_out`
   - `rooms.fifa_stage`
   - any future match/result tables
5. Supabase Realtime pushes changes to connected clients.

Recommended future architecture:

```text
Supabase Cron
  → Supabase Edge Function
  → football-data/FIFA API
  → Supabase database updates
  → Supabase Realtime
  → Next.js clients update live
```

This keeps automatic data sync close to the database and avoids Vercel Hobby cron limits.

## Alternative Future Options

### Option A: Upgrade Vercel

Upgrade to Vercel Pro and keep Vercel Cron at:

```text
*/15 * * * *
```

Pros:

- Simple.
- Keeps current `/api/cron/ingest` route.

Cons:

- Paid plan required.
- API sync still runs through Vercel instead of near the database.

### Option B: External Scheduler

Use a third-party scheduler to call:

```text
https://your-domain.com/api/cron/ingest
```

Pros:

- Can be cheap or free.
- Keeps current route.

Cons:

- Adds another service.
- Must protect the endpoint carefully with `CRON_SECRET`.

### Option C: Manual Admin Sync

Add an admin-only button:

```text
Sync World Cup Data Now
```

Pros:

- No scheduler needed.
- Good for testing.

Cons:

- Not automatic.
- Someone must click it.

## Testing Plan

### Unit/Type Tests

Run:

```bash
npm run typecheck
npm test -- --runInBand
```

Expected:

- No type errors.
- Existing tests continue passing.

### Deployment Check

After removing Vercel cron config:

1. Deploy to Vercel Hobby.
2. Confirm the cron limit warning is gone.
3. Confirm dashboard, room creation, joining, and group-stage realtime still work.

### Manual Cron Route Check

The route can still be tested manually if needed:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/cron/ingest
```

Expected:

- If no active API-linked rooms exist, it returns a safe no-op response.
- If API credentials are not configured, it skips safely.

## Recommended Implementation

For the current project state:

1. Remove `crons` from `vercel.json`.
2. Keep `/api/cron/ingest` for future use.
3. Keep database-driven country status as the source of truth.
4. Use Supabase Cron later if 15-minute API automation becomes necessary.

This is the cleanest approach because it avoids unnecessary scheduled work, avoids Vercel Hobby limits, and keeps the future API-sync path open.
