import { it, expect } from "vitest";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../tooling/cli.ts";
it("CLI commands create validated types, compiled and pseudo catalogs, extraction and failing CI codes", async () => {
  const root = await mkdtemp(join(tmpdir(), "vibei18n-cli-"));
  try {
    const en = join(root, "en.json"),
      tr = join(root, "tr.json"),
      config = join(root, "config.json"),
      output = join(root, "out");
    await writeFile(en, '{"hello":"Hello {name}","cart":"{n, plural, one {#} other {#}}"}');
    await writeFile(tr, '{"hello":"Merhaba {name}","cart":"{n, plural, other {#}}"}');
    const setup = async (out: string) =>
      writeFile(
        config,
        JSON.stringify({
          sourceLocale: "en",
          resources: [
            { locale: "en", file: en },
            { locale: "tr", file: tr },
          ],
          output: out,
          sources: [join(root, "app.ts")],
        }),
      );
    const messages: string[] = [];
    const log = (text: string) => messages.push(text);
    await setup(join(root, "types.d.ts"));
    expect(await run(["check", "--config", config, "--json"], log)).toBe(0);
    expect(JSON.parse(messages.at(-1)!).ok).toBe(true);
    expect(await run(["generate", "--config", config], log)).toBe(0);
    expect(await readFile(join(root, "types.d.ts"), "utf8")).toContain('"n": number');
    await setup(output);
    expect(await run(["compile", "--config", config], log)).toBe(0);
    expect(
      Array.isArray(JSON.parse(await readFile(join(output, "en.default.json"), "utf8")).hello),
    ).toBe(true);
    expect(await run(["pseudo", "--config", config, "--rtl"], log)).toBe(0);
    expect(await readFile(join(output, "en-XB.default.json"), "utf8")).toContain("name");
    await writeFile(join(root, "app.ts"), "t('hello');t(key);");
    await setup(join(root, "references.json"));
    expect(await run(["extract", "--config", config], log)).toBe(0);
    expect(JSON.parse(await readFile(join(root, "references.json"), "utf8"))).toHaveLength(2);
    await writeFile(tr, '{"hello":"Missing {wrong}"}');
    expect(await run(["check", "--config", config], log)).toBe(1);
    expect(messages.at(-1)).toContain("tr.json");
    expect(await run(["unknown"], log)).toBe(2);
    expect(await run(["check", "--wat"], log)).toBe(2);
    expect(await run(["--help"], log)).toBe(0);
    await mkdir(join(root, "unused"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("rejects missing namespaces by default and supports explicit namespace fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "vibei18n-namespaces-"));
  try {
    await writeFile(join(root, "en.json"), '{"x":"X"}');
    const config = join(root, "config.json");
    const data = {
      sourceLocale: "en",
      resources: [
        { locale: "en", file: "en.json" },
        { locale: "tr", file: "en.json" },
        { locale: "en", namespace: "billing", file: "en.json" },
      ],
      allowMissingNamespaces: false,
    };
    await writeFile(config, JSON.stringify(data));
    const messages: string[] = [];
    expect(await run(["check", "--config", config], (text) => messages.push(text))).toBe(1);
    expect(messages.at(-1)).toContain("tr:billing");
    data.allowMissingNamespaces = true;
    await writeFile(config, JSON.stringify(data));
    expect(await run(["check", "--config", config], () => {})).toBe(0);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
