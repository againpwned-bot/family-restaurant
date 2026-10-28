"use client";

import { BellOff, BellRing, ChevronDown, CircleAlert, LoaderCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { sendTestNotification } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { safe } from "@/lib/action-result";
import { currentPushState, disablePush, enablePush, type PushState } from "@/lib/push";

const subscribeNever = () => () => {};
type Browser = "firefox" | "android" | "chrome";
function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Android/.test(ua)) return "android";
  return "chrome";
}

export function usePushState({ deferred = false }: { deferred?: boolean } = {}) {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => void currentPushState().then((s) => alive && setState(s));
    if (!deferred) {
      check();
      return () => {
        alive = false;
      };
    }
    const schedule = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = schedule(check, { timeout: 4000 });
    return () => {
      alive = false;
      cancel(id as number);
    };
  }, [deferred]);
  return [state, setState] as const;
}

export function DeniedHelp({ onDismiss }: { onDismiss?: () => void }) {
  const t = useTranslations("push");
  const browser = useSyncExternalStore(subscribeNever, detectBrowser, () => "chrome" as Browser);
  const order: Browser[] = [browser, ...(["chrome", "firefox", "android"] as Browser[]).filter((b) => b !== browser)];
  const text = { chrome: t("deniedChrome"), firefox: t("deniedFirefox"), android: t("deniedAndroid") };
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-2xl border-2 border-line bg-gold-soft p-2 pl-3 text-sm text-gold-ink"
    >
      <details className="group/denied min-w-0 flex-1" open={!onDismiss}>
        <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 font-bold [&::-webkit-details-marker]:hidden">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{t("deniedTitle")}</span>
          <ChevronDown
            className="size-4 shrink-0 transition-transform duration-300 group-open/denied:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="grid gap-2 pt-2 pb-1">
          <p>{t("deniedText")}</p>
          <ul className="grid list-disc gap-1 pl-5">
            {order.map((b) => (
              <li key={b} className={b === browser ? "font-semibold" : undefined}>
                {text[b]}
              </li>
            ))}
          </ul>
          <p>{t("deniedFallback")}</p>
        </div>
      </details>
      {onDismiss ? (
        <Button variant="ghost" size="sm" className="shrink-0" onClick={onDismiss}>
          {t("promptDismiss")}
        </Button>
      ) : null}
    </div>
  );
}

export function PushToggle() {
  const t = useTranslations("push");
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);

  async function turnOn() {
    setBusy(true);
    try {
      const next = await enablePush();
      setState(next);
      if (next === "enabled") toast.success(t("enabledToast"));
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
      setState("disabled");
      toast.success(t("disabledToast"));
    } finally {
      setBusy(false);
    }
  }

  if (state === null) return <div className="h-11" aria-hidden="true" />;
  if (state === "unsupported") return <p className="text-sm text-muted-foreground">{t("unsupported")}</p>;
  if (state === "not-configured") return <p className="text-sm text-muted-foreground">{t("notConfigured")}</p>;
  if (state === "denied") return <DeniedHelp />;

  if (state === "enabled") {
    return (
      <div className="grid gap-3">
        <p className="flex items-center gap-2 font-semibold text-success" role="status">
          <BellRing className="size-4" aria-hidden="true" />
          {t("enabled")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              const { error } = await safe(sendTestNotification());
              if (error) toast.error(t("error"));
              else toast.success(t("testSent"));
            }}
          >
            <Send aria-hidden="true" />
            {t("test")}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => void turnOff()}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <BellOff aria-hidden="true" />}
            {t("disable")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button size="lg" disabled={busy} onClick={() => void turnOn()}>
      {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
      {busy ? t("enabling") : t("enable")}
    </Button>
  );
}
