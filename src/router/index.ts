import type { Router, RouteRecordRaw, NavigationGuard } from "@usevibejs/ui/router";
import { canonicalLocale, negotiateLocale } from "../core/locale.ts";
import type { I18n } from "../adapter/index.ts";
import type { MessageSchema } from "../types/index.ts";
export function localeFromPath(path: string, supported: readonly string[]): string | undefined {
  const segment = path.split(/[/?#]/)[1];
  try {
    return negotiateLocale([decodeURIComponent(segment ?? "")], supported);
  } catch {
    return undefined;
  }
}
export function localizePath(path: string, locale: string, supported: readonly string[]): string {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new TypeError("Locale paths must be application-relative paths.");
  const tag = canonicalLocale(locale);
  if (!supported.includes(tag)) throw new RangeError(`Unsupported locale: ${tag}`);
  const match = /^\/([^/?#]+)(.*)$/.exec(path);
  const existing = match ? localeFromPath(`/${match[1]}`, supported) : undefined;
  return existing ? `/${tag}${match![2] || "/"}` : `/${tag}${path}`;
}
export interface LocaleRoutingOptions {
  namespaces?: readonly string[];
  unsupported?: "abort" | "ignore";
}
export function createI18nRouteGuard<R extends readonly RouteRecordRaw[], S extends MessageSchema>(
  i18n: I18n<S>,
  options: LocaleRoutingOptions = {},
): NavigationGuard<R> {
  return async (to) => {
    const locale = localeFromPath(to.path, i18n.availableLocales.value);
    if (!locale) return options.unsupported === "ignore" ? undefined : false;
    try {
      await i18n.core.prepareLocale(locale, options.namespaces);
    } catch {
      return false;
    }
    return undefined;
  };
}
/** URL is the source of truth. Prepare in a guard, commit only on successful afterEach. */
export function connectI18nRouter<R extends readonly RouteRecordRaw[], S extends MessageSchema>(
  router: Router<R>,
  i18n: I18n<S>,
  options: LocaleRoutingOptions = {},
) {
  const unguard = router.beforeResolve(createI18nRouteGuard<R, S>(i18n, options));
  const unhook = router.afterEach((to, _from, failure) => {
    if (failure) return;
    const locale = localeFromPath(to.path, i18n.availableLocales.value);
    if (locale) i18n.core.activateLocale(locale);
  });
  return {
    setLocale(locale: string) {
      return router.push(
        localizePath(router.currentRoute.value.fullPath, locale, i18n.availableLocales.value),
      );
    },
    stop() {
      unguard();
      unhook();
    },
  };
}
