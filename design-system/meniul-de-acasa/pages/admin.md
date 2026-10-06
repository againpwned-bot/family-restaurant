# Admin Page Overrides

> **PROJECT:** Meniul de acasă
> **Page Type:** Dashboard / kitchen operations (orders, today's menu, dishes, shopping list, users)

> ⚠️ Rules in this file **override** `MASTER.md`. The generated "chapters / climax CTA" sections did not apply to a
> dashboard and were replaced.

## Layout

- **Max width:** 1400px, full width below that.
- **Desktop (≥1024px):** fixed left sidebar (16.5rem) with the sections, settings at the bottom, user block with
  sign-out (and "Vezi ca client" for the owner). Orders as a kanban with one column per status.
- **Phone:** compact header + bottom navigation (Comenzi, Meniul zilei, Preparate, Cumpărături, Mai mult). Orders
  as stacked cards, the primary action of each card reachable with the thumb.

## Density

- Higher information density than the client side: smaller headings, tighter card padding (16px), tables where
  data is tabular (dishes list on desktop).

## Effects

- New order: banner + short sound, the new card enters with a soft spring (transform/opacity only).
- Status/timer changes animate in place; no layout-animating properties.
