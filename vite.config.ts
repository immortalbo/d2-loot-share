import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // 开发时把 /api 和 /img 转发到本地 wrangler dev(默认 8787)
      "/api": "http://127.0.0.1:8787",
      "/img": "http://127.0.0.1:8787",
    },
  },
});
