"use server";

import { revalidatePath } from "next/cache";

import { kitchenDate } from "@/lib/dates";
import { act } from "@/lib/server/action";
import { row, type Tx } from "@/lib/server/database";
import { menuBoardDishes, menuForDay } from "@/lib/server/queries";
import { deletePhoto, savePhoto } from "@/lib/server/uploads";
import type { Dish } from "@/lib/types";

const STAFF = ["owner", "admin"] as const;

export type DishInput = {
  id: string | null;
  name: string;
  description: string;
  cookMinutes: number;
  availableToday: boolean;
  /** The current photo to keep (null = no photo, or replaced by the uploaded file). */
  photo: { path: string; width: number | null; height: number | null; blur: string | null } | null;
  /** Size + blur placeholder of the uploaded file, when there is one. */
  upload: { width: number; height: number; blur: string } | null;
  ingredients: { name: string; quantity: number | null; unit: string }[];
};

/** Photos still shown in someone's order history are kept on disk. */
async function photoStillUsed(tx: Tx, path: string) {
  return !!(await row(
    tx,
    "select 1 from public.dishes where photo_path = $1 union all select 1 from public.orders where dish_photo_path = $1 limit 1",
    [path],
  ));
}

/**
 * Create or update a dish. FormData: "dish" (JSON DishInput) and optionally
 * "photo" (the resized image from the browser). The file is written first and
 * removed again if the database refuses the dish.
 */
export async function saveDish(form: FormData) {
  let input: DishInput;
  try {
    input = JSON.parse(String(form.get("dish") ?? "")) as DishInput;
  } catch {
    return { data: null, error: { message: "unknown" as const } };
  }
  const file = form.get("photo");
  let uploaded: string | null = null;

  const result = await act(STAFF, async (tx) => {
    const previous = input.id
      ? await row<Pick<Dish, "photo_path">>(tx, "select photo_path from public.dishes where id = $1", [input.id])
      : null;

    if (file instanceof File && file.size > 0) uploaded = await savePhoto(file);
    const photo = uploaded
      ? {
          path: uploaded,
          width: input.upload?.width ?? null,
          height: input.upload?.height ?? null,
          blur: input.upload?.blur ?? null,
        }
      : input.photo;
    // Only keep a photo path the dish already had; never point at someone else's file.
    if (!uploaded && photo && photo.path !== previous?.photo_path) throw new Error("forbidden");

    const dish = await row<Dish>(
      tx,
      "select * from public.save_dish($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)",
      [
        input.id,
        input.name,
        input.description,
        input.cookMinutes,
        input.availableToday,
        photo?.path ?? null,
        photo?.width ?? null,
        photo?.height ?? null,
        photo?.blur ?? null,
        JSON.stringify(input.ingredients ?? []),
      ],
    );
    const old = previous?.photo_path;
    return { dish: dish!, oldPhoto: old && old !== photo?.path ? old : null };
  });

  if (result.error) {
    await deletePhoto(uploaded);
    return { data: null, error: result.error };
  }

  const { dish, oldPhoto } = result.data;
  if (oldPhoto) {
    const stillUsed = await act(STAFF, (tx) => photoStillUsed(tx, oldPhoto));
    if (stillUsed.data === false) await deletePhoto(oldPhoto);
  }
  revalidatePath("/admin/dishes");
  return { data: { id: dish.id }, error: null };
}

export async function deleteDish(id: string) {
  const result = await act(STAFF, (tx) =>
    row<{ result: { mode: "archived" | "deleted"; photo_path: string | null } }>(
      tx,
      "select public.delete_dish($1) as result",
      [id],
    ).then((r) => r!.result),
  );
  if (result.data?.mode === "deleted" && result.data.photo_path) {
    const path = result.data.photo_path;
    const stillUsed = await act(STAFF, (tx) => photoStillUsed(tx, path));
    if (stillUsed.data === false) await deletePhoto(path);
  }
  revalidatePath("/admin/dishes");
  return result.error ? result : { data: { mode: result.data.mode }, error: null };
}

export async function setDishAvailableToday(dishId: string, available: boolean) {
  return act(STAFF, async (tx) =>
    (await row<Dish>(tx, "select * from public.set_dish_available_today($1, $2)", [dishId, available]))!,
  );
}

export async function copyYesterdayMenu() {
  return act(STAFF, async (tx) => (await row<{ n: number }>(tx, "select public.copy_yesterday_menu() as n"))!.n);
}

export async function clearTodayMenu() {
  return act(STAFF, async (tx) => (await row<{ n: number }>(tx, "select public.clear_today_menu() as n"))!.n);
}

export async function fetchMenuBoard() {
  return act(STAFF, (tx) => menuBoardDishes(tx));
}

/** Today's menu as the signed-in person sees it. */
export async function fetchTodayMenu() {
  return act(null, (tx) => menuForDay(tx, kitchenDate()));
}
