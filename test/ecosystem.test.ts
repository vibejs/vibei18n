import { it, expect, vi } from "vitest";
import { QueryClient } from "@usevibejs/query";
import { computed, effectScope, shallowRef } from "@usevibejs/ui";
import { createI18n } from "../src/index.ts";
import { queryCatalogLoader } from "../examples/integrations/query.ts";
import { useStoredLocale } from "../examples/integrations/storage.ts";
import { localizedAuthError } from "../examples/integrations/auth.ts";
it("uses actual VibeQuery caching and explicit invalidation", async () => {
  const client = new QueryClient();
  const fetch = vi.fn(async () => ({ hello: "Merhaba" }));
  const i18n = createI18n({
    locale: "en",
    messages: { en: { hello: "Hello" } },
    loaders: { tr: queryCatalogLoader(client, "v1", fetch) },
  });
  await i18n.ready;
  await i18n.preload("tr");
  await i18n.preload("tr", ["default"], true);
  expect(fetch).toHaveBeenCalledTimes(1);
  await client.invalidateQueries({ queryKey: ["catalog", "v1", "tr", "default"] });
  await i18n.preload("tr", ["default"], true);
  expect(fetch).toHaveBeenCalledTimes(2);
  client.clear();
  i18n.dispose();
});
it("uses actual VibeUse storage ownership without duplicate echo writes", async () => {
  localStorage.clear();
  localStorage.setItem("test.locale", JSON.stringify("tr"));
  const i18n = createI18n({ locale: "en", messages: { en: { x: "X" }, tr: { x: "Y" } } });
  await i18n.ready;
  const scope = effectScope();
  const stop = await scope.run(() => useStoredLocale(i18n, "test.locale"))!;
  expect(i18n.locale.value).toBe("tr");
  await i18n.setLocale("en");
  await Promise.resolve();
  await Promise.resolve();
  expect(localStorage.getItem("test.locale")).toBe(JSON.stringify("en"));
  stop();
  scope.stop();
  i18n.dispose();
});
it("maps VibeAuth-compatible public codes and recomputes on locale changes", async () => {
  const i18n = createI18n({
    locale: "en",
    messages: {
      en: { generic: "Sign in failed", expired: "Please sign in again" },
      tr: { generic: "Giriş başarısız", expired: "Tekrar giriş yapın" },
    },
  });
  await i18n.ready;
  const error = shallowRef<unknown>({ code: "SESSION_EXPIRED", message: "secret backend detail" });
  const message = localizedAuthError(
    i18n,
    { error: computed(() => error.value) },
    { SESSION_EXPIRED: "expired" },
    "generic",
  );
  expect(message.value).toBe("Please sign in again");
  await i18n.setLocale("tr");
  expect(message.value).toBe("Tekrar giriş yapın");
  error.value = { code: "INTERNAL_DATABASE_FAILURE", message: "private" };
  expect(message.value).toBe("Giriş başarısız");
  error.value = null;
  expect(message.value).toBe("");
});
