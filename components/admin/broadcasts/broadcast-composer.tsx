"use client";

import { LoaderCircle, Megaphone, Send } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { fetchBroadcasts, sendBroadcast } from "@/app/actions/broadcasts";
import { UserAvatar } from "@/components/layout/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { safe } from "@/lib/action-result";
import { KITCHEN_TZ } from "@/lib/dates";
import type { Broadcast } from "@/lib/types";
import { cn } from "@/lib/utils";

type Audience = Broadcast["audience"];
type HistoryItem = Broadcast & { sender_name: string | null };
type Person = { id: string; display_name: string; avatar_path: string | null };

const AUDIENCES: Audience[] = ["everyone", "clients", "staff", "people"];

export function BroadcastComposer({ initialHistory, people }: { initialHistory: HistoryItem[]; people: Person[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const [history, setHistory] = useState(initialHistory);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("everyone");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const quick = [t("broadcasts.quick1"), t("broadcasts.quick2"), t("broadcasts.quick3")];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSending(true);
    const { data, error } = await safe(sendBroadcast({ title, body, audience, people: [...chosen] }));
    setSending(false);
    if (error || !data) return void toast.error(t(`errors.db.${error?.message ?? "unknown"}`));
    toast.success(t("broadcasts.sent", { count: data.recipient_count }));
    setTitle("");
    setBody("");
    const { data: list } = await safe(fetchBroadcasts());
    if (list) setHistory(list);
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <form onSubmit={submit} className="grid gap-4 rounded-[1.5rem] bg-card p-4 sticker sm:p-5">
        <div className="grid gap-2">
          <span className="text-sm font-medium">{t("broadcasts.quickLabel")}</span>
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <Button key={q} type="button" variant="outline" size="sm" onClick={() => setTitle(q)}>
                {q}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="b-title">{t("broadcasts.titleLabel")}</Label>
          <Input id="b-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="b-body">
            {t("broadcasts.bodyLabel")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
          </Label>
          <Textarea id="b-body" value={body} maxLength={300} rows={3} onChange={(e) => setBody(e.target.value)} />
          <p className="text-right text-xs text-muted-foreground">{body.length}/300</p>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t("broadcasts.audience")}</legend>
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={audience === a}
                onClick={() => setAudience(a)}
                className={cn(
                  "h-9 rounded-full border-2 border-line px-3.5 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-10",
                  audience === a ? "bg-foreground text-background" : "bg-card hover:bg-muted",
                )}
              >
                {t(`broadcasts.audiences.${a}`)}
              </button>
            ))}
          </div>
          {audience === "people" ? (
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {people.map((p) => (
                <li key={p.id}>
                  <Label className="flex cursor-pointer items-center gap-2 rounded-xl p-1.5 font-normal hover:bg-muted">
                    <Checkbox
                      checked={chosen.has(p.id)}
                      onCheckedChange={(v) =>
                        setChosen((set) => {
                          const next = new Set(set);
                          if (v === true) next.add(p.id);
                          else next.delete(p.id);
                          return next;
                        })
                      }
                    />
                    <UserAvatar name={p.display_name} path={p.avatar_path} className="size-7" />
                    <span className="truncate font-semibold">{p.display_name}</span>
                  </Label>
                </li>
              ))}
            </ul>
          ) : null}
        </fieldset>
        <p className="text-sm text-muted-foreground">{t("broadcasts.pushNote")}</p>
        <div>
          <Button type="submit" size="lg" disabled={sending || !title.trim() || (audience === "people" && !chosen.size)}>
            {sending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {t("broadcasts.send")}
          </Button>
        </div>
      </form>

      <section aria-labelledby="b-history" className="grid gap-3">
        <h2 id="b-history" className="font-heading text-xl font-bold">
          {t("broadcasts.history")}
        </h2>
        {history.length ? (
          <ul className="grid gap-2">
            {history.map((b) => (
              <li key={b.id} className="flex gap-3 rounded-2xl border-2 border-line bg-card p-3">
                <Megaphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold break-words">{b.title}</p>
                  {b.body ? <p className="text-sm break-words">{b.body}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format.dateTime(new Date(b.created_at), {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: KITCHEN_TZ,
                    })}{" "}
                    · {b.sender_name ?? "?"} · {t(`broadcasts.audiences.${b.audience}`)} ·{" "}
                    {t("broadcasts.recipients", { count: b.recipient_count })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("broadcasts.none")}</p>
        )}
      </section>
    </div>
  );
}
