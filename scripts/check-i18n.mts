// Checks that ro.json and en.json have exactly the same keys, and that the
// Romanian file uses the correct comma-below letters (ș ț), not the cedilla
// look-alikes (ş ţ) that old keyboards produce.
//
//   npm run check:i18n

import fs from "node:fs";
import path from "node:path";

type Tree = { [key: string]: string | Tree };

const dir = path.join(process.cwd(), "messages");
const ro = JSON.parse(fs.readFileSync(path.join(dir, "ro.json"), "utf8")) as Tree;
const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8")) as Tree;

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(full, value);
    else for (const [k, v] of flatten(value, full)) out.set(k, v);
  }
  return out;
}

const roKeys = flatten(ro);
const enKeys = flatten(en);
const problems: string[] = [];

for (const key of roKeys.keys()) if (!enKeys.has(key)) problems.push(`missing in en.json: ${key}`);
for (const key of enKeys.keys()) if (!roKeys.has(key)) problems.push(`missing in ro.json: ${key}`);

// ICU argument names only ({count, plural, ...} / {name}), not words inside plural branches.
const placeholders = (s: string) =>
  [...new Set([...s.matchAll(/\{\s*(\w+)\s*(?=[,}])/g)].map((m) => m[1]))].sort().join(",");
for (const [key, value] of roKeys) {
  if (/[şţŞŢ]/.test(value)) problems.push(`cedilla instead of comma-below in ro.json: ${key}`);
  const other = enKeys.get(key);
  if (other !== undefined && placeholders(value) !== placeholders(other)) {
    problems.push(`placeholder mismatch: ${key} (ro: {${placeholders(value)}} en: {${placeholders(other)}})`);
  }
}

// The push Edge Function carries its own copy of the notification texts.
const { pushMessages, TARGET } = await import("./sync-push-messages.mjs");
if (!fs.existsSync(TARGET) || fs.readFileSync(TARGET, "utf8") !== pushMessages()) {
  problems.push(`${TARGET} is out of date: run npm run sync:push-messages`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`i18n OK: ${roKeys.size} keys in both languages.`);
