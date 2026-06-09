import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), cloudflare(), tailwindcss()],
  optimizeDeps: {
    exclude: ["spotify-url-info"],
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-router")
          ) {
            return "vendor";
          }
          if (id.includes("node_modules/@base-ui")) {
            return "baseui";
          }
          if (id.includes("node_modules/sonner")) {
            return "sonner";
          }
        },
      },
    },
  },
});
