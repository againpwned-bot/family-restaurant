// Shared setup for the seed scripts: loads .env.local and builds a
// service-role client. Runs locally only, never in the browser.

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../lib/supabase/database.types";

export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // File missing: fine, the variables may already be in the environment.
    }
  }
}

export function adminClient() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local (see .env.example).");
    process.exit(1);
  }
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}
