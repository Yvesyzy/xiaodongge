import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "mobile",
  plugins: [react()],
  define: { __CODEX_WEB_BUILD_ID__: JSON.stringify(`web-${new Date().toISOString()}`) },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
