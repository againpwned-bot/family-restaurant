// Supabase Realtime subset: Phoenix channels over WebSocket (protocol 2.0.0,
// JSON arrays [join_ref, ref, topic, event, payload]) with postgres_changes.
// For INSERT/UPDATE the row is re-read as each subscriber, so a subscriber only
// receives rows their RLS policies let them see (like Supabase). DELETE events
// carry the primary key only.

import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

import type { PGlite } from "@electric-sql/pglite";
import { WebSocketServer, type WebSocket } from "ws";

import { asRole, type Claims } from "./db";
import { verifyJwt } from "./jwt";

type Binding = { id: number; event: string; schema: string; table?: string; filter?: string };
type Channel = { topic: string; joinRef: string; claims: Claims; bindings: Binding[] };
type Change = {
  schema: string;
  table: string;
  type: "INSERT" | "UPDATE" | "DELETE";
  pk: Record<string, unknown>;
  at: string;
};

let nextBindingId = 1;

export function createRealtime(db: PGlite) {
  const wss = new WebSocketServer({ noServer: true });
  const sockets = new Map<WebSocket, Map<string, Channel>>();

  const send = (
    ws: WebSocket,
    joinRef: string | null,
    ref: string | null,
    topic: string,
    event: string,
    payload: unknown,
  ) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify([joinRef, ref, topic, event, payload]));
  };

  const claimsFor = (token: unknown): Claims => {
    const payload = typeof token === "string" ? verifyJwt(token) : null;
    return payload?.sub ? (payload as Claims) : { role: "anon" };
  };

  wss.on("connection", (ws) => {
    sockets.set(ws, new Map());
    ws.on("message", (raw) => {
      let msg: [string | null, string | null, string, string, Record<string, unknown>];
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const [joinRef, ref, topic, event, payload] = msg;
      const channels = sockets.get(ws)!;

      if (topic === "phoenix" && event === "heartbeat") {
        return send(ws, null, ref, "phoenix", "phx_reply", { status: "ok", response: {} });
      }
      if (event === "phx_join") {
        const config = (payload.config ?? {}) as { postgres_changes?: Omit<Binding, "id">[] };
        const bindings = (config.postgres_changes ?? []).map((b) => ({ ...b, id: nextBindingId++ }));
        channels.set(topic, {
          topic,
          joinRef: joinRef ?? ref ?? "",
          claims: claimsFor(payload.access_token),
          bindings,
        });
        send(ws, joinRef, ref, topic, "phx_reply", { status: "ok", response: { postgres_changes: bindings } });
        if (bindings.length) {
          send(ws, joinRef, null, topic, "system", {
            channel: topic.replace(/^realtime:/, ""),
            extension: "postgres_changes",
            message: "Subscribed to PostgreSQL",
            status: "ok",
          });
        }
        return;
      }
      if (event === "access_token") {
        const channel = channels.get(topic);
        if (channel) channel.claims = claimsFor(payload.access_token);
        return;
      }
      if (event === "phx_leave") {
        channels.delete(topic);
        return send(ws, joinRef, ref, topic, "phx_reply", { status: "ok", response: {} });
      }
      // broadcast / presence are not used by the app: acknowledge and ignore.
      if (ref) send(ws, joinRef, ref, topic, "phx_reply", { status: "ok", response: {} });
    });
    ws.on("close", () => sockets.delete(ws));
  });

  function matches(binding: Binding, change: Change, record: Record<string, unknown> | null) {
    if (binding.event !== "*" && binding.event !== change.type) return false;
    if (binding.schema !== "*" && binding.schema !== change.schema) return false;
    if (binding.table && binding.table !== "*" && binding.table !== change.table) return false;
    if (binding.filter) {
      const m = binding.filter.match(/^(\w+)=(eq|neq|in)\.(.*)$/);
      if (!m) return true;
      const value = String((record ?? change.pk)[m[1]] ?? "");
      if (m[2] === "eq") return value === m[3];
      if (m[2] === "neq") return value !== m[3];
      return m[3]
        .replace(/^\(|\)$/g, "")
        .split(",")
        .includes(value);
    }
    return true;
  }

  async function onChange(raw: string) {
    const change = JSON.parse(raw) as Change;
    const where = Object.keys(change.pk)
      .map((k, i) => `"${k}" = $${i + 1}`)
      .join(" and ");
    const values = Object.values(change.pk).map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)));

    for (const [ws, channels] of sockets) {
      for (const channel of channels.values()) {
        // Cheap pre-check on event/schema/table before reading the row as this subscriber.
        const candidates = channel.bindings.filter((b) => matches({ ...b, filter: undefined }, change, null));
        if (!candidates.length || channel.claims.role === "anon") continue;

        let record: Record<string, unknown> | null = null;
        if (change.type !== "DELETE") {
          record = await asRole(db, channel.claims, async (tx) => {
            const res = await tx.query<{ j: Record<string, unknown> }>(
              `select to_jsonb(t) as j from "${change.schema}"."${change.table}" t where ${where}`,
              values,
            );
            return res.rows[0]?.j ?? null;
          }).catch(() => null);
          if (!record) continue; // not visible to this subscriber
        }
        const ids = candidates.filter((b) => matches(b, change, record)).map((b) => b.id);
        if (!ids.length) continue;
        send(ws, channel.joinRef, null, channel.topic, "postgres_changes", {
          ids,
          data: {
            schema: change.schema,
            table: change.table,
            commit_timestamp: change.at,
            type: change.type,
            columns: [],
            record: record ?? {},
            old_record: change.type === "INSERT" ? {} : change.pk,
            errors: null,
          },
        });
      }
    }
  }

  // Serialise change handling so events arrive in commit order.
  let queue = Promise.resolve();
  void db.listen("_local_changes", (payload) => {
    queue = queue.then(() => onChange(payload)).catch((e) => console.error("[realtime]", e));
  });

  return {
    upgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
    },
  };
}
