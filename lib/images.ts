// Browser-side photo preparation: huge phone photos are the #1 cause of lag,
// so every dish photo is resized to <= 1600px and compressed to ~300 KB
// (WebP where the browser can encode it, JPEG otherwise) before upload, plus a
// tiny blurred preview used as the placeholder while the real photo loads.

export const MAX_PHOTO_SIDE = 1600;
export const TARGET_BYTES = 300 * 1024;
const MAX_INPUT_BYTES = 40 * 1024 * 1024;

export type PreparedPhoto = {
  blob: Blob;
  width: number;
  height: number;
  /** data: URL, ~0.5 KB */
  blur: string;
  type: "image/webp" | "image/jpeg";
};

export class PhotoError extends Error {}

function canvasFor(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new PhotoError("no 2d context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new PhotoError("encode failed"))), type, quality),
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fallback for formats createImageBitmap can't take directly.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp|avif)$/i.test(file.name)) {
    throw new PhotoError("not an image");
  }
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError("too large");

  const source = await decode(file);
  const srcW = "naturalWidth" in source ? source.naturalWidth : source.width;
  const srcH = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!srcW || !srcH) throw new PhotoError("empty image");

  let scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(srcW, srcH));
  let result: { blob: Blob; width: number; height: number } | null = null;

  // Probe once whether this browser encodes WebP (Safari falls back to PNG).
  const probe = canvasFor(1, 1);
  const webp = (await toBlob(probe.canvas, "image/webp", 0.8)).type === "image/webp";
  const type = webp ? "image/webp" : "image/jpeg";

  for (let attempt = 0; attempt < 4 && !result; attempt++) {
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));
    const { canvas, ctx } = canvasFor(width, height);
    ctx.drawImage(source, 0, 0, width, height);
    for (const quality of [0.82, 0.74, 0.66, 0.58]) {
      const blob = await toBlob(canvas, type, quality);
      if (blob.size <= TARGET_BYTES || quality === 0.58) {
        if (blob.size <= TARGET_BYTES * 1.25 || attempt === 3) result = { blob, width, height };
        break;
      }
    }
    scale *= 0.85;
  }
  if ("close" in source) source.close();

  // 24px-wide preview, heavily compressed; next/image blurs it further.
  const bw = 24;
  const bh = Math.max(1, Math.round((bw * result!.height) / result!.width));
  const small = canvasFor(bw, bh);
  const bitmap = await createImageBitmap(result!.blob);
  small.ctx.drawImage(bitmap, 0, 0, bw, bh);
  bitmap.close();
  const blur = await blobToDataUrl(await toBlob(small.canvas, type, 0.5));

  return { ...result!, blur, type };
}

export function photoExtension(type: PreparedPhoto["type"]) {
  return type === "image/webp" ? "webp" : "jpg";
}

export function formatBytes(bytes: number, locale: string) {
  const nf = new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-GB", { maximumFractionDigits: 1 });
  return bytes >= 1024 * 1024 ? `${nf.format(bytes / 1024 / 1024)} MB` : `${nf.format(Math.round(bytes / 1024))} KB`;
}
