// Local Supabase emulator: one HTTP server on :54321 with Auth, REST, Storage
// and Realtime, backed by PGlite. Dev only - production uses a real Supabase
// project. See dev/local-supabase/README.md.

import http from "node:http";
import path from "node:path";

import { createAuth } from "./auth";
import { openDatabase } from "./db";
import { createFunctions } from "./functions";
import { createRealtime } from "./realtime";
import { createRest } from "./rest";
import { createStorage } from "./storage";
import { json } from "./http";

export const EMULATOR_PORT = Number(process.env.LOCAL_SUPABASE_PORT ?? 54321);
export const EMULATOR_URL = `http://127.0.0.1:${EMULATOR_PORT}`;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  "access-control-allow-headers":
    "authorization, apikey, content-type, x-client-info, prefer, accept, accept-profile, content-profile, range, x-upsert, x-supabase-api-version, cache-control, x-metadata",
  "access-control-expose-headers": "content-range, x-total-count, content-length",
  "access-control-max-age": "86400",
};

export async function startEmulator(options: { dataDir?: string | null; quiet?: boolean } = {}) {
  const dataDir =
    options.dataDir === undefined ? path.join(process.cwd(), "dev/local-supabase/.data") : options.dataDir;
  const db = await openDatabase(dataDir ? path.join(dataDir, "pg") : null);

  // Secrets the push trigger reads from Vault on a real project.
  await db.query(
    `insert into vault.secrets (name, secret) values ('project_url', $1), ('push_webhook_secret', 'local-push-secret')
     on conflict (name) do update set secret = excluded.secret`,
    [EMULATOR_URL],
  );

  const auth = createAuth(db, `${EMULATOR_URL}/auth/v1`);
  const rest = await createRest(db);
  const storage = createStorage(
    db,
    path.join(dataDir ?? path.join(process.cwd(), "dev/local-supabase/.data"), "storage"),
  );
  const functions = createFunctions(db, dataDir);
  const realtime = createRealtime(db);

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url ?? "/", EMULATOR_URL);
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS);
        return res.end();
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = chunks.length && req.method !== "GET" && req.method !== "HEAD" ? Buffer.concat(chunks) : undefined;
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      const request = new Request(url, { method: req.method, headers, body });
      const ip = req.socket.remoteAddress ?? "local";

      let response: Response;
      if (url.pathname.startsWith("/auth/v1")) response = await auth(request, url.pathname, ip);
      else if (url.pathname.startsWith("/rest/v1")) response = await rest(request, url.pathname);
      else if (url.pathname.startsWith("/storage/v1")) response = await storage(request, url.pathname);
      else if (url.pathname.startsWith("/functions/v1")) response = await functions.handle(request, url.pathname);
      else if (url.pathname === "/") response = json(200, { emulator: "meniul-de-acasa local supabase", ok: true });
      else response = json(404, { message: "not found" });

      const out = Buffer.from(await response.arrayBuffer());
      const outHeaders: Record<string, string> = { ...CORS };
      response.headers.forEach((v, k) => (outHeaders[k] = v));
      res.writeHead(response.status, outHeaders);
      res.end(req.method === "HEAD" ? undefined : out);
      if (!options.quiet && !url.pathname.startsWith("/storage/v1/object/public")) {
        console.log(`[api] ${req.method} ${url.pathname} ${response.status} ${Date.now() - started}ms`);
      }
    } catch (error) {
      console.error("[api] error", error);
      res.writeHead(500, { ...CORS, "content-type": "application/json" });
      res.end(JSON.stringify({ message: String(error) }));
    }
  });

  server.on("upgrade", (req, socket, head) => {
    if ((req.url ?? "").startsWith("/realtime/v1/websocket")) realtime.upgrade(req, socket, head);
    else socket.destroy();
  });

  await new Promise<void>((resolve) => server.listen(EMULATOR_PORT, "127.0.0.1", resolve));
  return { db, server, close: () => new Promise<void>((r) => server.close(() => r())) };
}
