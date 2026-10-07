// VAPID keys for the local emulator: generated once per machine and kept in
// dev/local-supabase/.data/vapid.json (git-ignored).

import fs from "node:fs";
import path from "node:path";

import webpush from "web-push";

export function localVapidKeys(dataDir: string | null): { publicKey: string; privateKey: string } {
  const dir = dataDir ?? path.join(process.cwd(), "dev/local-supabase/.data");
  const file = path.join(dir, "vapid.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const keys = webpush.generateVAPIDKeys();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(keys));
  return keys;
}
