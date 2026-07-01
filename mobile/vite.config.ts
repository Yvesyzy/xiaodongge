import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "mobile",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
