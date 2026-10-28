import { it, expect, vi } from "vitest";
import { computed, effectScope, watchEffect, createApp, nextTick } from "@usevibejs/ui";
import {
  createI18n,
  useI18n,
  useLocale,
  useDirection,
  useNumberFormat,
  useDateFormat,
  useRelativeTimeFormat,
  useListFormat,
  usePluralRules,
  syncDocument,
  persistLocale,
} from "../src/index.ts";
it("tracks native computed translations, formats, scopes and unrelated namespaces", async () => {
  const i18n = createI18n({
    locale: "en",
    messages: { en: { x: "English" }, tr: { x: "Türkçe" } },
    namespaces: { en: { billing: { x: "Bill" } } },
  });
  await i18n.ready;
  const scope = effectScope();
  let title = "";
  const runs = vi.fn();
  scope.run(() =>
    watchEffect(() => {
      title = i18n.t("x");
      runs();
    }),
  );
  const number = computed(() => i18n.n(1234.5));
  await i18n.setLocale("tr");
  await nextTick();
  expect(title).toBe("Türkçe");
  expect(number.value).toBe(new Intl.NumberFormat("tr").format(1234.5));
  i18n.register("en", { x: "BILL" }, "billing");
  await nextTick();
  expect(runs).toHaveBeenCalledTimes(2);
  i18n.register("tr", { x: "Yeni" });
  await nextTick();
  expect(title).toBe("Yeni");
  scope.stop();
  await i18n.setLocale("en");
  await nextTick();
  expect(title).toBe("Yeni");
});
it("uses app-scoped context, rejects missing context, supports formatter composables", async () => {
  expect(() => useI18n()).toThrow("setup");
  const app = createApp({ render: () => document.createTextNode("") });
  expect(() => app.runWithContext(() => useI18n())).toThrow("Install");
  const first = createI18n({ locale: "en", messages: { en: { x: "First" } } });
  const second = createI18n({ locale: "tr", messages: { tr: { x: "İkinci" } } });
  await Promise.all([first.ready, second.ready]);
  const a = createApp({ render: () => document.createTextNode("") }).use(first),
    b = createApp({ render: () => document.createTextNode("") }).use(second);
  expect(a.runWithContext(() => useI18n().dynamic("x"))).toBe("First");
  expect(b.runWithContext(() => useI18n().dynamic("x"))).toBe("İkinci");
  a.runWithContext(() => {
    expect(useLocale().value).toBe("en");
    expect(useDirection().value).toBe("ltr");
    expect(useNumberFormat().value).toBeInstanceOf(Intl.NumberFormat);
    expect(useDateFormat().value).toBeInstanceOf(Intl.DateTimeFormat);
    expect(useRelativeTimeFormat().value).toBeInstanceOf(Intl.RelativeTimeFormat);
    expect(useListFormat().value).toBeInstanceOf(Intl.ListFormat);
    expect(usePluralRules().value).toBeInstanceOf(Intl.PluralRules);
  });
  expect(() => createApp({ render: () => document.createTextNode("") }).use(first)).toThrow(
    "separate",
  );
});
it("owns document attributes explicitly, restores safely and prevents ownership conflicts", async () => {
  const i18n = createI18n({ locale: "en", messages: { en: { x: "X" }, ar: { x: "س" } } });
  await i18n.ready;
  const root = document.createElement("div");
  root.lang = "fr";
  const stop = syncDocument(i18n, root);
  expect(root.lang).toBe("en");
  expect(() => syncDocument(i18n, root)).toThrow("owner");
  await i18n.setLocale("ar");
  expect(root.dir).toBe("rtl");
  root.dir = "ltr";
  stop();
  expect(root.lang).toBe("fr");
  expect(root.dir).toBe("ltr");
  stop();
});
it("persists only opt-in changes and suppresses cross-tab echoes", async () => {
  const i18n = createI18n({ locale: "en", messages: { en: { x: "X" }, tr: { x: "Y" } } });
  await i18n.ready;
  const write = vi.fn();
  let notify!: (locale: string | null) => void;
  const unlisten = vi.fn();
  const stop = await persistLocale(i18n, {
    read: () => "tr",
    write,
    subscribe(cb) {
      notify = cb;
      return unlisten;
    },
  });
  expect(i18n.locale.value).toBe("tr");
  expect(write).not.toHaveBeenCalled();
  await i18n.setLocale("en");
  await Promise.resolve();
  expect(write).toHaveBeenCalledWith("en");
  notify("tr");
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(write).toHaveBeenCalledTimes(1);
  stop();
  expect(unlisten).toHaveBeenCalledTimes(1);
});
it("keeps configured route precedence and cancels stale asynchronous preference reads", async () => {
  const i18n = createI18n({ locale: "en", messages: { en: { x: "X" }, tr: { x: "Y" } } });
  await i18n.ready;
  const write = vi.fn();
  const read = vi.fn(() => "tr");
  const stop = await persistLocale(i18n, { read, write }, { initial: false });
  expect(read).not.toHaveBeenCalled();
  expect(i18n.locale.value).toBe("en");
  stop();
  let resolve!: (value: string) => void;
  const pending = persistLocale(i18n, {
    read: () =>
      new Promise<string>((yes) => {
        resolve = yes;
      }),
    write,
  });
  await i18n.setLocale("tr");
  await i18n.setLocale("en");
  resolve("tr");
  const cleanup = await pending;
  expect(i18n.locale.value).toBe("en");
  cleanup();
});
it("exposes all formatting helpers and explicit direction overrides reactively", async () => {
  const i18n = createI18n({
    locale: "en",
    direction: "rtl",
    timeZone: "UTC",
    messages: { en: { x: "X" }, tr: { x: "Y" } },
  });
  await i18n.ready;
  expect(i18n.dir.value).toBe("rtl");
  expect(i18n.list(["A", "B"])).toBe(new Intl.ListFormat("en").format(["A", "B"]));
  expect(i18n.rt(2, "hour")).toBe(new Intl.RelativeTimeFormat("en").format(2, "hour"));
  expect(i18n.d(0, { dateStyle: "short" })).toBe(
    new Intl.DateTimeFormat("en", { timeZone: "UTC", dateStyle: "short" }).format(0),
  );
  expect(i18n.dateRange(0, 86400000, { dateStyle: "short" })).toBe(
    new Intl.DateTimeFormat("en", { timeZone: "UTC", dateStyle: "short" }).formatRange(0, 86400000),
  );
  expect(i18n.compare("a", "b")).toBeLessThan(0);
  expect(i18n.use()).toBe(i18n);
  await i18n.setLocale("tr");
  expect(i18n.list(["A", "B"])).toBe(new Intl.ListFormat("tr").format(["A", "B"]));
});
