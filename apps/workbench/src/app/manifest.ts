import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "rfjs workbench",
    short_name: "workbench",
    description: "Dataset-driven workbench composing the @rfjs packages.",
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
