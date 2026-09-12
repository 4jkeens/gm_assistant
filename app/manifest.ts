import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GM Dashboard",
    short_name: "GM Dashboard",
    description: "Tablet-first GM calendar and task dashboard",
    start_url: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#0b1016",
    theme_color: "#0b1016",
  };
}
