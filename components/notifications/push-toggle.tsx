"use client";

import { BellOff, BellRing, CircleAlert, LoaderCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { currentPushState, disablePush, enablePush, type PushState } from "@/lib/push";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const subscribeNever = () => () => {};
type Browser = "firefox" | "android" | "chrome";
function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Android/.test(ua)) return "android";
  return "chrome";
}

/** Shared state hook: Settings toggle + the prompt card both use it. */
export function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => {
    let alive = true;
    void currentPushState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return [state, setState] as const;
}

export function DeniedHelp({ onDismiss }: { onDismiss?: () => void }) {
  const t = useTranslations("push");
  const browser = useSyncExternalStore(subscribeNever, detectBrowser, () => "chrome" as Browser);
  const order: Browser[] = [browser, ...(["chrome", "firefox", "android"] as Browser[]).filter((b) => b !== browser)];
  const text = { chrome: t("deniedChrome"), firefox: t("deniedFirefox"), android: t("deniedAndroid") };
  return (
    <div role="alert" className="grid gap-2 rounded-xl bg-gold-soft p-3 text-sm text-gold-ink">
      <p className="flex items-center gap-2 font-bold">
        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
        {t("deniedTitle")}
      </p>
      <p>{t("deniedText")}</p>
      <ul className="grid list-disc gap-1 pl-5">
        {order.map((b) => (
          <li key={b} className={b === browser ? "font-semibold" : undefined}>
            {text[b]}
          </li>
        ))}
      </ul>
      <p>{t("deniedFallback")}</p>
      {onDismiss ? (
        <Button variant="ghost" size="sm" className="justify-self-start" onClick={onDismiss}>
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
              const { error } = await getSupabaseBrowserClient().rpc("send_test_notification");
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
