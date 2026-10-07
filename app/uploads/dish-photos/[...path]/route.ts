import fs from "node:fs/promises";
import path from "node:path";

import { CONTENT_TYPES, photoFile } from "@/lib/server/uploads";

// Serves dish photos from data/uploads/dish-photos/. Public like the menu
// pictures of a restaurant (file names are random UUIDs); next/image fetches
// them from here to make the resized AVIF/WebP versions.
export async function GET(_request: Request, { params }: RouteContext<"/uploads/dish-photos/[...path]">) {
  const relative = (await params).path.join("/");
  const file = photoFile(relative);
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(file);
    const type = CONTENT_TYPES[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream";
    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        // A new photo always gets a new file name, so a file never changes.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(bytes.length),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
