import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PrintControls } from "@/components/print/print-controls";
import { requireProfile } from "@/lib/auth/dal";
import { KITCHEN_TZ } from "@/lib/dates";
import { row } from "@/lib/server/database";
import { asUser } from "@/lib/server/db";
import type { DietTag, Order } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Ticket" };

export default async function PrintTicketPage({ params }: PageProps<"/print/order/[id]">) {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const order = await asUser(profile.id, (tx) =>
    row<Order & { client_name: string; allergies: string; diet_tags: DietTag[] }>(
      tx,
      `select o.*, p.display_name as client_name, p.allergies, p.diet_tags
         from public.orders o join public.profiles p on p.id = o.client_id where o.id = $1`,
      [id],
    ),
  );
  if (!order) notFound();
  const t = await getTranslations();
  const time = (iso: string) =>
    new Intl.DateTimeFormat(profile.locale === "en" ? "en-GB" : "ro-RO", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: KITCHEN_TZ,
    }).format(new Date(iso));

  return (
    <>
      <PrintControls auto />
      <article className="mx-auto w-[80mm] border-2 border-dashed border-black p-4 font-mono text-sm print:border-0">
        <p className="text-center text-xs uppercase">{t("common.appName")}</p>
        <h1 className="my-2 text-center text-4xl font-bold">#{order.number}</h1>
        <p className="text-center text-lg font-bold">{order.client_name}</p>
        <hr className="my-3 border-dashed border-black" />
        <p className="text-xl font-bold">
          {order.quantity} × {order.dish_name}
        </p>
        <p className="mt-1">
          {order.requested_for
            ? t("adminOrders.requestedFor", { time: time(order.requested_for) })
            : t("adminOrders.asap")}
        </p>
        {order.comment ? (
          <p className="mt-3 border-2 border-black p-2 text-base font-bold">
            {t("adminOrders.comment")}: {order.comment}
          </p>
        ) : null}
        {order.allergies || order.diet_tags.length ? (
          <div className="mt-3 border-4 border-black p-2">
            <p className="font-bold uppercase">⚠ {t("diet.warning")}</p>
            {order.allergies ? <p className="text-base font-bold">{order.allergies}</p> : null}
            {order.diet_tags.length ? <p>{order.diet_tags.map((tag) => t(`dietTags.${tag}`)).join(" · ")}</p> : null}
          </div>
        ) : null}
        <hr className="my-3 border-dashed border-black" />
        <p className="text-xs">{t("adminOrders.placedAt", { time: time(order.created_at) })}</p>
        <p className="text-xs">{t(`orderStatus.${order.status}`)}</p>
      </article>
    </>
  );
}
