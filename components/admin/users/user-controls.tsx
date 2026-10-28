"use client";

import { LoaderCircle, UserCheck, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { setUserAvatar, setUserDiet, setUserDisabled } from "@/app/admin/users/actions";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { DietEditor } from "@/components/profile/diet-editor";
import { Button } from "@/components/ui/button";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/username";
import type { DietTag } from "@/lib/types";

export function UserAvatarControl({ id, name, path }: { id: string; name: string; path: string | null }) {
  const t = useTranslations("adminUsers.errors");
  return (
    <AvatarPicker
      name={name}
      path={path}
      upload={async (form) => {
        form.set("id", id);
        const result = await setUserAvatar(form);
        if (!result.ok) toast.error(t(result.error, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }));
        return result.ok;
      }}
    />
  );
}

export function UserDietControl({ id, allergies, tags }: { id: string; allergies: string; tags: DietTag[] }) {
  return <DietEditor initial={{ allergies, tags }} save={async (value) => (await setUserDiet({ id, ...value })).ok} />;
}

export function UserDisableControl({ id, name, disabled }: { id: string; name: string; disabled: boolean }) {
  const t = useTranslations("adminUsers");
  const [pending, start] = useTransition();
  return (
    <Button
      variant={disabled ? "default" : "outline"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await setUserDisabled({ id, disabled: !disabled });
          if (!result.ok) return void toast.error(t(`errors.${result.error}`, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }));
          toast.success(disabled ? t("enabled", { name }) : t("disabledDone", { name }));
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : disabled ? <UserCheck aria-hidden="true" /> : <UserX aria-hidden="true" />}
      {disabled ? t("enable") : t("disable")}
    </Button>
  );
}
