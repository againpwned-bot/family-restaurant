"use client";

import {
  BookmarkPlus,
  CalendarSync,
  ChevronLeft,
  ChevronRight,
  Eraser,
  LayoutTemplate,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  applyMenuTemplate,
  clearMenuDay,
  copyMenuDays,
  deleteMenuTemplate,
  fetchPlanner,
  saveMenuTemplate,
  setMenuPlan,
} from "@/app/actions/planner";
import { DishPhoto } from "@/components/dish/dish-photo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRealtime } from "@/hooks/use-realtime";
import { safe, type ActionResult } from "@/lib/action-result";
import { KITCHEN_TZ, addDays, dayAsDate } from "@/lib/dates";
import { matches } from "@/lib/search";
import { cn } from "@/lib/utils";

type PlannerDish = { id: string; name: string; photo_path: string | null; photo_blur: string | null };
type Template = { id: string; name: string; dish_ids: string[] };
type PlannerData = { plan: { day: string; dish_id: string }[]; templates: Template[]; dishes: PlannerDish[] };

export function MenuPlanner({ from, today, initial }: { from: string; today: string; initial: PlannerData }) {
  const t = useTranslations();
  const format = useFormatter();
  const [data, setData] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(from, i)), [from]);
  const dishById = useMemo(() => new Map(data.dishes.map((d) => [d.id, d])), [data.dishes]);
  const planByDay = useMemo(() => {
    const map = new Map<string, Set<string>>(days.map((d) => [d, new Set()]));
    for (const p of data.plan) map.get(p.day)?.add(p.dish_id);
    return map;
  }, [data.plan, days]);

  const refetch = useCallback(async () => {
    const { data: next } = await safe(fetchPlanner(from, 7));
    if (next) setData(next);
  }, [from]);

  useRealtime(
    "planner",
    [{ table: "menu_plan" }, { table: "dishes" }],
    () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void refetch(), 250);
    },
    refetch,
  );

  async function run<T>(call: Promise<ActionResult<T>>, success?: (value: T) => string) {
    setBusy(true);
    const { data: value, error } = await safe(call);
    setBusy(false);
    if (error) {
      toast.error(t(`errors.db.${error.message}`));
      return null;
    }
    if (success) toast.success(success(value as T));
    void refetch();
    return value as T;
  }

  async function toggle(day: string, dishId: string, on: boolean) {
    setData((d) => ({
      ...d,
      plan: on
        ? [...d.plan, { day, dish_id: dishId }]
        : d.plan.filter((p) => !(p.day === day && p.dish_id === dishId)),
    }));
    const { error } = await safe(setMenuPlan(day, dishId, on));
    if (error) {
      toast.error(t(`errors.db.${error.message}`));
      void refetch();
    }
  }

  const short = (day: string) => format.dateTime(dayAsDate(day), { day: "numeric", month: "short", timeZone: KITCHEN_TZ });
  const weekLabel = `${short(days[0])} – ${short(days[6])}`;

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border-2 border-line bg-card p-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label={t("planner.previousWeek")}>
            <Link href={`/admin/planner?week=${addDays(from, -7)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-36 px-2 text-center text-sm font-bold">{weekLabel}</span>
          <Button asChild variant="ghost" size="icon-sm" aria-label={t("planner.nextWeek")}>
            <Link href={`/admin/planner?week=${addDays(from, 7)}`}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/planner">{t("planner.thisWeek")}</Link>
        </Button>
        <Button
          variant="outline"
          className="sm:ml-auto"
          disabled={busy || days[6] < today}
          onClick={() =>
            void run(copyMenuDays(addDays(from, -7), from, 7), (n) => t("planner.copiedWeek", { count: n }))
          }
        >
          {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <CalendarSync aria-hidden="true" />}
          {t("planner.copyLastWeek")}
        </Button>
      </div>

      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {days.map((day) => {
          const ids = [...(planByDay.get(day) ?? [])].filter((id) => dishById.has(id));
          const past = day < today;
          const isToday = day === today;
          return (
            <li
              key={day}
              className={cn(
                "flex min-h-44 flex-col gap-3 rounded-[1.5rem] bg-card p-4 sticker",
                isToday && "ring-3 ring-gold",
                past && "opacity-70",
              )}
            >
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading text-xl leading-tight font-black capitalize">
                    {format.dateTime(dayAsDate(day), { weekday: "long", timeZone: KITCHEN_TZ })}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {format.dateTime(dayAsDate(day), { day: "numeric", month: "long", timeZone: KITCHEN_TZ })}
                    {isToday ? (
                      <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-gold-foreground">
                        {t("common.today")}
                      </span>
                    ) : null}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t("planner.dayActions")}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {!past ? (
                      <DropdownMenuItem onSelect={() => setEditing(day)}>
                        <Pencil aria-hidden="true" />
                        {t("planner.edit")}
                      </DropdownMenuItem>
                    ) : null}
                    {!past && data.templates.length ? (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <LayoutTemplate aria-hidden="true" />
                          {t("planner.applyTemplate")}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-52">
                          {data.templates.map((tpl) => (
                            <DropdownMenuItem
                              key={tpl.id}
                              onSelect={() =>
                                void run(applyMenuTemplate(tpl.id, day), (n) =>
                                  t("planner.templateApplied", { name: tpl.name, count: n }),
                                )
                              }
                            >
                              {tpl.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ) : null}
                    {!past && day !== days[6] ? (
                      <DropdownMenuItem
                        disabled={!ids.length}
                        onSelect={() =>
                          void run(copyMenuDays(day, addDays(day, 1), 1), (n) => t("planner.copiedDay", { count: n }))
                        }
                      >
                        <CalendarSync aria-hidden="true" />
                        {t("planner.copyToNextDay")}
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem disabled={!ids.length} onSelect={() => setSavingTemplate(day)}>
                      <BookmarkPlus aria-hidden="true" />
                      {t("planner.saveTemplate")}
                    </DropdownMenuItem>
                    {!past ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={!ids.length}
                          onSelect={() => void run(clearMenuDay(day), () => t("planner.cleared"))}
                        >
                          <Eraser aria-hidden="true" />
                          {t("planner.clear")}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </header>

              {ids.length ? (
                <ul className="grid gap-1.5">
                  {ids
                    .map((id) => dishById.get(id)!)
                    .sort((a, b) => a.name.localeCompare(b.name, "ro"))
                    .map((dish) => (
                      <li key={dish.id} className="flex items-center gap-2 rounded-xl bg-muted/60 p-1.5 pr-1">
                        <span className="relative size-8 shrink-0 overflow-hidden rounded-lg border border-line">
                          <DishPhoto dish={dish} sizes="32px" quality={60} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{dish.name}</span>
                        {!past ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("planner.remove", { name: dish.name })}
                            onClick={() => void toggle(day, dish.id, false)}
                          >
                            <X />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="flex-1 font-hand text-xl font-bold text-muted-foreground">{t("planner.empty")}</p>
              )}

              {!past ? (
                <Button variant="outline" size="sm" className="mt-auto self-start" onClick={() => setEditing(day)}>
                  <Pencil aria-hidden="true" />
                  {t("planner.edit")}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>

      <section aria-labelledby="templates-title" className="grid gap-3 rounded-[1.5rem] bg-card p-4 sticker sm:p-5">
        <div>
          <h2 id="templates-title" className="font-heading text-lg font-bold">
            {t("planner.templates")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("planner.templatesHint")}</p>
        </div>
        {data.templates.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.templates.map((tpl) => {
              const names = tpl.dish_ids.map((id) => dishById.get(id)?.name).filter(Boolean);
              return (
                <li key={tpl.id} className="flex items-start gap-2 rounded-xl border-2 border-line p-3">
                  <LayoutTemplate className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{tpl.name}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{names.join(", ")}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("planner.deleteTemplate", { name: tpl.name })}
                    onClick={() => void run(deleteMenuTemplate(tpl.id), () => t("planner.templateDeleted"))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("planner.noTemplates")}</p>
        )}
      </section>

      {editing ? (
        <EditDayDialog
          day={editing}
          dishes={data.dishes}
          selected={planByDay.get(editing) ?? new Set()}
          onToggle={(id, on) => void toggle(editing, id, on)}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {savingTemplate ? (
        <SaveTemplateDialog
          onClose={() => setSavingTemplate(null)}
          onSave={async (name) => {
            const saved = await run(saveMenuTemplate(name, savingTemplate), () => t("planner.templateSaved", { name }));
            if (saved) setSavingTemplate(null);
          }}
        />
      ) : null}
    </div>
  );
}

function EditDayDialog({
  day,
  dishes,
  selected,
  onToggle,
  onClose,
}: {
  day: string;
  dishes: PlannerDish[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const [query, setQuery] = useState("");
  const visible = dishes.filter((d) => matches(query, d.name));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="grid max-h-[85dvh] grid-rows-[auto_auto_minmax(0,1fr)_auto] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl capitalize">
            {format.dateTime(dayAsDate(day), { weekday: "long", day: "numeric", month: "long", timeZone: KITCHEN_TZ })}
          </DialogTitle>
          <DialogDescription>{t("planner.editHint", { count: selected.size })}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("adminDishes.searchPlaceholder")}
            aria-label={t("common.search")}
            className="pl-9"
          />
        </div>
        <ul className="-mx-2 grid content-start gap-0.5 overflow-y-auto px-2">
          {visible.map((dish) => {
            const id = `plan-${day}-${dish.id}`;
            return (
              <li key={dish.id}>
                <Label
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl p-2 font-normal hover:bg-muted"
                >
                  <Checkbox
                    id={id}
                    checked={selected.has(dish.id)}
                    onCheckedChange={(v) => onToggle(dish.id, v === true)}
                  />
                  <span className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-line">
                    <DishPhoto dish={dish} sizes="36px" quality={60} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{dish.name}</span>
                </Label>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveTemplateDialog({ onSave, onClose }: { onSave: (name: string) => Promise<void>; onClose: () => void }) {
  const t = useTranslations();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setPending(true);
            await onSave(name.trim());
            setPending(false);
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{t("planner.saveTemplate")}</DialogTitle>
            <DialogDescription>{t("planner.saveTemplateHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="template-name">{t("planner.templateName")}</Label>
            <Input
              id="template-name"
              value={name}
              maxLength={60}
              autoFocus
              placeholder={t("planner.templateNamePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
