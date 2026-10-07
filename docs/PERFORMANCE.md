# Performance and animation report

Measured on 2026-10-07 against a production build (`next build && next start`) backed by the local Supabase
emulator. Test machine: the reference laptop itself (NVIDIA GeForce RTX 3050 6GB Laptop GPU + AMD Radeon 680M iGPU).

> **2026-10-08:** Supabase was replaced by the app's own local server (database, sign-in, live updates over
> Server-Sent Events, Web Push). The browser no longer loads supabase-js or keeps a WebSocket open; the numbers
> below are from the Supabase version and have not been re-measured yet (`tests/perf/profile.mts` still runs).

## Animation tiers

| Tier           | When                                                                                     | What runs                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `desktop-full` | `(pointer: fine) and (hover: hover)`, width ≥ 1024 px, hardware WebGL renderer           | everything in lite + hover tilt with glare, WebGL steam (login, home), 3D plate (dish), 3D timer ring, scroll parallax, richer page transitions |
| `mobile-lite`  | touch / small screens, **or** a desktop on a software renderer (SwiftShader, llvmpipe…)  | WorksWheel (CSS 3D), card 3D flip, shared-element card → dish, press tilt, 3D status flip, CSS ring timer |
| `reduced`      | `prefers-reduced-motion`, or chosen in Settings                                          | list instead of the wheel, no 3D, no springs, no WebGL; fades ≤ 150 ms, CSS transitions ≤ 120 ms            |

- Detection runs once per page load, per user + device (stored in `localStorage`, mirrored on the profile).
- The first 3 s after the page is interactive are measured with `requestAnimationFrame`: below 50 fps on
  full → lite, below 45 fps on lite → reduced, with the note "Am trecut pe animații reduse pentru fluiditate"
  and an undo (which pins the tier on that device).
- Settings → Animații: Auto / Complete / Ușoare / Reduse (saved on the profile).
- WebGL: lost context, failed context creation or a sustained frame-rate drop (two 3 s windows under 45 fps)
  silently falls back to lite. All three.js work waits until the frame-rate check is over.

## Lighthouse (v12, default throttling)

Mobile = Lighthouse's Moto G Power emulation (4× CPU, slow 4G). Desktop = desktop preset. Signed-in pages were
audited with real session cookies in the browser.

| Page          | Mobile perf | Mobile LCP | Mobile TBT | Mobile CLS | Desktop perf | Desktop LCP | Desktop CLS |
| ------------- | ----------- | ---------- | ---------- | ---------- | ------------ | ----------- | ----------- |
| /login        | 95          | 2.9 s      | 40 ms      | 0          | 100          | 0.8 s       | 0           |
| / (menu)      | 80          | 4.9 s      | 170 ms     | 0.008      | 99           | 1.0 s       | 0.024       |
| /dish/[id]    | 88          | 3.6 s      | 180 ms     | 0          | 99           | 0.9 s       | 0           |
| /orders       | 95          | 2.7 s      | 140 ms     | 0          | 99           | 0.9 s       | 0           |
| /admin        | 81          | 3.8 s      | 330 ms     | 0.019      | 99           | 1.0 s       | 0.001       |

Accessibility 100 and best practices 100 on every page (after fixing the WorksWheel index touch targets).
Mobile LCP on the menu is bound by WorksWheel: it positions and sizes its cards and title from the measured
stage after hydration, so the largest element can only paint once JavaScript has run.

Fixes made because of these audits:
- entrance animations no longer start server-rendered content at `opacity: 0` (they run only after the first page load);
- supabase-js and motion's layout features are no longer in the login page's first load (−66 KB gzip);
- the push-notification card is server-rendered (cookie-controlled) instead of appearing after hydration;
- admin dialogs are code-split; the "tap to enable sound" hint no longer shifts the layout.

## Frame timing during the main transitions

`npx tsx tests/perf/profile.mts` (results in `tests/perf/results.json`). Frames recorded with
`requestAnimationFrame` during each transition, CPU throttled through the DevTools protocol
(`Emulation.setCPUThrottlingRate`). "Dropped" = a frame longer than 1.5 × 16.7 ms.

