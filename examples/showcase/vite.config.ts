import { defineConfig } from "vite";
import tailwind from "@tailwindcss/vite";
import { vibe } from "@usevibejs/compiler/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [vibe(), tailwind()],
  resolve: {
    alias: { "@usevibejs/i18n": fileURLToPath(new URL("../../src/index.ts", import.meta.url)) },
  },
  build: { target: "es2023" },
});
