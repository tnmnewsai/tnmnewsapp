# Video app: Supabase Postgres to Neon

This runbook moves only the Social Video Tool database. It deliberately leaves
all `hermod_*` objects in Supabase and never imports them into Neon.

## Architecture findings

- Supabase is used only as a PostgreSQL host by this application.
- Authentication is Auth.js backed by the application's own `users` table.
- Prisma already uses the standard PostgreSQL driver adapter and works with Neon.
- Media is handled separately by `@svt/storage` using local or S3-compatible storage.
- No Supabase Auth, Storage, Realtime, Vault, or Edge Function migration is needed.

## Required environment variables

- `DATABASE_URL`: Neon pooled connection string used by dashboard and worker.
- `DIRECT_URL`: Neon direct connection string used only by Prisma migrations.

Never commit either value. Keep the existing Supabase connection strings until
the Neon copy has passed validation and production has been stable long enough
to make rollback unnecessary.

## Phase 1: provision without cutover

1. Create a dedicated Neon project for the video app.
2. Save its pooled and direct connection strings in a password manager.
3. Do not replace Vercel's production `DATABASE_URL` yet.
4. Run all existing Prisma migrations against the empty Neon database:

   ```powershell
   $env:DATABASE_URL = '<neon-pooled-url>'
   $env:DIRECT_URL = '<neon-direct-url>'
   pnpm --filter @svt/db exec prisma migrate deploy
   ```

## Phase 2: initial data copy

Install PostgreSQL client tools (`pg_dump`, `pg_restore`, and `psql`) first.
Then run the migration script with the Supabase direct URL as the source and
the Neon direct URL as the target:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-video-db-to-neon.ps1 `
  -SourceUrl '<supabase-direct-url>' `
  -TargetUrl '<neon-direct-url>'
```

The script copies only the Prisma-managed video tables. It excludes:

- every `hermod_*` table
- Supabase-owned schemas and roles
- Supabase Auth, Storage, Vault, Realtime, and extensions
- `_prisma_migrations` (Neon receives its own migration history from
  `prisma migrate deploy`)

## Phase 3: validate

The migration script compares exact row counts for every copied table. Also run:

```powershell
$env:DATABASE_URL = '<neon-pooled-url>'
pnpm --filter @svt/db exec prisma validate
pnpm --filter @svt/dashboard build
```

Test against a preview deployment before production:

- sign in
- dashboard totals and recent sources
- source detail and transcript
- clip editor and existing rendered media playback
- both approval queues
- calendar and analytics
- platform/AI credential reads
- creation of a harmless draft record, followed by deletion

## Phase 4: production cutover

1. Pause dashboard writes and stop the worker.
2. Run the copy script one final time against a fresh/cleared Neon database.
3. Confirm all row counts match.
4. Set the dashboard Vercel `DATABASE_URL` to the Neon pooled URL.
5. Set the worker's `DATABASE_URL` to that same Neon pooled URL.
6. Redeploy/restart dashboard and worker.
7. Resume writes only after smoke tests pass.

`DIRECT_URL` is not required by the running dashboard, but should be configured
in the environment used to run future Prisma migrations.

### YouTube worker authentication

YouTube may require an authenticated browser session for downloads from a
cloud-server IP. Export a Netscape-format `cookies.txt` from a dedicated
YouTube browser session, install it as an owner-readable file on the worker,
and set `YOUTUBE_COOKIES_FILE` to its absolute path. Treat the file as a secret
and never commit it.

## Rollback

If validation fails, stop writes, restore both dashboard and worker
`DATABASE_URL` values to Supabase, redeploy/restart them, and investigate Neon.
Do not delete or modify the Supabase database during the migration window.
