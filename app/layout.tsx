import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, DM_Mono, Fraunces } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { AnimationProvider } from "@/components/providers/animation-provider";
import { MotionProvider } from "@/components/providers/motion-provider";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentProfile } from "@/lib/auth/dal";
import { THEME_COOKIE, resolveTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  variable: "--font-caveat",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
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
    { media: "(prefers-color-scheme: light)", color: "#f5eee2" },
    { media: "(prefers-color-scheme: dark)", color: "#161b18" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);
  const profile = await getCurrentProfile();

  return (
    <html
      lang={locale}
      className={cn(
        fraunces.variable,
        bricolage.variable,
        caveat.variable,
        dmMono.variable,
        theme !== "system" && theme,
      )}
    >
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <MotionProvider>
            <AnimationProvider
              userId={profile?.id ?? null}
              initialPref={profile?.animation_pref ?? "auto"}
              initialDetected={profile?.animation_detected ?? null}
            >
              {children}
            </AnimationProvider>
          </MotionProvider>
          <Toaster
            theme={theme}
            position="bottom-center"
            offset={{ bottom: 24 }}
            mobileOffset={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}
            richColors
            closeButton
            visibleToasts={3}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
