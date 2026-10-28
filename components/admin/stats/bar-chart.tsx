"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

export type Bar = { key: string; label: string; short: string; value: number; detail?: string };

// Single-series column chart: one hue, no legend (the title names it), a tooltip per bar and a table view.
export function ColumnChart({
  bars,
  title,
  valueLabel,
  labelEvery = 1,
}: {
  bars: Bar[];
  title: string;
  valueLabel: (value: number) => string;
  labelEvery?: number;
}) {
  const t = useTranslations("stats");
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const ticks = niceTicks(max);
  const top = ticks.at(-1)!;

  return (
    <figure className="grid gap-3" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="font-heading text-lg font-bold">
        {title}
      </figcaption>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 pt-3">
        <div className="relative h-48 w-6 text-right text-xs text-muted-foreground tabular-nums" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(tick / top) * 100}%` }}>
              {tick}
            </span>
          ))}
        </div>
        <div className="relative h-48" onMouseLeave={() => setHover(null)}>
          {ticks.map((tick) => (
            <span
              key={tick}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-foreground/10"
              style={{ bottom: `${(tick / top) * 100}%` }}
            />
          ))}
          <ol className="absolute inset-0 flex items-end gap-[2px]">
            {bars.map((bar, i) => (
              <li
                key={bar.key}
                className="relative flex h-full min-w-0 flex-1 items-end"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${bar.label}: ${valueLabel(bar.value)}`}
              >
                <span
                  className={cn(
                    "block w-full rounded-t-[4px] bg-primary transition-opacity",
                    hover !== null && hover !== i && "opacity-50",
                  )}
                  style={{ height: bar.value ? `max(2px, ${(bar.value / top) * 100}%)` : 0 }}
                />
              </li>
            ))}
          </ol>
          {hover !== null ? (
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-2 z-10 w-max max-w-48 -translate-x-1/2 -translate-y-full rounded-lg border-2 border-line bg-popover px-2.5 py-1.5 text-xs shadow-md"
              style={{ left: `${((hover + 0.5) / bars.length) * 100}%` }}
            >
              <p className="font-bold">{bars[hover].label}</p>
              <p className="text-muted-foreground">{valueLabel(bars[hover].value)}</p>
              {bars[hover].detail ? <p className="text-muted-foreground">{bars[hover].detail}</p> : null}
            </div>
          ) : null}
        </div>
        <span />
        <ol className="mt-1 flex gap-[2px] text-[0.65rem] text-muted-foreground" aria-hidden="true">
          {bars.map((bar, i) => (
            <li key={bar.key} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
              {i % labelEvery === 0 ? bar.short : ""}
            </li>
          ))}
        </ol>
      </div>
      <DataTable rows={bars.map((b) => [b.label, valueLabel(b.value)])} label={t("showTable")} />
    </figure>
  );
}

// Ranked horizontal bars with direct labels (the label and value sit next to each bar).
export function RankedBars({
  rows,
  title,
  valueLabel,
  empty,
}: {
  rows: { key: string; label: string; value: number }[];
  title: string;
  valueLabel: (value: number) => string;
  empty: string;
}) {
  const id = useId();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="grid content-start gap-3" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="font-heading text-lg font-bold">
        {title}
      </figcaption>
      {rows.length ? (
        <ol className="grid gap-2.5">
          {rows.map((row) => (
            <li key={row.key} className="grid gap-1" title={`${row.label}: ${valueLabel(row.value)}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-semibold">{row.label}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{valueLabel(row.value)}</span>
              </div>
              <span className="block h-2 rounded-full bg-muted" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </figure>
  );
}

function DataTable({ rows, label }: { rows: string[][]; label: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-muted-foreground">{label}</summary>
      <table className="mt-2 w-full max-w-sm text-left">
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a} className="border-b border-border">
              <th scope="row" className="py-1 pr-4 font-normal">
                {a}
              </th>
              <td className="py-1 text-right tabular-nums">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function niceTicks(max: number): number[] {
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? pow * 10;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step - 1e-9; v += step) ticks.push(Math.round(v));
  if (ticks.at(-1)! < max) ticks.push(ticks.at(-1)! + step);
  return ticks;
}
