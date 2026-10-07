// Copies the "notifications" texts from messages/*.json into the send-push
// Edge Function (which is deployed on its own and can't read the app's files).
//   npm run sync:push-messages        (npm run check:i18n fails if out of sync)

import fs from "node:fs";

export const TARGET = "supabase/functions/send-push/messages.json";

export function pushMessages() {
  const read = (locale: string) => JSON.parse(fs.readFileSync(`messages/${locale}.json`, "utf8")).notifications;
  const strip = (n: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(n).filter(([, v]) => typeof v === "object")); // only per-type entries
  return JSON.stringify({ ro: strip(read("ro")), en: strip(read("en")) }, null, 2) + "\n";
}

if (process.argv[1]?.endsWith("sync-push-messages.mts")) {
  fs.writeFileSync(TARGET, pushMessages());
  console.log(`wrote ${TARGET}`);
}
