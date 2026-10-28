export {
  analyzeMessage,
  messageAST,
  validateCatalog,
  readCatalogJSON,
  generateTypes,
  compileCatalog,
  pseudoCatalog,
} from "./catalog.ts";
export type { CatalogDiagnostic, Parameter, PseudoOptions } from "./catalog.ts";
// Extraction has explicit compiler/Oxc peers; ordinary catalog commands don't load them.
export async function extractMessages(
  ...args: Parameters<typeof import("./extract.ts").extractMessages>
): Promise<import("./extract.ts").Reference[]> {
  return (await import("./extract.ts")).extractMessages(...args);
}
export type { Reference } from "./extract.ts";
