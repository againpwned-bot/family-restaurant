"use client";

import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/layout/user-avatar";
import { Button } from "@/components/ui/button";
import { PhotoError, photoExtension, prepareAvatar } from "@/lib/images";

// Picks, square-crops and uploads a profile picture. `upload` receives the form with an "avatar" file
// (or without one to remove the picture) and returns whether it worked.
export function AvatarPicker({
  name,
  path,
  upload,
}: {
  name: string;
  path: string | null;
  upload: (form: FormData) => Promise<boolean>;
}) {
  const t = useTranslations("avatar");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [current, setCurrent] = useState(path);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(form: FormData, nextPreview: string | null) {
    setBusy(true);
    const ok = await upload(form).catch(() => false);
    setBusy(false);
    if (!ok) {
      if (nextPreview) URL.revokeObjectURL(nextPreview);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(nextPreview);
    if (!nextPreview) setCurrent(null);
    toast.success(nextPreview ? t("saved") : t("removed"));
    router.refresh();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const prepared = await prepareAvatar(file);
      const form = new FormData();
      form.set("avatar", prepared.blob, `avatar.${photoExtension(prepared.type)}`);
      await send(form, URL.createObjectURL(prepared.blob));
    } catch (error) {
      toast.error(error instanceof PhotoError && error.message === "too large" ? t("tooLarge") : t("error"));
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-20 rounded-full border-2 border-line object-cover" />
        ) : (
          <UserAvatar name={name} path={current} className="size-20 border-2 border-line" fallbackClassName="text-2xl" />
        )}
        {busy ? (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
            <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          <Camera aria-hidden="true" />
          {current || preview ? t("change") : t("choose")}
        </Button>
        {current || preview ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void send(new FormData(), null)}>
            <Trash2 aria-hidden="true" />
            {t("remove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
