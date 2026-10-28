import type { MetadataRoute } from "next";

import ro from "@/messages/ro.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: ro.metadata.title,
    short_name: ro.metadata.shortName,
    description: ro.metadata.description,
    lang: "ro",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5eee2",
    theme_color: "#b8321a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
