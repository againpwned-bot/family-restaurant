"use client";

import { BellRing, LoaderCircle, LogOut, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { logout } from "@/app/login/actions";
import { DeniedHelp, usePushState } from "@/components/notifications/push-toggle";
import { Button } from "@/components/ui/button";
import { currentPushState, enablePush, forgetThisDevice } from "@/lib/push";

// Blocks the app until this device can receive push notifications (when the kitchen requires it).
// Browsers that can't do push at all (or a server without keys) are let through.
export function PushGate({ required }: { required: boolean }) {
  const t = useTranslations("pushGate");
  const tPush = useTranslations("push");
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);
  const [loggingOut, startLogout] = useTransition();
  const button = useRef<HTMLButtonElement>(null);
  const resubscribing = useRef(false);

  useEffect(() => {
    if (!required) return;
    const recheck = () => {
      if (document.visibilityState === "visible") void currentPushState().then(setState);
    };
    document.addEventListener("visibilitychange", recheck);
    return () => document.removeEventListener("visibilitychange", recheck);
  }, [required, setState]);

  // Permission is already granted but this device has no subscription: fix it silently.
  useEffect(() => {
    if (!required || state !== "disabled" || resubscribing.current) return;
    resubscribing.current = true;
    void enablePush()
      .then(setState)
      .catch(() => {})
      .finally(() => {
        resubscribing.current = false;
      });
  }, [required, state, setState]);

  const blocking = required && (state === "default" || state === "denied");

  useEffect(() => {
    if (blocking) button.current?.focus();
  }, [blocking]);

  if (!blocking) return null;

  async function turnOn() {
    setBusy(true);
    try {
      const next = await enablePush();
      setState(next);
      if (next === "enabled") toast.success(tPush("enabledToast"));
    } catch {
      toast.error(tPush("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-gate-title"
      aria-describedby="push-gate-text"
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/95 p-4 backdrop-blur-md"
    >
      <div className="grid w-full max-w-md gap-5 rounded-[2rem] border-2 border-line bg-card p-6 text-center shadow-[6px_6px_0_var(--shadow-hard)] sm:p-8">
        <span className="mx-auto grid size-16 place-items-center rounded-full border-2 border-line bg-gold text-gold-foreground">
          <BellRing className="size-7 origin-top animate-[wiggle_0.8s_ease-in-out_0.5s_3]" aria-hidden="true" />
        </span>
        <div className="grid gap-2">
          <h2 id="push-gate-title" className="font-heading text-2xl font-black">
            {t("title")}
          </h2>
          <p id="push-gate-text" className="text-muted-foreground">
            {state === "denied" ? t("deniedText") : t("text")}
          </p>
        </div>

        {state === "denied" ? (
          <>
            <div className="text-left">
              <DeniedHelp />
            </div>
            <Button
              ref={button}
              size="lg"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const next = await currentPushState();
                setState(next);
                setBusy(false);
                if (next === "denied") toast.error(t("stillBlocked"));
              }}
            >
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              {t("checkAgain")}
            </Button>
          </>
        ) : (
          <Button ref={button} size="lg" disabled={busy} onClick={() => void turnOn()}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
            {busy ? tPush("enabling") : tPush("enable")}
          </Button>
        )}

        <Button
          variant="ghost"
          disabled={loggingOut}
          onClick={() =>
            startLogout(async () => {
              await forgetThisDevice();
              await logout();
            })
          }
        >
          <LogOut aria-hidden="true" />
          {t("signOut")}
        </Button>
      </div>
    </div>
  );
}
