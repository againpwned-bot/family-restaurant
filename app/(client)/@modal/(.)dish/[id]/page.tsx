import { notFound } from "next/navigation";

import { DishDetail, fetchDish } from "@/components/client/dish-detail";
import { DishOverlay } from "@/components/client/dish-overlay";
import { requireProfile } from "@/lib/auth/dal";

// Opening a dish from the menu: shown over the menu (which stays mounted, so
// the card photo can morph into the hero). Direct visits get the full page.
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
