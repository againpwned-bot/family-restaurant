// Supabase Edge Function entry point (Deno). Deploy with:
//   npx supabase functions deploy send-push --no-verify-jwt
// Secrets (npx supabase secrets set ...): PUSH_WEBHOOK_SECRET, VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT. SUPABASE_URL and the service role key are
// provided by the platform.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

import { createPushHandler, type PushDeps } from "./handler.ts";
import messages from "./messages.json" with { type: "json" };

const env = (key: string) => Deno.env.get(key) ?? "";

webpush.setVapidDetails(
  env("VAPID_SUBJECT") || "mailto:admin@meniu.local",
  env("VAPID_PUBLIC_KEY"),
  env("VAPID_PRIVATE_KEY"),
);

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(
  createPushHandler({
    secret: env("PUSH_WEBHOOK_SECRET"),
    messages: messages as PushDeps["messages"],
    supabase: supabase as unknown as PushDeps["supabase"],
    webpush: webpush as unknown as PushDeps["webpush"],
    log: (message) => console.warn(message),
  }),
);
