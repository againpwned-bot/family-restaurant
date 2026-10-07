# Meniul de acasă

A private mini-restaurant for the family: the cook (admin) publishes today's menu, family members order, and
everyone follows each order live up to "ready", with Web Push notifications. No payments, no public sign-up.

The website is in Romanian (with an English switch). This README, code comments and commit messages are in English.

## What's inside

**Client** (owner + clients): today's menu as a WorksWheel showcase or a list/grid (search, "quick" filter,
3D card flip with the ingredients), dish page (opens as an overlay with a shared-element photo transition):
portions, ASAP or a time, notes; "My orders" with live status, countdown ring and cancel-before-cooking; an
order screen with a timeline; history.

**Admin** (owner + admin): live orders board (kanban on desktop, status tabs on phones) with sound + banner,
accept with a timer, reject with a reason, start cooking, +5/+10 min, "Gata!", hand over; dishes with photo
upload (resized to ≤ 1600 px WebP in the browser) and ingredients; today's menu (resets every night, "copy
yesterday's menu"); automatic shopping list with "I bought it" ticks.

**Owner only**: Users page (add, edit name/role, reset password, delete) and a switch between admin and client views.

**Everyone**: Settings with language (RO/EN), theme, animations (Auto / Complete / Ușoare / Reduse),
notifications (explicit opt-in, test notification) and change password.

## Stack

- Next.js 16 (App Router, Turbopack, `proxy.ts`), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix)
- `motion` (`motion/react`, `LazyMotion` + `m.*`); three.js / react-three-fiber / drei only on the
  desktop-full tier via `next/dynamic` (`ssr: false`)
- `next-intl` (Romanian default, cookie + profile based, no locale in the URL)
- Supabase: Auth (username + password), Postgres + RLS, Storage, Realtime, an Edge Function for Web Push
- Design system generated with `uipro init --ai claude` (`design-system/meniul-de-acasa/`)

## Roles and security

| Role     | Access                                                               |
| -------- | -------------------------------------------------------------------- |
| `owner`  | everything: admin panel + client views (switch button), Users page   |
| `admin`  | admin panel only                                                     |
| `client` | today's menu, ordering, own orders                                   |

People log in with a **username**; internally it becomes `username@meniu.local` (lower-cased, never verified).
Layers: `proxy.ts` redirects by role → every layout re-checks the role from `profiles` → Postgres RLS and
`SECURITY DEFINER` functions are the final word (orders change status only through those functions). There is
no sign-up page, and an account without a `profiles` row has no access even if sign-up were left on.

## Environment variables

Copy `.env.example` to `.env.local` (git-ignored) and set them in Vercel:

| Variable                               | Where                                                        | Browser? |
| -------------------------------------- | ------------------------------------------------------------ | -------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → Data API → Project URL         | yes      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → Publishable key (or `anon`)    | yes      |
| `SUPABASE_SECRET_KEY`                  | Project Settings → API Keys → Secret key (or `service_role`) | **no**   |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`         | printed by `npm run push:setup`                              | yes      |

Edge Function secrets (set with `npx supabase secrets set`, see below): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET`.

## Try it locally without Supabase

```bash
npm install
npm run dev:local     # local Supabase emulator + Next.js on http://localhost:3000
```

The accounts from `scripts/users.local.json` are created on the first run (see `dev/local-supabase/README.md`).
Optional example dishes: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=sb_secret_local_emulator npm run seed:dishes`.

## Set up the real Supabase project

1. Create a project (Frankfurt is a good region for Romania).
2. **Disable sign-up**: Authentication → Sign In / Providers → turn off "Allow new users to sign up".
3. `cp .env.example .env.local` and fill in the first three variables.
4. **Database**: `npx supabase login`, `npx supabase link --project-ref <ref>`, then `npm run db:push`
   (or paste `supabase/migrations/*.sql` into the SQL editor, in order).
5. **Accounts**: put the family in `scripts/users.local.json` (git-ignored; format in `scripts/users.example.json`,
   the `"role:username:password"` form also works), then `npm run seed:users`
   (`-- --reset-passwords` to re-apply the passwords from the file). Passwords are never printed.
6. Optional: `npm run seed:dishes` (six Romanian dishes with ingredients, no photos).
7. **Web Push**: `npm run push:setup -- <project-ref>` prints the VAPID keys and a webhook secret, and the exact
   commands: `npx supabase secrets set …`, `npx supabase functions deploy send-push --no-verify-jwt`, and two
   `vault.create_secret(…)` calls for the SQL editor. Put `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.local` / Vercel.
   Until this is done, notifications still appear in the app (banner + sound) while it's open.

## Run

```bash
npm run dev          # http://localhost:3000 (uses .env.local)
npm run build && npm run start
```

## Checks

```bash
npm run check        # typecheck + lint + i18n (ro/en keys, ș ț, push texts in sync) + unit + database tests
npm run test:db      # all migrations in an in-memory Postgres (PGlite): RLS, order flow, admin helpers, push trigger (75 checks)
npm run test:e2e     # with `npm run dev:local` running: admin, client and push end-to-end checks (Playwright)
npx tsx tests/perf/profile.mts   # frame timing per tier with CPU throttling (see docs/PERFORMANCE.md)
```

The e2e checks need Playwright's Chromium once: `npx playwright-core install chromium`.

## Deploy (Vercel)

1. Push the repository to GitHub and import it in Vercel (framework: Next.js, Node.js 22).
2. Add the four environment variables (mark `SUPABASE_SECRET_KEY` as sensitive).
3. Supabase → Authentication → URL Configuration: Site URL = your Vercel domain.
4. Deploy. Migrations, seeding and the Edge Function are deployed from your machine with the Supabase CLI.

## Performance

See [docs/PERFORMANCE.md](docs/PERFORMANCE.md): animation tiers, Lighthouse (mobile + desktop), frame timing
under CPU throttling, the GPU budget, and what was simplified.

## Project layout

```
app/                    routes: /login, (client)/… (+ @modal dish overlay), admin/…, api/push
components/ui/          shadcn/ui primitives + works-wheel.tsx
components/{admin,client,orders,notifications,settings,layout,motion,three,providers}/
lib/                    supabase clients + types, auth, dates, shopping maths, images, push, animation tiers
hooks/                  realtime subscription, shared clock, entrance helper
messages/               ro.json (default), en.json
supabase/migrations/    schema, RLS, order functions, storage/realtime, admin functions, push trigger
supabase/functions/     send-push Edge Function (+ local adapter)
supabase/tests/         PGlite database tests
dev/local-supabase/     local emulator (Auth, REST, Storage, Realtime, Functions)
tests/                  unit tests, e2e checks, performance profiling
scripts/                seed users/dishes, push setup, i18n check, icons
```
