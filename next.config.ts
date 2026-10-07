import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Dish photos are served from the public Supabase Storage bucket.
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch {
    return null;
  }
})();
// The local emulator (npm run dev:local) serves photos from 127.0.0.1.
const isLocalSupabase = !!supabase && ["127.0.0.1", "localhost"].includes(supabase.hostname);

const nextConfig: NextConfig = {
  // Every page here is private and per-user (session cookie + realtime data),
  // so there is no static shell worth prerendering. We use the classic dynamic
  // rendering model with loading.tsx streaming instead of Cache Components.
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    // There is an unrelated package-lock.json in the home folder; pin the root here.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    dangerouslyAllowLocalIP: isLocalSupabase,
    remotePatterns: supabase
      ? [
          {
            protocol: supabase.protocol === "http:" ? "http" : "https",
            hostname: supabase.hostname,
            port: supabase.port,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
