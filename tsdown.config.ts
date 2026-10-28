import { defineConfig } from "tsdown";
export default defineConfig({
  entry: {
    index: "src/index.ts",
    core: "src/core/index.ts",
    router: "src/router/index.ts",
    tooling: "tooling/index.ts",
    cli: "tooling/cli.ts",
    vite: "tooling/vite.ts",
  },
  format: "esm",
  outputOptions: { minifyInternalExports: false },
  dts: false,
  sourcemap: true,
  clean: true,
  deps: {
    neverBundle: [
      "@usevibejs/ui",
      "@usevibejs/ui/router",
      "@usevibejs/compiler",
      "vite",
      "oxc-parser",
      "jsonc-parser",
    ],
  },
});
