// Supabase Storage subset: upload (POST/PUT), remove, public download.
// Writes go through storage.objects as the caller, so the bucket policies from
// the migrations decide who may upload or delete.

import fs from "node:fs";
import path from "node:path";

import type { PGlite } from "@electric-sql/pglite";

import { asRole } from "./db";
import { claimsFromHeaders } from "./jwt";
import { json, pgError, readJson } from "./http";

type Bucket = { id: string; public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null };

export function createStorage(db: PGlite, rootDir: string) {
  const fileFor = (bucket: string, name: string) => {
    const full = path.resolve(rootDir, bucket, name);
    if (!full.startsWith(path.resolve(rootDir, bucket) + path.sep)) throw new Error("bad path");
    return full;
  };

  async function bucket(id: string) {
    const res = await db.query<Bucket>(
      "select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = $1",
      [id],
    );
    return res.rows[0] ?? null;
  }

  return async function handle(request: Request, pathname: string): Promise<Response> {
    const route = pathname.replace(/^\/storage\/v1/, "");

    // Public download: /object/public/<bucket>/<path>
    const pub = route.match(/^\/object\/public\/([^/]+)\/(.+)$/);
    if (pub && (request.method === "GET" || request.method === "HEAD")) {
      const [, bucketId, rawName] = pub;
      const name = decodeURIComponent(rawName);
      const b = await bucket(bucketId);
      if (!b?.public) return json(400, { statusCode: "404", error: "not_found", message: "Bucket not found" });
      const res = await db.query<{ metadata: { mimetype?: string; cacheControl?: string } | null }>(
        "select metadata from storage.objects where bucket_id = $1 and name = $2",
        [bucketId, name],
      );
      const file = fileFor(bucketId, name);
      if (!res.rows[0] || !fs.existsSync(file)) {
        return json(400, { statusCode: "404", error: "not_found", message: "Object not found" });
      }
      const meta = res.rows[0].metadata ?? {};
      const data = fs.readFileSync(file);
      return new Response(request.method === "HEAD" ? null : data, {
        status: 200,
        headers: {
          "content-type": meta.mimetype ?? "application/octet-stream",
          "content-length": String(data.length),
          "cache-control": `public, max-age=${meta.cacheControl ?? "3600"}`,
        },
      });
    }

    const claims = claimsFromHeaders(request.headers);

    // Upload: POST (create, or upsert with x-upsert) / PUT (replace)
    const obj = route.match(/^\/object\/([^/]+)\/(.+)$/);
    if (obj && (request.method === "POST" || request.method === "PUT")) {
      const [, bucketId, rawName] = obj;
      const name = decodeURIComponent(rawName);
      const b = await bucket(bucketId);
      if (!b) return json(400, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });

      let bytes: Buffer;
      let mimetype = request.headers.get("content-type") ?? "application/octet-stream";
      let cacheControl = "3600";
      if (mimetype.startsWith("multipart/form-data")) {
        const form = await request.formData();
        const file = [...form.values()].find((v): v is File => typeof v !== "string");
        if (!file) return json(400, { statusCode: "400", error: "invalid", message: "No file in form data" });
        bytes = Buffer.from(await file.arrayBuffer());
        mimetype = file.type || "application/octet-stream";
        cacheControl = String(form.get("cacheControl") ?? "3600");
      } else {
        bytes = Buffer.from(await request.arrayBuffer());
      }

      if (b.file_size_limit && bytes.length > b.file_size_limit) {
        return json(413, {
          statusCode: "413",
          error: "Payload too large",
          message: "The object exceeded the maximum allowed size",
        });
      }
      if (b.allowed_mime_types && !b.allowed_mime_types.includes(mimetype)) {
        return json(415, {
          statusCode: "415",
          error: "invalid_mime_type",
          message: `mime type ${mimetype} is not supported`,
        });
      }

      const upsert = request.method === "PUT" || request.headers.get("x-upsert") === "true";
      try {
        const row = await asRole(db, claims, async (tx) => {
          const metadata = JSON.stringify({ mimetype, size: bytes.length, cacheControl });
          const sql = upsert
            ? `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)
               on conflict (bucket_id, name) do update set metadata = excluded.metadata, updated_at = now() returning id`
            : `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4) returning id`;
          return (await tx.query<{ id: string }>(sql, [bucketId, name, claims.sub ?? null, metadata])).rows[0];
        });
        const file = fileFor(bucketId, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes);
        return json(200, { Id: row.id, Key: `${bucketId}/${name}` });
      } catch (error) {
        const e = error as { code?: string; message?: string };
        if (e.code === "23505")
          return json(409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
        if (e.code === "42501" || e.message?.includes("row-level security")) {
          return json(403, {
            statusCode: "403",
            error: "Unauthorized",
            message: "new row violates row-level security policy",
          });
        }
        return pgError(error);
      }
    }

    // Remove: DELETE /object/<bucket> { prefixes: [...] }
    const del = route.match(/^\/object\/([^/]+)$/);
    if (del && request.method === "DELETE") {
      const bucketId = del[1];
      const { prefixes = [] } = await readJson<{ prefixes?: string[] }>(request);
      try {
        const removed = await asRole(
          db,
          claims,
          async (tx) =>
            (
              await tx.query<{ name: string; id: string }>(
                "delete from storage.objects where bucket_id = $1 and name = any($2::text[]) returning id, name",
                [bucketId, `{${prefixes.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(",")}}`],
              )
            ).rows,
        );
        for (const r of removed) fs.rmSync(fileFor(bucketId, r.name), { force: true });
        return json(
          200,
          removed.map((r) => ({ name: r.name, id: r.id, bucket_id: bucketId })),
        );
      } catch (error) {
        return pgError(error);
      }
    }

    return json(404, {
      statusCode: "404",
      error: "not_found",
      message: `Emulator: ${request.method} ${route} is not implemented`,
    });
  };
}
