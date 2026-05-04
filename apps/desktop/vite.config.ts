import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 8302,
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@xterm") || id.includes("/xterm/")) {
            return "terminal-vendor";
          }
          if (id.includes("@tauri-apps/api")) {
            return "tauri-vendor";
          }
          if (id.includes("lucide-react")) {
            return "ui-icons";
          }
          if (id.includes("react-dom") || id.includes("/react/")) {
            return "react-vendor";
          }
          return undefined;
        },
      },
    },
  },
});
