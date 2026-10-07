// Adapter that runs send-push inside the local emulator (Node). Same handler,
// Node versions of supabase-js and web-push. Endpoints on the reserved
// ".invalid" TLD are not contacted: the would-be push is appended to
// dev/local-supabase/.data/push-log.jsonl instead (used by the e2e tests).

import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import WebSocket from "ws";

import { localVapidKeys } from "../../../dev/local-supabase/vapid";
import { SECRET_KEY } from "../../../dev/local-supabase/jwt";
import { createPushHandler, type PushDeps } from "./handler";
import messages from "./messages.json";

export async function createLocalHandler({ dataDir }: { dataDir: string | null }) {
  const keys = localVapidKeys(dataDir);
  webpush.setVapidDetails("mailto:dev@meniu.local", keys.publicKey, keys.privateKey);
  const logFile = path.join(dataDir ?? "/tmp", "push-log.jsonl");

  const supabase = createClient(`http://127.0.0.1:${process.env.LOCAL_SUPABASE_PORT ?? 54321}`, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });

  const sender: PushDeps["webpush"] = {
    async sendNotification(subscription, payload, options) {
      if (new URL(subscription.endpoint).hostname.endsWith(".invalid")) {
        fs.appendFileSync(
          logFile,
          JSON.stringify({
            endpoint: subscription.endpoint,
            payload: JSON.parse(payload),
            options,
            at: new Date().toISOString(),
          }) + "\n",
        );
        if (subscription.endpoint.includes("/gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
        return { statusCode: 201 };
      }
      return webpush.sendNotification(subscription, payload, options);
    },
  };

  return createPushHandler({
    secret: "local-push-secret",
    messages: messages as PushDeps["messages"],
    supabase: supabase as unknown as PushDeps["supabase"],
    webpush: sender,
    log: (message) => console.warn("[send-push]", message),
  });
}
