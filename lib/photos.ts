export const PHOTO_ROUTE = "/uploads/dish-photos";

export const PHOTO_PATH = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:webp|jpg|jpeg|png|avif)$/;

export function dishPhotoUrl(path: string | null | undefined): string | null {
  if (!path || !PHOTO_PATH.test(path)) return null;
  return `${PHOTO_ROUTE}/${path}`;
}

export const AVATAR_ROUTE = "/uploads/avatars";

export const AVATAR_PATH = /^[A-Za-z0-9_-]+\.(?:webp|jpg)$/;

export function avatarUrl(path: string | null | undefined): string | undefined {
  if (!path || !AVATAR_PATH.test(path)) return undefined;
  return `${AVATAR_ROUTE}/${path}`;
}
