import type { Plugin } from "vite";
import { resolve } from "node:path";
import { loadConfig, checkResources } from "./config.ts";
/** Validate on start/build and catalog changes; Vite handles JSON module HMR. */
export function vibeI18n(options: { config?: string } = {}): Plugin {
  let root = process.cwd();
  const check = async () => {
    const config = await loadConfig(resolve(root, options.config ?? "vibei18n.config.json"));
    const result = await checkResources(config);
    if (result.diagnostics.length)
      throw new Error(
        result.diagnostics.map((d) => `${d.file}: ${d.key} — ${d.message}`).join("\n"),
      );
    return config;
  };
  return {
    name: "vibei18n",
    configResolved(config) {
      root = config.root;
    },
    async buildStart() {
      const config = await check();
      this.addWatchFile(resolve(root, options.config ?? "vibei18n.config.json"));
      for (const resource of config.resources) this.addWatchFile(resource.file);
    },
    async hotUpdate() {
      await check();
    },
  };
}
