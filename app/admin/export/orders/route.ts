import { getTranslations } from "next-intl/server";

import { getSession } from "@/lib/auth/dal";
import { isStaff } from "@/lib/auth/roles";
import { csvResponse, toCsv } from "@/lib/csv";
import { kitchenDate } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { cleanHistoryFilters, searchOrders } from "@/lib/server/queries";

const local = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Bucharest",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso))
    : null;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !isStaff(session.profile.role)) return new Response("Forbidden", { status: 403 });
  const t = await getTranslations();
  const filters = cleanHistoryFilters(Object.fromEntries(new URL(request.url).searchParams));
  const orders = await asUser(session.profile.id, (tx) => searchOrders(tx, filters, null, 10_000));

  const header = ["number", "placed", "client", "dish", "quantity", "status", "requested", "notes", "reason", "ready", "handedOver"];
  const body = toCsv([
    header.map((key) => t(`export.columns.${key}` as Parameters<typeof t>[0])),
    ...orders.map((o) => [
      o.number,
      local(o.created_at),
      o.client_name,
      o.dish_name,
      o.quantity,
      t(`orderStatus.${o.status}`),
      local(o.requested_for),
      o.comment,
      o.reject_reason,
      local(o.ready_at),
      local(o.handed_over_at),
    ]),
  ]);
  return csvResponse(body, `orders-${kitchenDate()}.csv`);
}
