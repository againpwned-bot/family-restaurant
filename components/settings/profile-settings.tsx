"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { saveMyDiet, setMyAvatar } from "@/app/actions/profile";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { DietEditor } from "@/components/profile/diet-editor";
import { safe } from "@/lib/action-result";
import type { DietTag } from "@/lib/types";

export function MyAvatarSetting({ name, path }: { name: string; path: string | null }) {
  const t = useTranslations();
  return (
    <AvatarPicker
      name={name}
      path={path}
      upload={async (form) => {
        const { error } = await safe(setMyAvatar(form));
        if (error) toast.error(t(`errors.db.${error.message}`));
        return !error;
      }}
    />
  );
}

export function MyDietSetting({ allergies, tags }: { allergies: string; tags: DietTag[] }) {
  return (
    <DietEditor
      initial={{ allergies, tags }}
      save={async (value) => !(await safe(saveMyDiet(value))).error}
    />
  );
}
