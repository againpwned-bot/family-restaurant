import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

import { DishDetail, fetchDish } from "@/components/client/dish-detail";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/dal";

const getDish = cache(fetchDish);

export async function generateMetadata({ params }: PageProps<"/dish/[id]">): Promise<Metadata> {
  const dish = await getDish((await params).id);
  return { title: dish?.name };
}

export default async function DishPage({ params }: PageProps<"/dish/[id]">) {
  await requireProfile({ roles: ["owner", "client"] });
  const dish = await getDish((await params).id);
  if (!dish) notFound();
  const t = await getTranslations("dish");

  return (
    <DishDetail
      dish={dish}
      top={
        <Button asChild variant="ghost" className="-ml-3 mb-3">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            {t("back")}
          </Link>
        </Button>
      }
    />
  );
}
