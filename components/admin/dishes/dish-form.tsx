"use client";

import { ArrowDown, ArrowLeft, ArrowUp, CircleAlert, ImagePlus, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { DishPhoto } from "@/components/dish/dish-photo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { dbErrorKey } from "@/lib/errors";
import { PhotoError, formatBytes, photoExtension, preparePhoto, type PreparedPhoto } from "@/lib/images";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type DishFormValue = {
  id: string | null;
  name: string;
  description: string;
  cook_minutes: number;
  availableToday: boolean;
  photo_path: string | null;
  photo_width: number | null;
  photo_height: number | null;
  photo_blur: string | null;
  ingredients: { name: string; quantity: number | null; unit: string }[];
};

type Row = { key: string; name: string; quantity: string; unit: string };
type Photo =
  | { kind: "existing"; path: string; width: number | null; height: number | null; blur: string | null }
  | { kind: "new"; prepared: PreparedPhoto; preview: string }
  | null;
type Errors = Partial<Record<"name" | "description" | "minutes" | `ing-${string}-name` | `ing-${string}-qty`, string>>;

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());

export function DishForm({ initial }: { initial: DishFormValue }) {
  const t = useTranslations("adminDishes.form");
  const tAll = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const formId = useId();

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [minutes, setMinutes] = useState(String(initial.cook_minutes));
  const [availableToday, setAvailableToday] = useState(initial.availableToday);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.ingredients.map((i) => ({
      key: newKey(),
      name: i.name,
      quantity: i.quantity === null ? "" : String(i.quantity).replace(".", locale === "ro" ? "," : "."),
      unit: i.unit,
    })),
  );
  const [photo, setPhoto] = useState<Photo>(
    initial.photo_path
      ? {
          kind: "existing",
          path: initial.photo_path,
          width: initial.photo_width,
          height: initial.photo_height,
          blur: initial.photo_blur,
        }
      : null,
  );
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const focusRow = useRef<string | null>(null);

  // Free the local preview URL when it's replaced or the form unmounts.
  useEffect(() => {
    const preview = photo?.kind === "new" ? photo.preview : null;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [photo]);

  useEffect(() => {
    if (focusRow.current) {
      document.getElementById(`${formId}-ing-${focusRow.current}-name`)?.focus();
      focusRow.current = null;
    }
  }, [rows, formId]);

  const parseQty = (raw: string) => {
    const v = raw.trim().replace(",", ".");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : NaN;
  };

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const prepared = await preparePhoto(file);
      setPhoto({ kind: "new", prepared, preview: URL.createObjectURL(prepared.blob) });
    } catch (error) {
      setPhotoError(
        error instanceof PhotoError && error.message === "too large" ? t("photoTooLarge") : t("photoError"),
      );
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function validate(): Errors {
    const e: Errors = {};
    const n = name.trim();
    if (!n) e.name = t("errors.nameRequired");
    else if (n.length > 80) e.name = t("errors.nameTooLong");
    if (description.length > 1000) e.description = t("errors.descriptionTooLong");
    const mins = Number(minutes);
    if (!Number.isInteger(mins) || mins < 1 || mins > 600) e.minutes = t("errors.minutesInvalid");
    for (const row of rows) {
      const empty = !row.name.trim() && !row.quantity.trim() && !row.unit.trim();
      if (empty) continue;
      if (!row.name.trim()) e[`ing-${row.key}-name`] = t("errors.ingredientNameRequired");
      if (Number.isNaN(parseQty(row.quantity))) e[`ing-${row.key}-qty`] = t("errors.quantityInvalid");
    }
    return e;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`${formId}-${first}`)?.focus();
      toast.error(t("errors.fixErrors"));
      return;
    }

    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    let uploadedPath: string | null = null;
    let photoFields = {
      path: null as string | null,
      width: null as number | null,
      height: null as number | null,
      blur: null as string | null,
    };

    if (photo?.kind === "existing") {
      photoFields = { path: photo.path, width: photo.width, height: photo.height, blur: photo.blur };
    } else if (photo?.kind === "new") {
      const path = `dishes/${initial.id ?? "new"}/${newKey()}.${photoExtension(photo.prepared.type)}`;
      const { error } = await supabase.storage.from("dish-photos").upload(path, photo.prepared.blob, {
        contentType: photo.prepared.type,
        cacheControl: "31536000",
      });
      if (error) {
        setSaving(false);
        toast.error(t("errors.uploadFailed"));
        return;
      }
      uploadedPath = path;
      photoFields = { path, width: photo.prepared.width, height: photo.prepared.height, blur: photo.prepared.blur };
    }

    const ingredients = rows
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name.trim(), quantity: parseQty(r.quantity), unit: r.unit.trim() }));

    const { data, error } = await supabase.rpc("save_dish", {
      p_id: initial.id,
      p_name: name.trim(),
      p_description: description.trim(),
      p_cook_minutes: Number(minutes),
      p_available_today: availableToday,
      p_photo_path: photoFields.path,
      p_photo_width: photoFields.width,
      p_photo_height: photoFields.height,
      p_photo_blur: photoFields.blur,
      p_ingredients: ingredients,
    });

    if (error || !data) {
      if (uploadedPath) await supabase.storage.from("dish-photos").remove([uploadedPath]);
      setSaving(false);
      toast.error(tAll(`errors.db.${dbErrorKey(error)}`));
      return;
    }

    // The old photo is no longer referenced: remove it (best effort).
    if (initial.photo_path && initial.photo_path !== photoFields.path) {
      await supabase.storage.from("dish-photos").remove([initial.photo_path]);
    }

    toast.success(t("saved"));
    router.push("/admin/dishes");
    router.refresh();
  }

  async function remove() {
    if (!initial.id) return;
    setDeleting(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("delete_dish", { p_id: initial.id });
    if (error) {
      setDeleting(false);
      toast.error(tAll(`errors.db.${dbErrorKey(error)}`));
      return;
    }
    const result = data as { mode: "archived" | "deleted"; photo_path: string | null };
    if (result.mode === "deleted" && result.photo_path)
      await supabase.storage.from("dish-photos").remove([result.photo_path]);
    toast.success(result.mode === "archived" ? t("archived") : t("deleted"));
    router.push("/admin/dishes");
    router.refresh();
  }

  const clearError = (...keys: (keyof Errors)[]) =>
    setErrors((e) => {
      if (!keys.some((k) => e[k])) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
  const updateRow = (key: string, patch: Partial<Row>) => {
    if ("name" in patch) clearError(`ing-${key}-name`);
    if ("quantity" in patch) clearError(`ing-${key}-qty`);
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const addRow = () => {
    const key = newKey();
    focusRow.current = key;
    setRows((list) => [...list, { key, name: "", quantity: "", unit: "" }]);
  };
  const move = (index: number, delta: number) =>
    setRows((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  const fieldError = (key: keyof Errors) =>
    errors[key] ? (
      <p id={`${formId}-${key}-error`} className="text-sm font-medium text-destructive">
        {errors[key]}
      </p>
    ) : null;
  const units = t("unitSuggestions").split(",");

  return (
    <form
      onSubmit={save}
      noValidate
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start"
    >
      <div className="grid gap-6">
        {/* Photo */}
        <section
          className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5"
          aria-labelledby={`${formId}-photo`}
        >
          <h2 id={`${formId}-photo`} className="font-heading text-lg font-bold">
            {t("photo")}
          </h2>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void onFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "relative aspect-[4/3] overflow-hidden rounded-xl border-2 border-dashed bg-muted",
              dragging ? "border-primary" : "border-border",
            )}
          >
            {photo?.kind === "new" ? (
              <Image src={photo.preview} alt={name || t("photo")} fill unoptimized className="object-cover" />
            ) : photo?.kind === "existing" ? (
              <DishPhoto
                dish={{ name: name || initial.name, photo_path: photo.path, photo_blur: photo.blur }}
                sizes="(min-width: 1024px) 40vw, 100vw"
              />
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="absolute inset-0 grid place-items-center content-center gap-2 text-center text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ImagePlus className="mx-auto size-10" aria-hidden="true" />
                <span className="font-semibold text-foreground">{t("photoChoose")}</span>
                <span className="hidden text-sm pointer-fine:block">{t("photoDrop")}</span>
              </button>
            )}
            {photoBusy ? (
              <div className="absolute inset-0 grid place-items-center bg-background/80 font-semibold" role="status">
                <span className="flex items-center gap-2">
                  <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                  {t("photoProcessing")}
                </span>
              </div>
            ) : null}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-2">
            {photo ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInput.current?.click()}
                  disabled={photoBusy}
                >
                  <ImagePlus aria-hidden="true" />
                  {t("photoChange")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(null)} disabled={photoBusy}>
                  <X aria-hidden="true" />
                  {t("photoRemove")}
                </Button>
              </>
            ) : null}
            {photo?.kind === "new" ? (
              <span className="text-sm text-muted-foreground">
                {t("photoInfo", {
                  width: photo.prepared.width,
                  height: photo.prepared.height,
                  size: formatBytes(photo.prepared.blob.size, locale),
                })}
              </span>
            ) : null}
          </div>
          {photoError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {photoError}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("photoHint")}</p>
          )}
        </section>

        {/* Basics */}
        <section className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-name`}>{t("name")}</Label>
            <Input
              id={`${formId}-name`}
              value={name}
              maxLength={80}
              onChange={(e) => {
                setName(e.target.value);
                clearError("name");
              }}
              placeholder={t("namePlaceholder")}
              aria-invalid={!!errors.name || undefined}
              aria-describedby={errors.name ? `${formId}-name-error` : undefined}
              required
            />
            {fieldError("name")}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-description`}>{t("description")}</Label>
            <Textarea
              id={`${formId}-description`}
              value={description}
              maxLength={1000}
              rows={3}
              onChange={(e) => {
                setDescription(e.target.value);
                clearError("description");
              }}
              placeholder={t("descriptionPlaceholder")}
              aria-invalid={!!errors.description || undefined}
            />
            {fieldError("description")}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-minutes`}>{t("cookMinutes")}</Label>
            <Input
              id={`${formId}-minutes`}
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={minutes}
              onChange={(e) => {
                setMinutes(e.target.value);
                clearError("minutes");
              }}
              className="max-w-36"
              aria-invalid={!!errors.minutes || undefined}
              aria-describedby={errors.minutes ? `${formId}-minutes-error` : undefined}
            />
            {fieldError("minutes")}
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 p-3">
            <div>
              <Label htmlFor={`${formId}-today`} className="text-base">
                {t("availableToday")}
              </Label>
              <p className="text-sm text-muted-foreground">{t("availableTodayHint")}</p>
            </div>
            <Switch id={`${formId}-today`} checked={availableToday} onCheckedChange={setAvailableToday} />
          </div>
        </section>
      </div>

      {/* Ingredients */}
      <section
        className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5"
        aria-labelledby={`${formId}-ingredients`}
      >
        <div>
          <h2 id={`${formId}-ingredients`} className="font-heading text-lg font-bold">
            {t("ingredients")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("ingredientsHint")}</p>
        </div>

        <datalist id={`${formId}-units`}>
          {units.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("noIngredients")}</p> : null}
        <ol className="grid gap-3">
          {rows.map((row, index) => {
            const nameKey = `ing-${row.key}-name` as const;
            const qtyKey = `ing-${row.key}-qty` as const;
            return (
              <li
                key={row.key}
                className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_auto] sm:items-start sm:border-0 sm:p-0"
              >
                <div className="grid gap-1">
                  <Label htmlFor={`${formId}-${nameKey}`} className={cn(index > 0 && "sm:sr-only")}>
                    {t("ingredientName")}
                  </Label>
                  <Input
                    id={`${formId}-${nameKey}`}
                    value={row.name}
                    maxLength={80}
                    placeholder={t("ingredientPlaceholder")}
                    onChange={(e) => updateRow(row.key, { name: e.target.value })}
                    aria-invalid={!!errors[nameKey] || undefined}
                  />
                  {fieldError(nameKey)}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:contents">
                  <div className="grid gap-1">
                    <Label htmlFor={`${formId}-${qtyKey}`} className={cn(index > 0 && "sm:sr-only")}>
                      {t("quantity")}
                    </Label>
                    <Input
                      id={`${formId}-${qtyKey}`}
                      inputMode="decimal"
                      value={row.quantity}
                      placeholder="—"
                      onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      aria-invalid={!!errors[qtyKey] || undefined}
                    />
                    {fieldError(qtyKey)}
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`${formId}-ing-${row.key}-unit`} className={cn(index > 0 && "sm:sr-only")}>
                      {t("unit")}
                    </Label>
                    <Input
                      id={`${formId}-ing-${row.key}-unit`}
                      value={row.unit}
                      maxLength={20}
                      list={`${formId}-units`}
                      placeholder={t("unitPlaceholder")}
                      onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && index === rows.length - 1) {
                          e.preventDefault();
                          addRow();
                        }
                      }}
                    />
                  </div>
                </div>
                <div className={cn("flex items-center justify-end gap-1", index === 0 && "sm:mt-6")}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("moveUp")}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("moveDown")}
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={t("removeIngredient", { name: row.name || t("unnamed") })}
                    onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
        <Button type="button" variant="outline" onClick={addRow} className="justify-self-start">
          <Plus aria-hidden="true" />
          {t("addIngredient")}
        </Button>
      </section>

      {/* Actions */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-wrap items-center gap-2 border-t border-border bg-background px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border lg:bottom-4 lg:col-span-2">
        <Button type="submit" size="lg" disabled={saving || photoBusy || deleting}>
          {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {saving ? t("saving") : t("save")}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/admin/dishes">
            <ArrowLeft aria-hidden="true" />
            {t("back")}
          </Link>
        </Button>
        {Object.keys(errors).length ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive" role="alert">
            <CircleAlert className="size-4" aria-hidden="true" />
            {t("errors.fixErrors")}
          </p>
        ) : null}
        {initial.id ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="ml-auto"
                disabled={deleting || saving}
                aria-label={t("delete")}
              >
                {deleting ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{t("delete")}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteTitle", { name: initial.name })}</AlertDialogTitle>
                <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tAll("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void remove()}>
                  {t("deleteConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </form>
  );
}
