"use client";

import { BellRing, LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DeniedHelp, usePushState } from "@/components/notifications/push-toggle";
import { Button } from "@/components/ui/button";
import { enablePush, hidePushPromptFromNowOn } from "@/lib/push";

/** Small card that offers notifications where they matter (orders pages). */
export function PushPrompt() {
  const t = useTranslations("push");
  const [state, setState] = usePushState({ deferred: true });
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const dismiss = () => {
    hidePushPromptFromNowOn();
    setDismissed(true);
  };

  // Already on, or not possible here: don't offer it again on this browser.
  useEffect(() => {
    if (state === "enabled" || state === "unsupported" || state === "not-configured") hidePushPromptFromNowOn();
  }, [state]);

  // Rendered on the server (state === null) so it paints with the page; the
  // server leaves it out entirely once the cookie says it's no longer needed.
  if (dismissed || state === "enabled" || state === "unsupported" || state === "not-configured") return null;
  if (state === "denied") return <DeniedHelp onDismiss={dismiss} />;

  return (
    <aside className="flex flex-col gap-3 rounded-3xl border border-gold/40 bg-gold-soft p-4 text-gold-ink sm:flex-row sm:items-center">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card text-gold-ink">
        <BellRing className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t("promptTitle")}</p>
        <p className="text-sm">{t("promptText")}</p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="gold"
          disabled={busy}
          onClick={async () => {
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
          }}
        >
          {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {t("enable")}
        </Button>
        <Button variant="ghost" size="icon" aria-label={t("promptDismiss")} onClick={dismiss}>
          <X />
        </Button>
      </div>
    </aside>
  );
}
