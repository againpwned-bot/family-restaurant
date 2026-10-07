// Dish photos are files under data/uploads/dish-photos/ on this computer,
// served by app/uploads/[...path]/route.ts.

export const PHOTO_ROUTE = "/uploads/dish-photos";

/** File names the server creates: <uuid>.webp / .jpg (old paths may have folders). */
export const PHOTO_PATH = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:webp|jpg|jpeg|png|avif)$/;

/** URL of a dish photo, or null when the dish has none. */
export function dishPhotoUrl(path: string | null | undefined): string | null {
  if (!path || !PHOTO_PATH.test(path)) return null;
  return `${PHOTO_ROUTE}/${path}`;
}
