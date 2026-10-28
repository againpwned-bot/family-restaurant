"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export function PrintControls({ auto = false }: { auto?: boolean }) {
  const t = useTranslations("print");
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, [auto]);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
      <Button onClick={() => window.print()}>
        <Printer aria-hidden="true" />
        {t("print")}
      </Button>
      <p className="text-sm text-muted-foreground">{t("pdfHint")}</p>
    </div>
  );
}
