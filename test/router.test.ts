import { it, expect } from "vitest";
import { createMemoryHistory, createRouter, isNavigationFailure } from "@usevibejs/ui/router";
import { createI18n } from "../src/index.ts";
import { connectI18nRouter, localeFromPath, localizePath } from "../src/router/index.ts";
import type { Catalog } from "../src/index.ts";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
it("preserves route suffix, query and hash and rejects external URLs", () => {
  expect(localizePath("/en/dashboard/item/42?sort=asc&tag=a#details", "tr", ["en", "tr"])).toBe(
    "/tr/dashboard/item/42?sort=asc&tag=a#details",
  );
  expect(localizePath("/dashboard?x=1#y", "tr", ["en", "tr"])).toBe("/tr/dashboard?x=1#y");
  expect(() => localizePath("//example.test", "en", ["en"])).toThrow();
  expect(localeFromPath("/xx/dashboard", ["en", "tr"])).toBeUndefined();
  expect(localeFromPath("/%zz/dashboard", ["en"])).toBeUndefined();
});
it("only activates on successful navigation and ignores cancelled loads", async () => {
  const fr = deferred<Catalog>();
  const i18n = createI18n({
    locale: "en",
    messages: { en: { title: "English" }, tr: { title: "Türkçe" } },
    loaders: {
      fr: () => fr.promise,
      de: async () => {
        throw new Error("offline");
      },
    },
  });
  await i18n.ready;
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:locale/dashboard/:id", name: "page" }],
  });
  const connection = connectI18nRouter(router, i18n);
  await router.push("/en/dashboard/42?sort=asc#details");
  const old = router.push("/fr/dashboard/42?sort=asc#details");
  await Promise.resolve();
  await connection.setLocale("tr");
  expect(i18n.locale.value).toBe("tr");
  expect(router.currentRoute.value.fullPath).toBe("/tr/dashboard/42?sort=asc#details");
  fr.resolve({ title: "Français" });
  expect(isNavigationFailure(await old, "cancelled")).toBe(true);
  expect(i18n.locale.value).toBe("tr");
  expect(isNavigationFailure(await connection.setLocale("de"), "aborted")).toBe(true);
  expect(i18n.locale.value).toBe("tr");
  expect(isNavigationFailure(await router.push("/xx/dashboard/42"), "aborted")).toBe(true);
  connection.stop();
  await router.push("/en/dashboard/42");
  expect(i18n.locale.value).toBe("tr");
});
it("does not activate when a later guard rejects navigation", async () => {
  const i18n = createI18n({ locale: "en", messages: { en: { x: "X" }, tr: { x: "Y" } } });
  await i18n.ready;
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:locale/dashboard" }],
  });
  connectI18nRouter(router, i18n);
  router.beforeResolve((to) => (to.path.startsWith("/tr") ? false : undefined));
  await router.push("/en/dashboard");
  await router.push("/tr/dashboard");
  expect(i18n.locale.value).toBe("en");
});
