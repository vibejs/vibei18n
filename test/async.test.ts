import { describe, it, expect, vi } from "vitest";
import { createI18n } from "../src/index.ts";
import { createCore } from "../src/core/index.ts";
import type { Catalog } from "../src/index.ts";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe("catalog transitions", () => {
  it("deduplicates loads, caches success, reloads and accepts dynamic import defaults", async () => {
    const load = vi.fn(async () => ({ default: { hello: "Merhaba" } }));
    const i18n = createI18n({
      locale: "en",
      messages: { en: { hello: "Hello" } },
      loaders: { tr: load },
    });
    await i18n.ready;
    await Promise.all([i18n.preload("tr"), i18n.preload("tr")]);
    expect(load).toHaveBeenCalledTimes(1);
    await i18n.setLocale("tr");
    expect(i18n.dynamic("hello")).toBe("Merhaba");
    expect(load).toHaveBeenCalledTimes(1);
    await i18n.preload("tr", ["default"], true);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("keeps the last requested locale when promises complete out of order", async () => {
    const fr = deferred<Catalog>(),
      de = deferred<Catalog>();
    const i18n = createI18n({
      locale: "en",
      messages: { en: { hello: "Hello" } },
      loaders: { fr: () => fr.promise, de: () => de.promise },
    });
    await i18n.ready;
    const first = i18n.setLocale("fr");
    const second = i18n.setLocale("de");
    expect(i18n.locale.value).toBe("en");
    expect(i18n.requestedLocale.value).toBe("de");
    expect(i18n.isLoading.value).toBe(true);
    de.resolve({ hello: "Hallo" });
    expect(await second).toBe(true);
    fr.resolve({ hello: "Bonjour" });
    expect(await first).toBe(false);
    expect(i18n.locale.value).toBe("de");
    expect(i18n.dynamic("hello")).toBe("Hallo");
  });
  it("retains the previous language on failure and permits deterministic retry", async () => {
    const load = vi
      .fn<() => Promise<Catalog>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ hello: "Bonjour" });
    const i18n = createI18n({
      locale: "en",
      messages: { en: { hello: "Hello" } },
      loaders: { fr: load },
    });
    await i18n.ready;
    await expect(i18n.setLocale("fr")).rejects.toThrow("offline");
    expect(i18n.locale.value).toBe("en");
    expect(i18n.error.value).toBeInstanceOf(Error);
    expect(i18n.isLoading.value).toBe(false);
    await i18n.setLocale("fr");
    expect(i18n.error.value).toBeUndefined();
    expect(i18n.locale.value).toBe("fr");
  });
  it("loads namespaces independently with fallback", async () => {
    const load = vi.fn(async () => ({ total: "Gesamt" }));
    const core = createCore({
      locale: "de",
      fallbackLocale: "en",
      messages: { de: { title: "Titel" }, en: { title: "Title" } },
      namespaces: { en: { billing: { tax: "Tax" } } },
      loaders: { de: { billing: load } },
    });
    await core.preload("de", ["billing"]);
    expect(core.t("billing:total")).toBe("Gesamt");
    expect(core.t("billing:tax")).toBe("Tax");
    await expect(core.preload("de", ["unknown"])).rejects.toThrow("No catalog");
  });
  it("never commits after disposal and aborts consumer-aware loaders", async () => {
    const load = deferred<Catalog>();
    let signal: AbortSignal | undefined;
    const i18n = createI18n({
      locale: "en",
      messages: { en: { title: "Title" } },
      loaders: {
        fr: (context) => {
          signal = context.signal;
          return load.promise;
        },
      },
    });
    await i18n.ready;
    const switching = i18n.setLocale("fr");
    await Promise.resolve();
    i18n.dispose();
    expect(signal?.aborted).toBe(true);
    load.resolve({ title: "Titre" });
    expect(await switching).toBe(false);
    expect(i18n.locale.value).toBe("en");
    await expect(i18n.setLocale("en")).rejects.toThrow("disposed");
  });
  it("rejects unsupported locales and missing initial catalogs", async () => {
    const i18n = createI18n({ locale: "en", messages: { en: { title: "Title" } } });
    await i18n.ready;
    await expect(i18n.setLocale("xx")).rejects.toThrow("Unsupported locale");
    const empty = createI18n({ locale: "en" });
    await expect(empty.ready).rejects.toThrow();
    expect(empty.error.value).toBeDefined();
  });
});
it("does not let an older resource load replace an explicit newer catalog", async () => {
  const pending = deferred<Catalog>();
  const i18n = createI18n({
    locale: "en",
    messages: { en: { x: "X" } },
    loaders: { tr: () => pending.promise },
  });
  await i18n.ready;
  const loading = i18n.preload("tr");
  await Promise.resolve();
  i18n.register("tr", { x: "New" });
  pending.resolve({ x: "Old" });
  await loading;
  await i18n.setLocale("tr");
  expect(i18n.dynamic("x")).toBe("New");
});
it("preserves raw nested default keys alongside other catalog keys", async () => {
  const core = createCore({
    locale: "en",
    loaders: { en: async () => ({ default: { nested: "Nested" }, other: "Other" }) },
  });
  await core.setLocale("en");
  expect(core.t("default.nested")).toBe("Nested");
  expect(core.t("other")).toBe("Other");
});
