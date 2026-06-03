# Cron Correction Report

## Summary

Implemented the cron correction plan from `doc/cron/cron-correction-plan.md`.

The app no longer schedules `/api/cron/ingest` through Vercel Cron. This fits the current database-driven workflow where country availability and knockout status are managed directly in Supabase through `countries.is_knocked_out`.

## Changes Made

### Removed Vercel Cron Schedule

Deleted `vercel.json` because it only contained this cron configuration:

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

Result:

- Vercel Hobby deployments should no longer show the “daily cron jobs only” warning.
- No scheduled Vercel request will call `/api/cron/ingest`.
- The app now fully relies on Supabase database updates for country status.

### Kept The Ingest Route For Future Use

Kept:

```text
src/app/api/cron/ingest/route.ts
```

Updated its documentation to explain that it is now a dormant/manual endpoint, not a Vercel-scheduled endpoint.

The route remains useful for:

- manual testing,
- future Supabase Cron scheduling,
- future football API automation.

### Cleaned Cron Route Typing

While validating the touched route, ESLint exposed existing `any` casts in `src/app/api/cron/ingest/route.ts`.

Those were replaced with small local interfaces:

- `CronQuery`
- `CronAdminClient`

This keeps the route lint-clean without changing runtime behavior.

## Current Runtime Behavior

Current source of truth:

```text
Supabase database
  → countries.is_knocked_out
  → Supabase Realtime
  → connected Next.js clients
```

No scheduler is required for the current flow.

When an admin updates a country in Supabase:

```sql
UPDATE countries
SET is_knocked_out = true
WHERE code = 'ARG';
```

connected clients can receive the update through Supabase Realtime.

## Future API Automation Path

When automatic API updates are needed again, recommended future path:

```text
Supabase Cron
  → Supabase Edge Function or protected endpoint
  → football API
  → Supabase database updates
  → Supabase Realtime
  → Next.js clients
```

Recommended future schedule:

```text
*/15 * * * *
```

This avoids Vercel Hobby cron limits while keeping frequent sync close to the database.

## Validation Results

Passed:

```bash
npm run typecheck
```

Passed:

```bash
npm test -- --runInBand
```

Result:

- 35 test suites passed
- 323 tests passed

Passed targeted lint:

```bash
npx eslint src/app/api/cron/ingest/route.ts
```

Notes:

- Markdown docs are ignored by the project ESLint config, so `doc/cron/*.md` is not linted by ESLint.
- Playwright E2E was not run because it requires live Supabase test accounts and a running browser environment.

## Deployment Checklist

Before deploying:

1. Confirm `vercel.json` is removed from the final commit.
2. Deploy to Vercel Hobby.
3. Confirm the cron warning no longer appears.
4. Confirm database-driven country status updates still reflect on the frontend.

## Security Reminder

The project currently stores sensitive keys in `.env.local`.

If any secret was shared in chat, screenshots, or logs, rotate it:

- `SUPABASE_SERVICE_ROLE_KEY`
- `FOOTBALL_DATA_API_KEY`
- `CRON_SECRET`

The Supabase service role key is the most sensitive because it can bypass Row Level Security.
