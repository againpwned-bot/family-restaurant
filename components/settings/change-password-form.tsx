"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { changePassword, type ChangePasswordState } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/username";

export function ChangePasswordForm({ username }: { username: string }) {
  const t = useTranslations("settings.password");
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePassword, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      toast.success(t("success"));
    }
  }, [state.ok, state.at, t]);

  const fieldError = (field: "current" | "new" | "confirm") => {
    if (!state.error) return false;
    if (state.error === "required") return true;
    if (field === "current") return state.error === "wrong_current";
    if (field === "new") return ["too_short", "too_long", "same"].includes(state.error);
    return state.error === "mismatch";
  };

  return (
    <form ref={formRef} action={action} className="grid max-w-md gap-4" noValidate>
      <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />

      <div className="grid gap-2">
        <Label htmlFor="pw-current">{t("current")}</Label>
        <Input
          id="pw-current"
          name="current"
          type="password"
          autoComplete="current-password"
          aria-invalid={fieldError("current") || undefined}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pw-new">{t("new")}</Label>
        <Input
          id="pw-new"
          name="new"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          aria-describedby="pw-hint"
          aria-invalid={fieldError("new") || undefined}
          required
        />
        <p id="pw-hint" className="text-sm text-muted-foreground">
          {t("hint", { min: PASSWORD_MIN_LENGTH })}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pw-confirm">{t("confirm")}</Label>
        <Input
          id="pw-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={fieldError("confirm") || undefined}
          required
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`errors.${state.error}`, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
