import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { AVATAR_PATH, PHOTO_PATH } from "@/lib/photos";
import { dataDir } from "@/lib/server/database";

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 512 * 1024;

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

export function avatarsDir(): string {
  return path.join(dataDir(), "uploads", "avatars");
}

function inside(root: string, relative: string): string | null {
  const file = path.resolve(root, relative);
  return file.startsWith(root + path.sep) ? file : null;
}

export function photoFile(relative: string): string | null {
  return PHOTO_PATH.test(relative) ? inside(photosDir(), relative) : null;
}

export function avatarFile(name: string): string | null {
  return AVATAR_PATH.test(name) ? inside(avatarsDir(), name) : null;
}

function looksLike(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/webp") {
    const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
    return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  }
  return false;
}

export class PhotoRejected extends Error {
  constructor() {
    super("invalid_photo");
  }
}

async function saveImage(file: File, folder: string, maxBytes: number): Promise<string> {
  const extension = TYPES[file.type];
  if (!extension || file.size === 0 || file.size > maxBytes) throw new PhotoRejected();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLike(file.type, bytes)) throw new PhotoRejected();
  const name = `${randomUUID()}.${extension}`;
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ folder, name), bytes, { flag: "wx" });
  return name;
}

export function savePhoto(file: File): Promise<string> {
  return saveImage(file, photosDir(), MAX_PHOTO_BYTES);
}

export function saveAvatar(file: File): Promise<string> {
  return saveImage(file, avatarsDir(), MAX_AVATAR_BYTES);
}

export async function deletePhoto(relative: string | null | undefined) {
  if (!relative) return;
  const file = photoFile(relative);
  if (file) await fs.rm(file, { force: true }).catch(() => {});
}

export async function deleteAvatar(name: string | null | undefined) {
  if (!name) return;
  const file = avatarFile(name);
  if (file) await fs.rm(file, { force: true }).catch(() => {});
}
