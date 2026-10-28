"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { ColumnChart, RankedBars } from "@/components/admin/stats/bar-chart";
import { KITCHEN_TZ, dayAsDate } from "@/lib/dates";
import { STATS_RANGES as RANGES } from "@/lib/stats";
import { cn } from "@/lib/utils";

type Stats = {
  totals: {
    orders: number;
    portions: number;
    handed_over: number;
    rejected: number;
    cancelled: number;
    people: number;
    avg_ready_minutes: number | null;
  };
  perDay: { day: string; orders: number; portions: number }[];
  byHour: { hour: number; orders: number }[];
  topDishes: { name: string; orders: number; portions: number }[];
  topPeople: { id: string; name: string; orders: number }[];
};


export function StatsView({ stats, range }: { stats: Stats; range: number }) {
  const t = useTranslations("stats");
  const format = useFormatter();
  const { totals } = stats;
  const orders = (n: number) => t("ordersValue", { count: n });
  const pct = (n: number) =>
    totals.orders ? format.number(n / totals.orders, { style: "percent", maximumFractionDigits: 0 }) : "–";

  const tiles = [
    { label: t("tiles.orders"), value: format.number(totals.orders), note: t("tiles.portions", { count: totals.portions }) },
    { label: t("tiles.people"), value: format.number(totals.people) },
    {
      label: t("tiles.avgReady"),
      value: totals.avg_ready_minutes !== null ? t("minutes", { minutes: totals.avg_ready_minutes }) : "–",
      note: t("tiles.avgReadyNote"),
    },
    {
      label: t("tiles.handedOver"),
      value: pct(totals.handed_over),
      note: t("tiles.rejectedCancelled", { rejected: totals.rejected, cancelled: totals.cancelled }),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <div role="group" aria-label={t("range")} className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border-2 border-line bg-card p-1">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/stats?range=${r}`}
            aria-current={r === range ? "page" : undefined}
            className={cn(
              "h-9 shrink-0 rounded-full px-4 text-sm leading-9 font-bold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              r === range ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("lastDays", { days: r })}
          </Link>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="grid content-start gap-1 rounded-[1.5rem] bg-card p-4 sticker">
            <dt className="text-sm font-semibold text-muted-foreground">{tile.label}</dt>
            <dd className="font-heading text-3xl font-black tabular-nums sm:text-4xl">{tile.value}</dd>
            {tile.note ? <dd className="text-xs text-muted-foreground">{tile.note}</dd> : null}
          </div>
        ))}
      </dl>

      <section className="rounded-[1.5rem] bg-card p-4 sticker sm:p-5">
        <ColumnChart
          title={t("perDay")}
          valueLabel={orders}
          labelEvery={range <= 7 ? 1 : range <= 30 ? 5 : 15}
          bars={stats.perDay.map((d) => ({
            key: d.day,
            label: format.dateTime(dayAsDate(d.day), { weekday: "short", day: "numeric", month: "short", timeZone: KITCHEN_TZ }),
            short: format.dateTime(dayAsDate(d.day), { day: "numeric", month: range <= 7 ? undefined : "numeric", timeZone: KITCHEN_TZ }),
            value: d.orders,
            detail: t("portionsValue", { count: d.portions }),
          }))}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[1.5rem] bg-card p-4 sticker sm:p-5">
          <ColumnChart
            title={t("byHour")}
            valueLabel={orders}
            labelEvery={3}
            bars={stats.byHour.map((h) => ({
              key: String(h.hour),
              label: t("hourRange", { from: String(h.hour).padStart(2, "0"), to: String((h.hour + 1) % 24).padStart(2, "0") }),
              short: String(h.hour).padStart(2, "0"),
              value: h.orders,
            }))}
          />
        </section>
        <section className="rounded-[1.5rem] bg-card p-4 sticker sm:p-5">
          <RankedBars
            title={t("topDishes")}
            empty={t("empty")}
            valueLabel={(n) => t("portionsValue", { count: n })}
            rows={stats.topDishes.map((d) => ({ key: d.name, label: d.name, value: d.portions }))}
          />
        </section>
        <section className="rounded-[1.5rem] bg-card p-4 sticker sm:p-5 lg:col-span-2">
          <RankedBars
            title={t("topPeople")}
            empty={t("empty")}
            valueLabel={orders}
            rows={stats.topPeople.map((p) => ({ key: p.id, label: p.name, value: p.orders }))}
          />
        </section>
      </div>
    </div>
  );
}
