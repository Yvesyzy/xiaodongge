import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const desktopRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: desktopRoot,
  plugins: [react()],
  define: { __CODEX_WEB_BUILD_ID__: JSON.stringify(`windows-${new Date().toISOString()}`) },
  build: {
    outDir: path.join(desktopRoot, "dist"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
  },
});
