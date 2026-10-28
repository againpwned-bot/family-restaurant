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
- Everything runs on this computer: Postgres compiled to WebAssembly ([PGlite](https://pglite.dev)) storing its
  files in `data/`, username + password sign-in with scrypt-hashed passwords and httpOnly session cookies, live
  updates over Server-Sent Events, dish photos on disk, Web Push sent straight from the Next.js server.
  No database server, Docker or cloud account to set up.
- Look: "paper menu" in light mode, "kitchen chalkboard" in dark mode. Fraunces (headings), Bricolage Grotesque
  (text), Caveat (handwritten notes), DM Mono (order tickets). Colours live in `app/globals.css`; the animated
  decorations (doodles, ticker, spinning stamp, cooking pot, confetti) are in `components/decor/`. Every endless
  animation carries `data-anim="loop"` and stops on the "Reduse" animation setting.
- Original design-system notes: `design-system/meniul-de-acasa/` (the palette there predates the redesign)

## Run it

```bash
npm install
cp scripts/users.example.json scripts/users.local.json   # then put the family's accounts in it
npm run dev                                               # http://localhost:3000/login
```

On the first start the app creates `data/` (database, session key, push keys, photos) and the accounts from
`scripts/users.local.json` (git-ignored; the `"role:username:password"` form also works). After that the owner
adds, renames and removes people on the Users page. Passwords are never printed or logged.

For everyday use, the production build is faster (`npm run serve` does both steps):

```bash
npm run build && npm start      # http://localhost:3000
```

If the browser still shows an old look after updating the code, stop the app, delete the `.next/` folder and
build again.

Optional example dishes (six Romanian dishes with ingredients, no photos): stop the app, `npm run seed:dishes`,
start it again. Only one process can open the database at a time; the scripts tell you if the app is running.

The family's own dishes (exactly the recipes in "Cartea de bucate a Medei") live in `scripts/family-recipes.ts`,
copied as written: amounts are for the whole recipe and there are no cooking times. Add a dish there, stop the app
and run `npm run seed:recipes` (names already on the dishes list are skipped).

### Phones on the home Wi-Fi

`npm start` also listens on the network address it prints (e.g. `http://192.168.1.20:3000`), so the family can
use the app from their phones while this computer is on (`npm run dev` only serves its development files to this
computer, so use the production build for phones). Everything works there except Web Push:
browsers only allow it on `https://` or on `localhost`, so phones get the in-app banner and sound while the app
is open. Push notifications work in the browser of this computer (`http://localhost:3000`), or anywhere you put
the app behind HTTPS.

On a phone, open the address in Chrome (Android) or Safari (iPhone) and use **Add to Home screen**: the app then
opens full screen with its own icon, like an installed app. If the phone can't reach the address, check that both
are on the same Wi-Fi and that this computer's firewall allows port 3000 (on Ubuntu: `sudo ufw allow 3000/tcp`).

### Settings (optional, in `.env.local`)

| Variable         | Default                         | What                                                      |
| ---------------- | ------------------------------- | --------------------------------------------------------- |
| `MENIU_DATA_DIR` | `./data`                        | where the database, keys and photos are kept              |
| `VAPID_SUBJECT`  | `mailto:meniu-de-acasa@example.com` | contact address sent to the browsers' push services   |

### Backups

Everything that belongs to you is in `data/` (and `scripts/users.local.json`). Stop the app and copy the folder;
to restore, put it back. Deleting `data/` starts over from an empty database (the accounts are created again
from `users.local.json` on the next start).

## Roles and security

| Role     | Access                                                               |
| -------- | -------------------------------------------------------------------- |
| `owner`  | everything: admin panel + client views (switch button), Users page   |
| `admin`  | admin panel only                                                     |
| `client` | today's menu, ordering, own orders                                   |

- People sign in with a **username** (case-insensitive) and a password. There is no sign-up page.
- Passwords are hashed with scrypt; wrong passwords are rate-limited per username and address.
- The session cookie is httpOnly, `SameSite=Lax`, signed with a key generated into `data/secrets.json`, and
  `Secure` when the app is reached over HTTPS. Sessions live in the database, so signing out, a password reset or
  a role change ends them at once (including open live-update streams).
- Layers: `proxy.ts` checks the signed cookie and redirects by role → every layout re-checks the session and
  role in the database → every query runs as the signed-in user, so Postgres row level security and the
  `SECURITY DEFINER` functions are the final word (orders change status only through those functions).
  Live updates are re-read as each listener, so nobody receives a row they couldn't read.

## Checks

```bash
npm run check        # typecheck + lint + i18n (ro/en keys, ș ț) + unit tests (incl. push delivery) + database tests
npm run test:db      # all migrations in an in-memory database: RLS, order flow, admin helpers, push + change feed (80 checks)
npm run test:e2e     # with the app running and the example dishes seeded: admin, client and push end-to-end checks
npx tsx tests/perf/profile.mts   # frame timing per tier with CPU throttling (see docs/PERFORMANCE.md)
```

The e2e checks drive both sides of every flow (the family member and the kitchen) through real browser sessions
and need Playwright's Chromium once: `npx playwright-core install chromium`.

They place, cancel and hand over real orders and change today's menu, so run them against a separate copy with
its own data folder, not the family's:

```bash
MENIU_DATA_DIR=./data-e2e npm run seed:dishes          # creates the copy with the example dishes
MENIU_DATA_DIR=./data-e2e npx next start -p 3100       # in another terminal (adds the accounts on start)
E2E_BASE_URL=http://localhost:3100 npm run test:e2e
```

## Performance

See [docs/PERFORMANCE.md](docs/PERFORMANCE.md): animation tiers, Lighthouse (mobile + desktop), frame timing
under CPU throttling, the GPU budget, and what was simplified.

## Project layout

```
app/                    routes: /login, (client)/… (+ @modal dish overlay), admin/…, api/realtime, api/push, uploads
app/actions/            server actions (orders, dishes, shopping, notifications, preferences, account)
components/ui/          shadcn/ui primitives + works-wheel.tsx
components/{admin,client,orders,notifications,settings,layout,motion,three,providers}/
lib/server/             database, sessions, passwords, queries, live updates, push delivery, photo storage
lib/                    auth, types, dates, shopping maths, images, push (browser), animation tiers
hooks/                  live updates, shared clock, entrance helper
messages/               ro.json (default), en.json
db/migrations/          schema, RLS, order functions, change feed, admin functions, push trigger
db/tests/               database tests
tests/                  unit tests, e2e checks, performance profiling
scripts/                seed users/dishes, i18n check, icons
data/                   this computer's database, keys and photos (git-ignored, created on first start)
```
