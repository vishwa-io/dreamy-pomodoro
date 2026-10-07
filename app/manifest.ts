import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dreamy Pomodoro",
    short_name: "Dreamy",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0e0e0e",
    theme_color: "#0e0e0e",
    orientation: "any",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
