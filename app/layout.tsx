import type { Metadata, Viewport } from "next";
import { Karla, Playfair_Display } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { MotionProvider } from "@/components/providers/motion-provider";
import { Toaster } from "@/components/ui/sonner";
import { THEME_COOKIE, resolveTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

import "./globals.css";

// Typography from the design system: Playfair Display (headings) + Karla (body).
// latin-ext carries the Romanian ă â î ș ț.
const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  display: "swap",
});

const karla = Karla({
  subsets: ["latin", "latin-ext"],
  variable: "--font-karla",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
    applicationName: t("title"),
    robots: { index: false, follow: false },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fef2f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1a0b0a" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang={locale} className={cn(playfair.variable, karla.variable, theme !== "system" && theme)}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <MotionProvider>{children}</MotionProvider>
          <Toaster theme={theme} position="top-center" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
