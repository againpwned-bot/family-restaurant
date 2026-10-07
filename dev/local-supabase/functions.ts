// Edge Functions for the emulator. A function folder in supabase/functions/<name>
// that has a `local.ts` (exporting `createLocalHandler`) is served at
// /functions/v1/<name>. Database calls to net.http_post() (pg_net on Supabase)
// are performed here too, so DB triggers reach functions exactly like in prod.

import fs from "node:fs";
import path from "node:path";

import type { PGlite } from "@electric-sql/pglite";

import { json } from "./http";

type Handler = (request: Request) => Promise<Response>;
type LocalModule = { createLocalHandler: (env: { dataDir: string | null }) => Promise<Handler> | Handler };

export function createFunctions(db: PGlite, dataDir: string | null) {
  const handlers = new Map<string, Promise<Handler | null>>();

  function load(name: string): Promise<Handler | null> {
    if (!handlers.has(name)) {
      const file = path.join(process.cwd(), "supabase", "functions", name, "local.ts");
      handlers.set(
        name,
        fs.existsSync(file)
          ? import(file).then((m: LocalModule) => m.createLocalHandler({ dataDir }))
          : Promise.resolve(null),
      );
    }
    return handlers.get(name)!;
  }

  // pg_net stand-in: fire-and-forget HTTP calls requested by triggers.
  void db.listen("_local_http", (payload) => {
    const { url, body, headers } = JSON.parse(payload) as {
      url: string;
      body: unknown;
      headers: Record<string, string>;
    };
    fetch(url, { method: "POST", headers, body: JSON.stringify(body) }).catch((e) =>
      console.error("[net] request failed", url, String(e)),
    );
  });

  return {
    async handle(request: Request, pathname: string): Promise<Response> {
      const name = pathname.replace(/^\/functions\/v1\//, "").split("/")[0];
      const handler = await load(name);
      if (!handler) return json(404, { code: "NOT_FOUND", message: `function ${name} not found` });
      try {
        return await handler(request);
      } catch (error) {
        console.error(`[functions] ${name} failed`, error);
        return json(500, { message: String(error) });
      }
    },
  };
}
