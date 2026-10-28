import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  use: { baseURL: "http://127.0.0.1:43871" },
  webServer: {
    command: "pnpm exec vite examples/showcase --host 127.0.0.1 --port 43871",
    url: "http://127.0.0.1:43871",
    reuseExistingServer: false,
  },
  reporter: "list",
});
