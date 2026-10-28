import { notFound } from "next/navigation";

import { DishDetail, fetchDish } from "@/components/client/dish-detail";
import { DishOverlay } from "@/components/client/dish-overlay";
import { requireProfile } from "@/lib/auth/dal";

export default async function DishOverlayPage({ params }: PageProps<"/dish/[id]">) {
  await requireProfile({ roles: ["owner", "client"] });
  const dish = await fetchDish((await params).id);
  if (!dish) notFound();
  return (
    <DishOverlay title={dish.name}>
      <DishDetail dish={dish} overlay />
    </DishOverlay>
  );
}
