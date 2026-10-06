# Meniul de acasă

A private mini-restaurant for the family: the cook (admin) publishes today's menu, family members order, and
everyone follows each order live up to "ready". There are no payments and no public sign-up.

The website itself is in Romanian (with an English switch). This README, code comments and commit messages are in
English.

## Stack

- Next.js 16 (App Router, Turbopack, `proxy.ts` for route protection), React 19, TypeScript
- Tailwind CSS v4 + shadcn/ui (Radix), design tokens from `design-system/meniul-de-acasa/MASTER.md` (generated with
  `uipro init --ai claude`)
- `motion` (`motion/react`, `LazyMotion` + `m.*`) for UI animation; `three` / `@react-three/fiber` / `drei` only for the
  desktop animation tier, loaded with `next/dynamic` and `ssr: false`
- `next-intl` without locale routing: language stored in a cookie and on the profile, Romanian by default
- Supabase: Auth (username + password), Postgres with RLS, Storage (dish photos), Realtime

## Roles

| Role     | Can do                                                                         |
| -------- | ------------------------------------------------------------------------------ |
| `owner`  | everything: admin panel + client views (switch button), Users page             |
| `admin`  | admin panel only (dishes, today's menu, orders, shopping list)                 |
| `client` | today's menu, ordering, own orders                                             |

People log in with a **username**. Supabase Auth needs an email, so internally `Username` becomes
`username@meniu.local` (lower-cased, never verified, can't receive mail). Nobody ever sees or types that address.

Protection is layered: `proxy.ts` redirects by role, every layout re-checks the role from the `profiles` table, and
Postgres RLS + `SECURITY DEFINER` functions are the final word on data (order status changes only go through those
functions).

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable                               | Where to find it                                          | Exposed to browser |
| -------------------------------------- | --------------------------------------------------------- | ------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project Settings → Data API → Project URL                 | yes                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → Publishable key (or `anon`) | yes                |
| `SUPABASE_SECRET_KEY`                  | Project Settings → API Keys → Secret key (or `service_role`) | **no, server only** |

The secret key is only read by `lib/supabase/admin.ts` (server-only module) and the seed scripts. Web Push (VAPID)
variables are added in the notifications stage.

## First-time setup

1. **Create a Supabase project** (any region close to you; Frankfurt is a good fit for Romania).
2. **Disable public sign-up**: Authentication → Sign In / Providers → turn off "Allow new users to sign up".
   (Even if this were left on, a self-registered account has no profile row and therefore no access.)
3. **Install and configure**:
   ```bash
   npm install
   cp .env.example .env.local   # then fill in the three values
   ```
4. **Apply the database migrations** (`supabase/migrations/*.sql`), either:
   - with the CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, then `npm run db:push`; or
   - by pasting the files, in order, into the Supabase SQL editor.
5. **Create the accounts**: put the family accounts in `scripts/users.local.json` (git-ignored; see
   `scripts/users.example.json` for the format; the `"role:username:password"` string form also works), then:
   ```bash
   npm run seed:users                       # creates missing users, syncs roles; never prints passwords
   npm run seed:users -- --reset-passwords  # also resets passwords to the values in the file
   ```
6. **Optional example dishes** (six Romanian dishes with ingredients, no photos; you can edit or delete them later):
   ```bash
   npm run seed:dishes
   ```

## Run locally

```bash
npm run dev        # http://localhost:3000
```

## Checks

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run check:i18n  # ro.json / en.json have the same keys; Romanian uses ș ț (comma-below), not ş ţ
npm run test:db     # runs all migrations in an in-memory Postgres (PGlite) and tests RLS + the order flow
npm run check       # all of the above
npm run build
```

## Deploy (Vercel)

1. Push the repository to GitHub and import it in Vercel (framework preset: Next.js, Node.js 22).
2. Add the three environment variables above in Project Settings → Environment Variables. Mark
   `SUPABASE_SECRET_KEY` as sensitive.
3. In Supabase → Authentication → URL Configuration, set the Site URL to your Vercel domain.
4. Deploy. Migrations and seeding are run from your machine, not from Vercel.

## Project layout

```
app/                  routes: /login, (client)/…, admin/…
components/ui/        shadcn/ui primitives + works-wheel.tsx
components/…          app components (layout, auth, settings, feedback)
lib/supabase/         browser / server / admin clients, proxy session helper, DB types
lib/auth/             roles, username mapping, data access layer
i18n/, messages/      next-intl config, ro.json (default) and en.json
supabase/migrations/  schema, RLS, order functions, storage + realtime
supabase/tests/       PGlite database tests
scripts/              seed scripts, i18n check
design-system/        design system generated by uipro (MASTER + page overrides)
```
