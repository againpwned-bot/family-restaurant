import { withUser, row, rows, type Db } from "./database";

export const REALTIME_TABLES = [
  "orders",
  "order_events",
  "notifications",
  "dishes",
  "dish_ingredients",
  "shopping_checks",
  "menu_plan",
  "chat_messages",
  "app_settings",
] as const;
export type RealtimeTable = (typeof REALTIME_TABLES)[number];

export type RealtimeEvent = {
  table: RealtimeTable;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type Change = { table: string; type: RealtimeEvent["eventType"]; pk: Record<string, unknown> };
export type Subscriber = {
  userId: string;
  sessionId: string;
  send: (event: RealtimeEvent) => void;
  close: () => void;
};

const store = globalThis as typeof globalThis & { __meniuRealtime?: Set<Subscriber> };
const subscribers = (store.__meniuRealtime ??= new Set<Subscriber>());

export function subscribe(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

const GONE_WHEN_HIDDEN: ReadonlySet<RealtimeTable> = new Set(["dishes"]);

function isTable(name: string): name is RealtimeTable {
  return (REALTIME_TABLES as readonly string[]).includes(name);
}

export async function dropEndedSessions(db: Db, list: Iterable<Subscriber> = subscribers): Promise<Subscriber[]> {
  const all = [...list];
  if (!all.length) return all;
  const open = new Set(
    (
      await rows<{ id: string }>(db, "select id from auth.sessions where id = any($1::uuid[])", [
        [...new Set(all.map((s) => s.sessionId))],
      ])
    ).map((r) => r.id),
  );
  const alive: Subscriber[] = [];
  for (const s of all) {
    if (open.has(s.sessionId)) alive.push(s);
    else {
      subscribers.delete(s);
      s.close();
    }
  }
  return alive;
}

async function fanOut(db: Db, change: Change) {
  if (!subscribers.size || !isTable(change.table)) return;
  const byUser = new Map<string, Subscriber[]>();
  for (const s of await dropEndedSessions(db)) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);

  const columns = Object.keys(change.pk);
  if (!columns.every((c) => /^[a-z_]+$/.test(c))) return;
  const where = columns.map((c, i) => `"${c}" = $${i + 1}`).join(" and ");
  const values = columns.map((c) => change.pk[c]);

  for (const [userId, list] of byUser) {
    let record: Record<string, unknown> | null = null;
    if (change.type !== "DELETE") {
      record = await withUser(db, userId, (tx) =>
        row<Record<string, unknown>>(tx, `select * from public.${change.table} where ${where}`, values),
      ).catch(() => null);
    }
    let eventType = change.type;
    if (change.type !== "DELETE" && !record) {
      if (change.type !== "UPDATE" || !GONE_WHEN_HIDDEN.has(change.table)) continue;
      eventType = "DELETE";
    }
    const event: RealtimeEvent = {
      table: change.table,
      eventType,
      new: record ?? {},
      old: eventType === "INSERT" ? {} : change.pk,
    };
    for (const s of list) s.send(event);
  }
}

export async function startChangeFeed(db: Db) {
  let queue = Promise.resolve();
  await db.listen("changes", (payload) => {
    queue = queue
      .then(() => fanOut(db, JSON.parse(payload) as Change))
      .catch((error) => console.error("[realtime]", error));
  });
}
