"use client";

import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";

import { login, type LoginError, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next, initialError }: { next?: string; initialError?: LoginError }) {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {
    error: initialError,
  });
  const [showPassword, setShowPassword] = useState(false);
  const errorId = useId();
  const error = state.error;

  return (
    <form action={action} className="grid gap-5" noValidate aria-describedby={error ? errorId : undefined}>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="grid gap-2">
        <Label htmlFor="username">{t("username")}</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          placeholder={t("usernamePlaceholder")}
          defaultValue={state.username}
          aria-invalid={error === "invalid" || error === "required" ? true : undefined}
          required
          autoFocus
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="go"
            className="pr-12"
            aria-invalid={error === "invalid" || error === "required" ? true : undefined}
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            aria-pressed={showPassword}
            aria-controls="password"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`errors.${error}`)}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
