// @vitest-environment node
import { it, expect } from "vitest";
import { build } from "vite";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vibeI18n } from "../tooling/vite.ts";
it("uses supported Vite hooks to validate actual production builds", async () => {
  const root = await mkdtemp(join(tmpdir(), "vibei18n-vite-"));
  try {
    await writeFile(join(root, "index.html"), "<p>App</p>");
    await writeFile(join(root, "en.json"), '{"hello":"Hello {name}"}');
    await writeFile(join(root, "tr.json"), '{"hello":"Merhaba {name}"}');
    await writeFile(
      join(root, "vibei18n.config.json"),
      JSON.stringify({
        sourceLocale: "en",
        resources: [
          { locale: "en", file: "en.json" },
          { locale: "tr", file: "tr.json" },
        ],
      }),
    );
    const config = {
      configFile: false as const,
      root,
      logLevel: "silent" as const,
      plugins: [vibeI18n()],
      build: { write: false },
    };
    await expect(build(config)).resolves.toBeDefined();
    await writeFile(join(root, "tr.json"), '{"hello":"Missing {wrong}"}');
    await expect(build(config)).rejects.toThrow("Missing placeholder");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
