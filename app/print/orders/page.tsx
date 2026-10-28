import { getTranslations } from "next-intl/server";

import { PrintControls } from "@/components/print/print-controls";
import { requireProfile } from "@/lib/auth/dal";
import { KITCHEN_TZ } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { cleanHistoryFilters, searchOrders } from "@/lib/server/queries";

export const metadata = { title: "Orders" };

export default async function PrintOrdersPage({ searchParams }: PageProps<"/print/orders">) {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations();
  const filters = cleanHistoryFilters(await searchParams);
  const orders = await asUser(profile.id, (tx) => searchOrders(tx, filters, null, 1000));
  const time = (iso: string) =>
    new Intl.DateTimeFormat(profile.locale === "en" ? "en-GB" : "ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: KITCHEN_TZ,
    }).format(new Date(iso));

  return (
    <>
      <PrintControls />
      <h1 className="mb-1 text-2xl font-bold">{t("history.title")}</h1>
      <p className="mb-4 text-sm">
        {[filters.from, filters.to].filter(Boolean).join(" → ") || t("history.allTime")} ·{" "}
        {t("history.showing", { count: orders.length })}
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">{t("export.columns.placed")}</th>
            <th className="py-1 pr-2">{t("export.columns.client")}</th>
            <th className="py-1 pr-2">{t("export.columns.dish")}</th>
            <th className="py-1 pr-2 text-right">{t("export.columns.quantity")}</th>
            <th className="py-1">{t("export.columns.status")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-black/30 align-top break-inside-avoid">
              <td className="py-1 pr-2 font-mono">{o.number}</td>
              <td className="py-1 pr-2 whitespace-nowrap">{time(o.created_at)}</td>
              <td className="py-1 pr-2">{o.client_name}</td>
              <td className="py-1 pr-2">
                {o.dish_name}
                {o.comment ? <span className="block text-xs italic">“{o.comment}”</span> : null}
              </td>
              <td className="py-1 pr-2 text-right">{o.quantity}</td>
              <td className="py-1">{t(`orderStatus.${o.status}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
