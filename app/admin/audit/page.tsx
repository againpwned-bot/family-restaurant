import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/dal";
import { KITCHEN_TZ } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { AUDIT_ENTITIES, auditEntries, type AuditEntity, type AuditRow } from "@/lib/server/queries";
import type { Json } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 50;
const HIDDEN_FIELDS = new Set(["photo_path"]);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("audit");
  return { title: t("title") };
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const me = await requireProfile({ roles: ["owner"] });
  const t = await getTranslations();
  const format = await getFormatter();
  const params = await searchParams;
  const entity = (AUDIT_ENTITIES as readonly string[]).includes(String(params.entity))
    ? (params.entity as AuditEntity)
    : null;
  const before = typeof params.before === "string" && !Number.isNaN(Date.parse(params.before)) ? params.before : null;
  const entries = await asUser(me.id, (tx) => auditEntries(tx, entity, before, PAGE));

  const tr = (key: string, values?: Record<string, string | number>) =>
    t.has(key as Parameters<typeof t>[0]) ? t(key as Parameters<typeof t>[0], values) : null;

  const value = (v: Json, field: string): string => {
    if (v === null || v === "" || (Array.isArray(v) && !v.length)) return "—";
    if (typeof v === "boolean") return t(v ? "common.yes" : "common.no");
    if (Array.isArray(v)) {
      const ns = field === "diet_tags" ? "dietTags" : field === "tags" ? "dishTags" : null;
      return v.map((x) => (ns ? (tr(`${ns}.${x}`) ?? String(x)) : String(x))).join(", ");
    }
    if (field === "role") return tr(`roles.${v}`) ?? String(v);
    if (field === "meal") return tr(`meals.${v}`) ?? String(v);
    if (typeof v === "string" && /^\d{2}:\d{2}:\d{2}$/.test(v)) return v.slice(0, 5);
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      return format.dateTime(new Date(v), { dateStyle: "short", timeStyle: "short", timeZone: KITCHEN_TZ });
    }
    const text = typeof v === "object" ? JSON.stringify(v) : String(v);
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  };

  const describe = (e: AuditRow) => {
    const label = e.label ?? "";
    if (e.entity === "order") return `${label} · ${tr(`history.events.${e.action}`) ?? e.action}`;
    return tr(`audit.actions.${e.entity}.${e.action}`, { label }) ?? `${e.entity} ${e.action} ${label}`;
  };

  const changes = (e: AuditRow) => {
    if (e.entity === "order" || !e.changes || typeof e.changes !== "object" || Array.isArray(e.changes)) return [];
    return Object.entries(e.changes as Record<string, { from: Json; to: Json }>)
      .filter(([field]) => !HIDDEN_FIELDS.has(field))
      .map(([field, change]) => ({
        field: tr(`audit.fields.${field}`) ?? field,
        from: value(change?.from ?? null, field),
        to: value(change?.to ?? null, field),
      }));
  };

  const filterHref = (value: AuditEntity | null) => (value ? `/admin/audit?entity=${value}` : "/admin/audit");

  return (
    <>
      <PageHeader title={t("audit.title")} description={t("audit.description")} />
      <div className="grid grid-cols-1 gap-5">
        <nav aria-label={t("audit.filter")} className="flex flex-wrap gap-2">
          {[null, ...AUDIT_ENTITIES].map((value) => (
            <Link
              key={value ?? "all"}
              href={filterHref(value)}
              aria-current={entity === value ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full border-2 border-line px-3.5 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                entity === value ? "bg-foreground text-background" : "bg-card hover:bg-muted",
              )}
            >
              {t(`audit.entities.${value ?? "all"}`)}
            </Link>
          ))}
        </nav>

        {entries.length ? (
          <ol className="grid gap-2">
            {entries.map((e) => {
              const list = changes(e);
              return (
                <li key={e.id} className="grid gap-1 rounded-2xl border-2 border-line bg-card p-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <div className="text-sm text-muted-foreground">
                    <time dateTime={e.created_at}>
                      {format.dateTime(new Date(e.created_at), {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: KITCHEN_TZ,
                      })}
                    </time>
                    <p className="font-semibold text-foreground">{e.actor_name ?? t("audit.system")}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{describe(e)}</p>
                    {list.length ? (
                      <ul className="mt-1 grid gap-0.5 text-sm">
                        {list.map((c) => (
                          <li key={c.field} className="break-words">
                            <span className="text-muted-foreground">{c.field}:</span> {c.from}{" "}
                            <span aria-hidden="true">→</span>
                            <span className="sr-only">{t("audit.to")}</span> <span className="font-semibold">{c.to}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-[1.5rem] border-2 border-dashed border-line bg-card py-12 text-center font-hand text-2xl font-bold text-muted-foreground">
            {t("audit.empty")}
          </p>
        )}

        {entries.length === PAGE ? (
          <Button asChild variant="outline" className="justify-self-center">
            <Link
              href={`/admin/audit?${new URLSearchParams({
                ...(entity ? { entity } : {}),
                before: entries.at(-1)!.created_at,
              })}`}
            >
              {t("audit.older")}
            </Link>
          </Button>
        ) : null}
      </div>
    </>
  );
}
