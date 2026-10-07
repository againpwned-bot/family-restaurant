import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { PHOTO_PATH } from "@/lib/photos";
import { dataDir } from "@/lib/server/database";

// Dish photos on disk. The browser already resized them (<= 1600 px, WebP or
// JPEG, ~300 KB); 3 MB is only a safety net.

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg" };
export const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
};

export function photosDir(): string {
  return path.join(dataDir(), "uploads", "dish-photos");
}

/** Absolute path of a stored photo, or null for anything that isn't one of ours. */
export function photoFile(relative: string): string | null {
  if (!PHOTO_PATH.test(relative)) return null;
  const root = photosDir();
  const file = path.resolve(root, relative);
  return file.startsWith(root + path.sep) ? file : null;
}

/** Magic bytes, so a renamed file of another kind is refused. */
function looksLike(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/webp") {
    const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
    return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  }
  return false;
}

/** The message is a key from lib/errors.ts, shown translated in the dish form. */
export class PhotoRejected extends Error {
  constructor() {
    super("invalid_photo");
  }
}

/** Stores an uploaded photo and returns its path relative to the photos folder. */
export async function savePhoto(file: File): Promise<string> {
  const extension = TYPES[file.type];
  if (!extension || file.size === 0 || file.size > MAX_PHOTO_BYTES) throw new PhotoRejected();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLike(file.type, bytes)) throw new PhotoRejected();
  const name = `${randomUUID()}.${extension}`;
  await fs.mkdir(photosDir(), { recursive: true });
  await fs.writeFile(path.join(photosDir(), name), bytes, { flag: "wx" });
  return name;
}

export async function deletePhoto(relative: string | null | undefined) {
  if (!relative) return;
  const file = photoFile(relative);
  if (file) await fs.rm(file, { force: true }).catch(() => {});
}
