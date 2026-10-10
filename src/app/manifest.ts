import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#ff5a36",
    lang: "uz",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
