import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Fuente de verdad del manifest — no hay <link rel="manifest"> manual
      // en index.html, el plugin lo inyecta solo en cada build.
      manifest: {
        name: "APP Modular de Gestión",
        short_name: "GestiónApp",
        start_url: "/",
        display: "standalone",
        background_color: "#FAF9F5",
        theme_color: "#1B4332",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
