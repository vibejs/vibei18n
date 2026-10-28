#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, checkResources } from "./config.ts";
import { generateTypes, compileCatalog, pseudoCatalog } from "./catalog.ts";
import { extractMessages } from "./index.ts";
export async function run(
  args: readonly string[],
  output: (text: string) => void = console.log,
): Promise<number> {
  try {
    const [command = "help"] = args;
    if (command === "help" || command === "--help") {
      output(
        "vibei18n <check|generate|compile|pseudo|extract> [--config vibei18n.config.json] [--json] [--rtl] [--rich]",
      );
      return 0;
    }
    if (!["check", "generate", "compile", "pseudo", "extract"].includes(command))
      throw new Error(`Unknown command: ${command}`);
    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--config") {
        if (!args[++i] || args[i].startsWith("--")) throw new Error("--config requires a file");
      } else if (!["--json", "--rtl", "--rich"].includes(args[i]))
        throw new Error(`Unknown option: ${args[i]}`);
    }
    const index = args.indexOf("--config");
    const config = await loadConfig(resolve(index < 0 ? "vibei18n.config.json" : args[index + 1]));
    const { diagnostics, catalogs } = await checkResources(config);
    if (diagnostics.length || command === "check") {
      output(
        args.includes("--json")
          ? JSON.stringify({ ok: !diagnostics.length, diagnostics })
          : diagnostics.length
            ? diagnostics.map((d) => `${d.file}: ${d.key || "<root>"} — ${d.message}`).join("\n")
            : `${catalogs.size} catalogs valid`,
      );
      if (diagnostics.length) return 1;
      if (command === "check") return 0;
    }
    const target = config.output;
    if (!target) throw new Error("Config needs output for generated artifacts.");
    if (command === "extract") {
      const references = (
        await Promise.all(
          (config.sources ?? []).map(async (file) =>
            extractMessages(await readFile(file, "utf8"), file),
          ),
        )
      ).flat();
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, JSON.stringify(references, null, 2) + "\n");
      output(
        `${references.length} references (${references.filter((r) => r.dynamic).length} dynamic)`,
      );
      return 0;
    }
    if (command === "generate") {
      const schemas = [...catalogs]
        .filter(([id]) => id.startsWith(`${config.sourceLocale}:`))
        .map(([id, catalog], index) => {
          const namespace = id.slice(id.indexOf(":") + 1);
          return generateTypes(catalog, {
            namespace: namespace === "default" ? undefined : namespace,
            name: `Namespace${index}`,
          });
        });
      const contents =
        schemas.join("\n") +
        `\nexport type Messages = ${schemas.map((_, i) => `Namespace${i}`).join(" & ")};\ndeclare module '@usevibejs/i18n' { interface Register { messages: Messages } }\n`;
      // One Value import per module, even with independently generated namespaces.
      const lines = contents.split("\n");
      let imported = false;
      const unique = lines.filter((line) => {
        if (!line.startsWith("import type")) return true;
        if (imported) return false;
        imported = true;
        return true;
      });
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, unique.join("\n"));
      output(`Generated ${target}`);
      return 0;
    }
    await mkdir(target, { recursive: true });
    for (const [id, catalog] of catalogs) {
      if (command === "pseudo" && !id.startsWith(`${config.sourceLocale}:`)) continue;
      const filename = `${command === "pseudo" ? (args.includes("--rtl") ? "en-XB" : "en-XA") : id.slice(0, id.indexOf(":"))}.${id.slice(id.indexOf(":") + 1)}.json`;
      await writeFile(
        resolve(target, filename),
        JSON.stringify(
          command === "compile"
            ? compileCatalog(catalog, { rich: args.includes("--rich") })
            : pseudoCatalog(catalog, { rtl: args.includes("--rtl") }),
          null,
          2,
        ) + "\n",
      );
    }
    output(`Wrote ${command} catalogs to ${target}`);
    return 0;
  } catch (error) {
    output(
      args.includes("--json")
        ? JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          })
        : error instanceof Error
          ? error.message
          : String(error),
    );
    return 2;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href
)
  process.exitCode = await run(process.argv.slice(2));
