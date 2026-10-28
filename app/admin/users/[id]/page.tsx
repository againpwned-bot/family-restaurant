import { ArrowLeft, Camera, History, Wheat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { STATUS_TONE } from "@/components/admin/history/status-tone";
import { UserAvatarControl, UserDietControl, UserDisableControl } from "@/components/admin/users/user-controls";
import { UserAvatar } from "@/components/layout/user-avatar";
import { Section } from "@/components/settings/settings-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/dal";
import { KITCHEN_TZ } from "@/lib/dates";
import { row } from "@/lib/server/database";
import { asUser, getDb } from "@/lib/server/db";
import { userActivity } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminUsers");
  return { title: t("activity") };
}

export default async function UserActivityPage({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireProfile({ roles: ["owner"] });
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await asUser(me.id, (tx) => userActivity(tx, id));
  if (!data) notFound();
  const auth = await row<{ last_sign_in_at: string | null }>(
    await getDb(),
    "select last_sign_in_at from auth.users where id = $1",
    [id],
  );
  const t = await getTranslations();
  const format = await getFormatter();
  const { profile, totals, favourites, recent } = data;
  const date = (iso: string | null, withTime = false) =>
    iso
      ? format.dateTime(new Date(iso), {
          day: "numeric",
          month: "short",
          year: "numeric",
          ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
          timeZone: KITCHEN_TZ,
        })
      : t("userActivity.never");
  const maxFav = Math.max(1, ...favourites.map((f) => f.portions));

  return (
    <div className="grid grid-cols-1 gap-5">
      <Button asChild variant="ghost" className="-ml-3 justify-self-start">
        <Link href="/admin/users">
          <ArrowLeft aria-hidden="true" />
          {t("userActivity.back")}
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-4">
        <UserAvatar name={profile.display_name} path={profile.avatar_path} className="size-20 border-2 border-line text-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-4xl leading-tight font-black">{profile.display_name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            @{profile.username} · {t(`roles.${profile.role}`)}
            {profile.disabled_at ? <Badge variant="destructive">{t("adminUsers.disabled")}</Badge> : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("userActivity.lastSignIn", { when: date(auth?.last_sign_in_at ?? null, true) })} ·{" "}
            {t("userActivity.member", { when: date(profile.created_at) })}
          </p>
        </div>
        {profile.id !== me.id ? (
          <UserDisableControl id={profile.id} name={profile.display_name} disabled={!!profile.disabled_at} />
        ) : null}
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [t("userActivity.orders"), totals.orders],
          [t("userActivity.portions"), totals.portions],
          [t("userActivity.handedOver"), totals.handed_over],
          [t("userActivity.rejectedCancelled"), totals.rejected + totals.cancelled],
        ].map(([label, value]) => (
          <div key={String(label)} className="grid gap-1 rounded-[1.5rem] bg-card p-4 sticker">
            <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
            <dd className="font-heading text-3xl font-black tabular-nums">{format.number(Number(value))}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="grid gap-3 rounded-[1.5rem] bg-card p-4 sticker sm:p-5">
          <h2 className="font-heading text-lg font-bold">{t("userActivity.favourites")}</h2>
          {favourites.length ? (
            <ol className="grid gap-2.5">
              {favourites.map((f) => (
                <li key={f.name} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-semibold">{f.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {t("stats.portionsValue", { count: f.portions })}
                    </span>
                  </div>
                  <span className="block h-2 rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(f.portions / maxFav) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t("userActivity.noOrders")}</p>
          )}
        </section>

        <section className="grid gap-3 rounded-[1.5rem] bg-card p-4 sticker sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-bold">{t("userActivity.recent")}</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/history?person=${profile.id}`}>
                <History aria-hidden="true" />
                {t("userActivity.allOrders")}
              </Link>
            </Button>
          </div>
          {recent.length ? (
            <ul className="grid gap-1.5">
              {recent.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {o.dish_name} <span className="font-mono text-brand-ink">× {o.quantity}</span>
                  </span>
                  <span className="text-muted-foreground">{date(o.created_at, true)}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STATUS_TONE[o.status])}>
                    {t(`orderStatus.${o.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("userActivity.noOrders")}</p>
          )}
        </section>

        <Section icon={<Camera />} title={t("avatar.title")}>
          <UserAvatarControl id={profile.id} name={profile.display_name} path={profile.avatar_path} />
        </Section>

        <Section icon={<Wheat />} title={t("dietEditor.title")} description={t("dietEditor.ownerDescription")}>
          <UserDietControl id={profile.id} allergies={profile.allergies} tags={profile.diet_tags} />
        </Section>
      </div>
    </div>
  );
}
