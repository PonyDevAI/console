import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 8301,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8300",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
