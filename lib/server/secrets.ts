import { createECDH, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type Secrets = {
  sessionKey: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
};

const globalCache = globalThis as typeof globalThis & { __meniuSecrets?: Secrets };

function dataFolder(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.MENIU_DATA_DIR || path.join(process.cwd(), "data"));
}

function vapidKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const privateKey = Buffer.alloc(32);
  const raw = ecdh.getPrivateKey();
  raw.copy(privateKey, 32 - raw.length);
  return { publicKey: ecdh.getPublicKey().toString("base64url"), privateKey: privateKey.toString("base64url") };
}

export function secrets(): Secrets {
  if (globalCache.__meniuSecrets) return globalCache.__meniuSecrets;
  const file = path.join(dataFolder(), "secrets.json");
  let stored: Partial<Secrets> = {};
  try {
    stored = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Secrets>;
  } catch {
  }

  let changed = false;
  if (!stored.sessionKey) {
    stored.sessionKey = randomBytes(32).toString("base64url");
    changed = true;
  }
  if (!stored.vapidPublicKey || !stored.vapidPrivateKey) {
    const keys = vapidKeys();
    stored.vapidPublicKey = keys.publicKey;
    stored.vapidPrivateKey = keys.privateKey;
    changed = true;
  }
  if (changed) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(stored, null, 2), { mode: 0o600 });
  }
  globalCache.__meniuSecrets = stored as Secrets;
  return globalCache.__meniuSecrets;
}
