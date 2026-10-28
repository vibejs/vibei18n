import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { canonicalLocale } from "../src/core/locale.ts";
import { validateNamespace } from "../src/core/catalog.ts";
import { readCatalogJSON, validateCatalog } from "./catalog.ts";
import type { CatalogDiagnostic } from "./catalog.ts";
import type { Catalog } from "../src/types/index.ts";
export interface Resource {
  locale: string;
  namespace?: string;
  file: string;
}
export interface Config {
  sourceLocale: string;
  resources: readonly Resource[];
  output?: string;
  sources?: readonly string[];
  allowMissingNamespaces?: boolean;
}
export async function loadConfig(file: string): Promise<Config> {
  const data: unknown = JSON.parse(await readFile(file, "utf8"));
  if (
    !data ||
    typeof data !== "object" ||
    !("sourceLocale" in data) ||
    typeof data.sourceLocale !== "string" ||
    !("resources" in data) ||
    !Array.isArray(data.resources)
  )
    throw new TypeError("Config needs sourceLocale and resources.");
  const config = data as Config;
  const tag = (value: string) => {
    try {
      return canonicalLocale(value);
    } catch {
      return value;
    }
  };
  for (const resource of config.resources)
    if (resource?.namespace !== undefined) validateNamespace(resource.namespace);
  for (const resource of config.resources)
    if (
      !resource ||
      typeof resource.locale !== "string" ||
      typeof resource.file !== "string" ||
      (resource.namespace !== undefined &&
        (typeof resource.namespace !== "string" ||
          !resource.namespace ||
          resource.namespace.includes(":")))
    )
      throw new TypeError("Invalid resource descriptor.");
  return {
    ...config,
    sourceLocale: tag(config.sourceLocale),
    resources: config.resources.map((resource) => ({
      ...resource,
      locale: tag(resource.locale),
      file: resolve(dirname(file), resource.file),
    })),
    output: config.output ? resolve(dirname(file), config.output) : undefined,
    sources: config.sources?.map((source) => resolve(dirname(file), source)),
  };
}
export async function checkResources(
  config: Config,
): Promise<{ diagnostics: CatalogDiagnostic[]; catalogs: Map<string, Catalog> }> {
  const diagnostics: CatalogDiagnostic[] = [];
  const catalogs = new Map<string, Catalog>();
  const seen = new Set<string>();
  for (const resource of config.resources) {
    const id = `${resource.locale}:${resource.namespace ?? "default"}`;
    if (seen.has(id)) {
      diagnostics.push({
        code: "duplicate",
        file: resource.file,
        key: id,
        message: "Duplicate resource locale/namespace",
      });
      continue;
    }
    seen.add(id);
    try {
      const parsed = readCatalogJSON(await readFile(resource.file, "utf8"), resource.file);
      diagnostics.push(...parsed.diagnostics);
      if (parsed.catalog) catalogs.set(id, parsed.catalog);
    } catch (error) {
      diagnostics.push({
        code: "structure",
        file: resource.file,
        key: "",
        message: error instanceof Error ? error.message : "Cannot read catalog",
      });
    }
  }
  const namespaces = new Set(config.resources.map((resource) => resource.namespace ?? "default"));
  if (!config.allowMissingNamespaces)
    for (const locale of new Set(config.resources.map((resource) => resource.locale)))
      for (const namespace of namespaces) {
        if (!seen.has(`${locale}:${namespace}`))
          diagnostics.push({
            code: "missing",
            file: "<config>",
            key: `${locale}:${namespace}`,
            message: "Missing namespace resource",
          });
      }
  for (const namespace of namespaces) {
    const source = catalogs.get(`${config.sourceLocale}:${namespace}`);
    if (!source) {
      diagnostics.push({
        code: "structure",
        file: "<config>",
        key: namespace,
        message: "Missing source locale catalog",
      });
      continue;
    }
    for (const resource of config.resources.filter(
      (resource) => (resource.namespace ?? "default") === namespace,
    )) {
      const target = catalogs.get(`${resource.locale}:${namespace}`);
      if (target)
        diagnostics.push(
          ...validateCatalog(source, target, { file: resource.file, locale: resource.locale }),
        );
    }
  }
  return { diagnostics, catalogs };
}