| Transition                         | Desktop RTX 3050, CPU 2× (full) | Desktop software GL, CPU 2× (lite) | Phone, CPU 4× (lite) | Phone, CPU 6× (lite) |
| ---------------------------------- | ------------------------------- | ---------------------------------- | -------------------- | -------------------- |
| Wheel: ring → drum                 | 0 dropped                       | 0                                  | 0                    | 0                    |
| Wheel: next dish                   | 0                               | 0                                  | 0                    | 0                    |
| Wheel idle (loop stopped)          | 0                               | 0                                  | 0                    | 0                    |
| Card 3D flip / back                | 0 / 0                           | 0 / 0                              | 1 / 1                | 1 / 1                |
| Hover tilt + glare                 | 0                               | 0 (flat on lite)                   | —                    | —                    |
| Card → dish (shared photo)         | 1 (max 83 ms)                   | 1 (67 ms)                          | 2 (150 ms)           | 4 (233 ms)           |
| Dish overlay close                 | 1                               | 0                                  | 2                    | 2                    |
| Page transition → orders           | 0                               | 0                                  | 1                    | 6 (p95 33 ms)        |
| Order accepted (3D flip + banner)  | 0                               | 0                                  | 3                    | 3                    |
| Order screen, timer running        | 1 *                             | 0                                  | 0                    | 0                    |
| Dish page (3D plate on full)       | 0                               | 0                                  | 0                    | 0                    |
| Home idle (WebGL steam on full)    | 1                               | 0                                  | 1                    | 1                    |

\* one ~0.5 s long task (at 2× CPU) when three.js boots the 3D ring the first time on that screen; it is
scheduled for idle time, after the frame-rate check, not during an interaction.

The remaining drops on phones happen in the frame where a new route (or the dish overlay) is committed — React
rendering the new page — not during the animations themselves. At 4× CPU that is 1–3 frames, at 6× (an extreme
setting) up to 6.

## GPU budget (desktop-full)

- One rendering `<Canvas>` at a time per page (when the dish overlay's plate opens over the home page, the
  background pauses), `dpr={[1, 1.5]}`, `powerPreference: "high-performance"`, no antialias, no post-processing.
- Steam: 90 point sprites, one draw call, 0 triangles. Plate: ~8k triangles, 2 lights, one ≤ 1080 px texture
  (AVIF/WebP through the Next image optimizer). Timer ring: ~7.7k triangles + an additive sprite as fake bloom,
  `frameloop="demand"` (one frame per second or on pointer move).
- Rendering stops while the tab is hidden or the canvas is out of view; geometries, materials and textures are
  disposed on unmount. three.js / r3f / drei are only loaded via `next/dynamic({ ssr: false })` on desktop-full
  (a separate ~900 KB chunk that never reaches phones).

## Simplified or cut, and why

- **Lighthouse "mobile" LCP on the menu (~4.9 s simulated)**: WorksWheel measures its stage in the browser before
  it draws anything; changing that would mean rewriting the component, which the brief excluded.
- **KTX2 textures**: not used. The only texture is the dish photo, already resized to ≤ 1600 px WebP on upload and
  served as AVIF/WebP; a KTX2 transcoder (basis) would add more bytes than it saves for a single image.
- **Antialias toggled by fps**: kept off for all canvases; `dpr` up to 1.5 already smooths edges on these scenes.
- **"At most one cheap bloom"**: done as an additive sprite (fake glow) on the 3D ring only; no bloom pass.
- **Shared-element transition**: implemented with Next intercepting routes (the dish opens as an overlay over the
  menu, so both elements exist during the morph). A direct link or a reload of `/dish/[id]` shows the full page
  without the morph.
- **iOS**: not optimised (as requested); push there would require installing the PWA on iOS 16.4+.
- **Headless push subscription**: Playwright's Chromium has no Google push-service keys, so the e2e checks inject
  subscriptions directly and deliver pushes to the service worker via the DevTools protocol; real Chrome, Edge and
  Firefox subscribe normally.
