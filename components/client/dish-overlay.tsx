"use client";

import { X } from "lucide-react";
import { m } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function DishOverlay({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const t = useTranslations("common");

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && router.back()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <m.div
            className="fixed inset-0 z-50 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain outline-none sm:px-6 sm:py-10"
        >
          <m.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 190, damping: 26 }}
            className="relative mx-auto min-h-full max-w-6xl bg-background px-4 pt-[max(env(safe-area-inset-top),3.5rem)] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:min-h-0 sm:rounded-3xl sm:p-8 sm:shadow-2xl"
          >
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button
                variant="outline"
                size="icon"
                className="fixed top-[max(env(safe-area-inset-top),0.75rem)] right-3 z-20 rounded-full bg-card shadow-md sm:absolute sm:top-4 sm:right-4"
                aria-label={t("close")}
              >
                <X />
              </Button>
            </DialogPrimitive.Close>
            {children}
          </m.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
