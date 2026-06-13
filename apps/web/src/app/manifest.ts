import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "rfjs — TypeScript utility toolkit",
    short_name: "rfjs",
    description:
      "Utilities and developer data tools for JSON, objects, filters, and query workflows.",
    start_url: "/",
    display: "standalone",
    background_color: "#11151c",
    theme_color: "#11151c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
