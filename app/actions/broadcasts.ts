"use server";

import { act } from "@/lib/server/action";
import { row } from "@/lib/server/database";
import { recentBroadcasts } from "@/lib/server/queries";
import type { Broadcast } from "@/lib/types";

const STAFF = ["owner", "admin"] as const;

export async function sendBroadcast(input: {
  title: string;
  body: string;
  audience: Broadcast["audience"];
  people: string[];
}) {
  return act(STAFF, async (tx) =>
    (await row<Broadcast>(tx, "select * from public.send_broadcast($1, $2, $3, $4::uuid[])", [
      input.title,
      input.body,
      input.audience,
      input.audience === "people" ? input.people.slice(0, 100) : null,
    ]))!,
  );
}

export async function fetchBroadcasts() {
  return act(STAFF, (tx) => recentBroadcasts(tx));
}
