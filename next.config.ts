import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Every page here is private and per-user (session cookie + realtime data),
  // so there is no static shell worth prerendering. We use the classic dynamic
  // rendering model with loading.tsx streaming instead of Cache Components.
  cacheComponents: false,
  poweredByHeader: false,
  // The database (Postgres compiled to WebAssembly) loads its .wasm and data
  // files from its own folder, and web-push uses Node's crypto: both stay
  // plain Node modules instead of being bundled.
  serverExternalPackages: ["@electric-sql/pglite", "web-push"],
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
    // Dish photos are served by app/uploads/dish-photos/[...path]/route.ts.
    localPatterns: [{ pathname: "/uploads/dish-photos/**", search: "" }],
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
