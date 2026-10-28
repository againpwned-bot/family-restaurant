import fs from "node:fs/promises";
import path from "node:path";

import { CONTENT_TYPES, avatarFile } from "@/lib/server/uploads";

export async function GET(_request: Request, { params }: RouteContext<"/uploads/avatars/[file]">) {
  const file = avatarFile((await params).file);
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(file);
    const type = CONTENT_TYPES[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream";
    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(bytes.length),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
