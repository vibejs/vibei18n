import type { QueryClient } from "@usevibejs/query";
import type { Catalog, Loader } from "../../src/index.ts";
/** QueryClient owns network caching. Invalidate its key before asking i18n to reload. */
export function queryCatalogLoader(
  client: QueryClient,
  version: string,
  fetchCatalog: (locale: string, namespace: string, signal: AbortSignal) => Promise<Catalog>,
): Loader {
  return ({ locale, namespace }) =>
    client.fetchQuery({
      queryKey: ["catalog", version, locale, namespace],
      staleTime: Infinity,
      queryFn: ({ signal }) => fetchCatalog(locale, namespace, signal),
    });
}
