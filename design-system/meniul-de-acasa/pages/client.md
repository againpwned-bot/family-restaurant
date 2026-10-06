# Client Page Overrides

> **PROJECT:** Meniul de acasă
> **Page Type:** Signed-in app (menu browsing, dish detail, ordering, my orders)

> ⚠️ Rules in this file **override** `MASTER.md`. The generated version of this file described an app-store landing
> page; it was replaced with the rules the client side actually follows.

## Layout

- **Max width:** 72rem (`max-w-6xl`), 16px side padding on phones, 24px from `sm`.
- **Phone:** sticky header (brand + account menu) and a fixed bottom navigation (Meniu, Comenzile mele, Setări;
  + Panou admin for the owner). Content keeps `pb-safe-nav` so nothing hides behind the bar.
- **Desktop (≥1024px):** navigation moves into the header; the bottom bar disappears.
- **Home:** WorksWheel showcase of today's dishes, with a list/grid view toggle, search and simple filters.

## Components

- Dish cards: photo first, Playfair title, cook time + "today" badge in gold-soft/gold-ink.
- Order status: big, glanceable status + live timer; "Cancel" only while the order isn't cooking yet.
- Forms: native input types and `inputmode` (numeric quantity, time picker), 16px text (no zoom on focus).

## Effects

- See the animation tiers in the project brief: CSS 3D on phones, WebGL extras only on capable desktops,
  fade-only when reduced motion is requested.
