# Local Supabase emulator (dev only)

`npm run dev:local` runs the whole app on localhost without a Supabase project or Docker:

- **Database**: PGlite (Postgres compiled to WebAssembly), data in `dev/local-supabase/.data/` (git-ignored).
  It applies the real migrations from `supabase/migrations/` on top of small stand-ins for Supabase's `auth`,
  `storage`, `vault` and `pg_net` (`bootstrap.sql`), so RLS, grants and functions behave as written.
- **Auth** (`auth.ts`): password sign-in, refresh tokens, `/user`, sign-out and the admin user API. Sign-up is
  disabled. JWTs are HS256 with a fixed local secret.
- **REST** (`rest.ts`): the PostgREST subset this app uses (select with embedded relations, filters, order,
  count, single/maybeSingle, insert/upsert/update/delete, rpc). Every statement runs as the caller's role with
  their claims, so RLS applies.
- **Storage** (`storage.ts`): upload/remove through `storage.objects` (bucket policies apply) and public download.
- **Realtime** (`realtime.ts`): Phoenix channels (protocol 2.0.0) with `postgres_changes`; each change is re-read
  as the subscriber, so they only receive rows their RLS allows.
- **Edge Functions** (`functions.ts`): serves `supabase/functions/<name>/local.ts`; database calls to
  `net.http_post()` are performed too, so the push trigger reaches `send-push` like on Supabase.
  Push endpoints on the `.invalid` TLD are logged to `.data/push-log.jsonl` instead of being contacted.

Keys used by the dev server: `sb_publishable_local_emulator` / `sb_secret_local_emulator` (not secrets).

On the first start the accounts from `scripts/users.local.json` are created automatically. To start over,
stop the server and delete `dev/local-supabase/.data/`.

Smoke test: `npm run emulator` in one terminal, then `npx tsx dev/local-supabase/tests/smoke.mts`.

This is a development tool only. Production uses a real Supabase project (see the main README).
