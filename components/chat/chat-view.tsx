"use client";

import { ArrowLeft, LoaderCircle, SendHorizontal, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { fetchChatMessages, fetchChatOverview, markChatRead, sendChatMessage } from "@/app/actions/chat";
import { CHAT_READ_EVENT } from "@/components/chat/chat-unread";
import { UserAvatar } from "@/components/layout/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRealtime } from "@/hooks/use-realtime";
import { safe } from "@/lib/action-result";
import { setOpenConversation } from "@/lib/chat-focus";
import { KITCHEN_TZ, kitchenDate } from "@/lib/dates";
import type { AppRole, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type Person = { id: string; display_name: string; avatar_path: string | null; role: AppRole };
type Summary = { conversation: string; last_at: string; last_body: string; last_sender: string; unread: number };

const GROUP = "all";
const PAGE = 50;

function dmWith(me: string, other: string) {
  return `dm:${me < other ? me : other}:${me < other ? other : me}`;
}

function otherIn(conversation: string, me: string) {
  return conversation.slice(3).split(":").find((id) => id !== me) ?? null;
}

export function ChatView({
  meId,
  basePath,
  initialConversations,
  people: initialPeople,
  initialOpen,
  initialMessages,
}: {
  meId: string;
  basePath: string;
  initialConversations: Summary[];
  people: Person[];
  initialOpen: string | null;
  initialMessages: ChatMessage[];
}) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const [summaries, setSummaries] = useState(() =>
    initialConversations.map((s) => (s.conversation === initialOpen ? { ...s, unread: 0 } : s)),
  );
  const [people, setPeople] = useState(initialPeople);
  const [open, setOpen] = useState<string | null>(initialOpen);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [hasOlder, setHasOlder] = useState(initialMessages.length === PAGE);
  const [loading, setLoading] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(open);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const summaryOf = useMemo(() => new Map(summaries.map((s) => [s.conversation, s])), [summaries]);

  const entries = useMemo(() => {
    const list = [
      { conversation: GROUP, person: null as Person | null },
      ...people.filter((p) => p.id !== meId).map((p) => ({ conversation: dmWith(meId, p.id), person: p })),
    ];
    const last = (c: string) => summaryOf.get(c)?.last_at ?? "";
    return [list[0], ...list.slice(1).sort((a, b) => last(b.conversation).localeCompare(last(a.conversation)))];
  }, [people, meId, summaryOf]);

  const refreshOverview = useCallback(async () => {
    const { data } = await safe(fetchChatOverview());
    if (!data) return;
    setSummaries(data.conversations.map((s) => (s.conversation === openRef.current ? { ...s, unread: 0 } : s)));
    setPeople(data.people);
  }, []);

  const markRead = useCallback(async (conversation: string) => {
    await safe(markChatRead(conversation));
    window.dispatchEvent(new Event(CHAT_READ_EVENT));
  }, []);

  useEffect(() => {
    openRef.current = open;
    setOpenConversation(open);
    const url = open ? `${basePath}?c=${encodeURIComponent(open)}` : basePath;
    window.history.replaceState(window.history.state, "", url);
    if (open) void markRead(open);
    return () => setOpenConversation(null);
  }, [open, basePath, markRead]);

  async function select(conversation: string) {
    if (conversation === open) return;
    setOpen(conversation);
    setSummaries((list) => list.map((s) => (s.conversation === conversation ? { ...s, unread: 0 } : s)));
    setMessages([]);
    setLoading(true);
    const { data } = await safe(fetchChatMessages(conversation, null));
    setLoading(false);
    if (openRef.current !== conversation) return;
    setMessages(data ?? []);
    setHasOlder((data?.length ?? 0) === PAGE);
  }

  const resync = useCallback(async () => {
    void refreshOverview();
    const current = openRef.current;
    if (!current) return;
    const { data } = await safe(fetchChatMessages(current, null));
    if (data && openRef.current === current) setMessages(data);
  }, [refreshOverview]);

  useRealtime(
    "chat",
    [{ table: "chat_messages" }],
    (_table, payload) => {
      if (payload.eventType === "INSERT") {
        const message = payload.new as unknown as ChatMessage;
        if (message.conversation === openRef.current) {
          setMessages((list) => (list.some((m) => m.id === message.id) ? list : [...list, message]));
          if (document.visibilityState === "visible") void markRead(message.conversation);
        }
      }
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void refreshOverview(), 300);
    },
    resync,
  );

  async function loadOlder() {
    if (!open || !messages.length) return;
    const { data } = await safe(fetchChatMessages(open, messages[0].created_at));
    if (!data) return;
    setMessages((list) => [...data, ...list]);
    setHasOlder(data.length === PAGE);
  }

  const title = (conversation: string) => {
    if (conversation === GROUP) return t("group");
    const other = otherIn(conversation, meId);
    return (other && byId.get(other)?.display_name) ?? t("someone");
  };

  return (
    <div className="grid h-[calc(100dvh-18.5rem-env(safe-area-inset-bottom))] min-h-[22rem] grid-cols-1 overflow-hidden rounded-[1.75rem] border-2 border-line bg-card shadow-[4px_4px_0_var(--shadow-hard)] lg:h-[calc(100dvh-14rem)] lg:grid-cols-[18rem_minmax(0,1fr)]">
      <nav
        aria-label={t("conversations")}
        className={cn("min-h-0 overflow-y-auto border-line lg:block lg:border-r-2", open && "hidden")}
      >
        <ul className="grid gap-0.5 p-2">
          {entries.map(({ conversation, person }) => {
            const summary = summaryOf.get(conversation);
            const active = conversation === open;
            return (
              <li key={conversation}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => void select(conversation)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl p-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "bg-foreground text-background" : "hover:bg-muted",
                  )}
                >
                  {person ? (
                    <UserAvatar name={person.display_name} path={person.avatar_path} className="size-11" />
                  ) : (
                    <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-line bg-gold text-gold-foreground">
                      <Users className="size-5" aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-bold">{title(conversation)}</span>
                      {summary ? (
                        <span className={cn("shrink-0 text-xs", active ? "text-background/70" : "text-muted-foreground")}>
                          {shortTime(summary.last_at, format)}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("min-w-0 flex-1 truncate text-sm", active ? "text-background/70" : "text-muted-foreground")}
                      >
                        {summary
                          ? `${summary.last_sender === meId ? `${t("you")}: ` : ""}${summary.last_body}`
                          : conversation === GROUP
                            ? t("groupHint")
                            : t("startHint")}
                      </span>
                      {summary?.unread ? (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[0.65rem] font-black text-gold-foreground">
                          <span aria-hidden="true">{summary.unread}</span>
                          <span className="sr-only">{t("unread", { count: summary.unread })}</span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {open ? (
        <Thread
          key={open}
          meId={meId}
          conversation={open}
          title={title(open)}
          person={open === GROUP ? null : (byId.get(otherIn(open, meId) ?? "") ?? null)}
          people={byId}
          messages={messages}
          loading={loading}
          hasOlder={hasOlder}
          onOlder={loadOlder}
          onBack={() => setOpen(null)}
          onSent={(message) => {
            setMessages((list) => (list.some((m) => m.id === message.id) ? list : [...list, message]));
            void refreshOverview();
          }}
        />
      ) : (
        <div className="hidden place-items-center p-8 text-center lg:grid">
          <p className="font-hand text-2xl font-bold text-muted-foreground">{t("pick")}</p>
        </div>
      )}
    </div>
  );
}

function shortTime(iso: string, format: ReturnType<typeof useFormatter>) {
  const date = new Date(iso);
  return kitchenDate(date) === kitchenDate()
    ? format.dateTime(date, { hour: "2-digit", minute: "2-digit", timeZone: KITCHEN_TZ })
    : format.dateTime(date, { day: "numeric", month: "short", timeZone: KITCHEN_TZ });
}

function Thread({
  meId,
  conversation,
  title,
  person,
  people,
  messages,
  loading,
  hasOlder,
  onOlder,
  onBack,
  onSent,
}: {
  meId: string;
  conversation: string;
  title: string;
  person: Person | null;
  people: Map<string, Person>;
  messages: ChatMessage[];
  loading: boolean;
  hasOlder: boolean;
  onOlder: () => Promise<void>;
  onBack: () => void;
  onSent: (message: ChatMessage) => void;
}) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastId = messages.at(-1)?.id;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, loading]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const to = conversation === "all" ? null : otherIn(conversation, meId);
    const { data, error } = await safe(sendChatMessage(to, body));
    setSending(false);
    if (error || !data) return void toast.error(t("sendError"));
    setText("");
    stick.current = true;
    onSent(data);
  }

  return (
    <section aria-label={title} className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
      <header className="flex items-center gap-3 border-b-2 border-line p-3">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t("back")} onClick={onBack}>
          <ArrowLeft />
        </Button>
        {person ? (
          <UserAvatar name={person.display_name} path={person.avatar_path} className="size-9" />
        ) : (
          <span className="grid size-9 place-items-center rounded-full border-2 border-line bg-gold text-gold-foreground">
            <Users className="size-4" aria-hidden="true" />
          </span>
        )}
        <h2 className="truncate font-heading text-lg font-bold">{title}</h2>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 overflow-y-auto px-3 py-4"
        aria-live="polite"
      >
        {hasOlder ? (
          <div className="mb-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                stick.current = false;
                void onOlder();
              }}
            >
              {t("older")}
            </Button>
          </div>
        ) : null}
        {loading ? (
          <LoaderCircle className="mx-auto size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center font-hand text-2xl font-bold text-muted-foreground">{t("empty")}</p>
        ) : (
          <ol className="grid gap-1.5">
            {messages.map((m, i) => {
              const mine = m.sender_id === meId;
              const sender = people.get(m.sender_id);
              const previous = messages[i - 1];
              const showDay =
                !previous || kitchenDate(new Date(previous.created_at)) !== kitchenDate(new Date(m.created_at));
              const firstOfRun = showDay || messages[i - 1]?.sender_id !== m.sender_id;
              return (
                <li key={m.id} className="grid gap-1.5">
                  {showDay ? (
                    <p className="my-2 text-center text-xs font-semibold text-muted-foreground">
                      {format.dateTime(new Date(m.created_at), {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: KITCHEN_TZ,
                      })}
                    </p>
                  ) : null}
                  <div className={cn("flex items-end gap-2", mine && "flex-row-reverse", !firstOfRun && "-mt-0.5")}>
                    {!mine && conversation === "all" ? (
                      firstOfRun ? (
                        <UserAvatar name={sender?.display_name ?? "?"} path={sender?.avatar_path} className="size-7" />
                      ) : (
                        <span className="w-7 shrink-0" />
                      )
                    ) : null}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2",
                        mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted",
                      )}
                    >
                      {!mine && conversation === "all" && firstOfRun ? (
                        <p className="text-xs font-bold text-brand-ink">{sender?.display_name ?? t("someone")}</p>
                      ) : null}
                      <p className="break-words whitespace-pre-wrap">{m.body}</p>
                      <p className={cn("text-right text-[0.65rem]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {format.dateTime(new Date(m.created_at), { hour: "2-digit", minute: "2-digit", timeZone: KITCHEN_TZ })}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t-2 border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          maxLength={2000}
          rows={1}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="max-h-32 min-h-11 resize-none"
        />
        <Button type="submit" size="icon-lg" disabled={!text.trim() || sending} aria-label={t("send")}>
          {sending ? <LoaderCircle className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </form>
    </section>
  );
}
