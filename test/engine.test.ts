import { describe, expect, it } from "vitest";
import {
  IntlEngine,
  createCore,
  directionOf,
  fallbackChain,
  negotiateLocale,
} from "../src/core/index.ts";
import { parse } from "@formatjs/icu-messageformat-parser";
describe("ICU and Intl", () => {
  it("supports nested ICU, selects, exact cases, offsets, ordinals, escaping and ASTs", () => {
    const engine = new IntlEngine();
    expect(engine.format("en", "Hello, {name}!", { name: "Alex" })).toBe("Hello, Alex!");
    expect(
      engine.format("en", "{count, plural, =0 {None} one {# item} other {# items}}", { count: 0 }),
    ).toBe("None");
    expect(
      engine.format(
        "en",
        "{gender, select, female {{count, plural, one {Her item} other {Her # items}}} other {Their items}}",
        { gender: "female", count: 2 },
      ),
    ).toBe("Her 2 items");
    expect(
      engine.format("en", "{n, plural, offset:1 =0 {Nobody} one {One guest} other {# guests}}", {
        n: 4,
      }),
    ).toBe("3 guests");
    expect(
      engine.format("en", "{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}", {
        n: 22,
      }),
    ).toBe("22nd");
    expect(engine.format("en", "'{name}' {name}", { name: "A" })).toBe("{name} A");
    expect(engine.format("de", parse("{n, number}"), { n: 1234.5 })).toBe(
      new Intl.NumberFormat("de").format(1234.5),
    );
    expect(() => engine.format("en", "{x, plural, one {One}}", { x: 1 })).toThrow();
  });
  for (const locale of ["en", "tr", "fr", "de", "ru", "ar", "ja", "ko", "pl", "cs"]) {
    it(`uses actual ${locale} plural categories`, () => {
      const engine = new IntlEngine();
      const rules = new Intl.PluralRules(locale);
      const message =
        "{n, plural, zero {zero} one {one} two {two} few {few} many {many} other {other}}";
      for (const n of [0, 1, 2, 3, 4, 5, 11, 21, 101, 1.5])
        expect(engine.format(locale, message, { n })).toBe(rules.select(n));
    });
  }
  it("uses Intl formatters, timezone, currencies, lists, relative time and collation", () => {
    const engine = new IntlEngine(undefined, 8, "UTC");
    for (const locale of ["en", "de", "tr", "ja"]) {
      expect(engine.number(locale).format(1234.56)).toBe(
        new Intl.NumberFormat(locale).format(1234.56),
      );
      for (const currency of ["USD", "EUR", "JPY"])
        expect(engine.number(locale, { style: "currency", currency }).format(1234.56)).toBe(
          new Intl.NumberFormat(locale, { style: "currency", currency }).format(1234.56),
        );
      expect(engine.date(locale, { dateStyle: "long" }).format(0)).toBe(
        new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(0),
      );
      expect(engine.relative(locale, { numeric: "auto" }).format(-1, "day")).toBe(
        new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day"),
      );
      expect(engine.list(locale).format(["A", "B", "C"])).toBe(
        new Intl.ListFormat(locale).format(["A", "B", "C"]),
      );
      expect(engine.collator(locale).compare("a", "b")).toBeLessThan(0);
    }
  });
  it("bounds caches, keys by locale/content/options and records hits", () => {
    const engine = new IntlEngine(undefined, 2);
    engine.format("en", "{x}", { x: 1 });
    engine.format("en", "{x}", { x: 2 });
    expect(engine.messages.hits).toBe(1);
    engine.format("de", "{x}", { x: 1 });
    engine.format("tr", "{x}", { x: 1 });
    expect(engine.messages.size).toBe(2);
    expect(engine.number("en", { maximumFractionDigits: 1 })).toBe(
      engine.number("en", { maximumFractionDigits: 1 }),
    );
    expect(engine.number("en")).not.toBe(engine.number("tr"));
    expect(() => new IntlEngine(undefined, 0)).toThrow();
  });
  it("canonicalizes BCP47 and follows bounded explicit script-aware chains", () => {
    expect(
      fallbackChain("zh-Hant-TW-u-nu-hanidec", {
        "zh-Hant": ["en"],
        en: ["zh-Hant"],
        default: ["tr"],
      }),
    ).toEqual(["zh-Hant-TW-u-nu-hanidec", "zh-Hant-TW", "zh-Hant", "en", "zh", "tr"]);
    expect(fallbackChain("fr-CA", "en")).toEqual(["fr-CA", "fr", "en"]);
    expect(negotiateLocale(["bad_tag", "TR-tr"], ["en", "tr"])).toBe("tr");
    expect(negotiateLocale(["pt-PT"], ["pt-BR"])).toBeUndefined();
    for (const locale of ["ar", "he"]) expect(directionOf(locale)).toBe("rtl");
    for (const locale of ["en", "tr", "fr", "az-Latn"]) expect(directionOf(locale)).toBe("ltr");
    expect(directionOf("az-Arab")).toBe("rtl");
  });
  it("resolves catalogs, namespaces and fallback diagnostics without values", () => {
    const diagnostics: unknown[] = [];
    const core = createCore({
      locale: "tr-TR",
      fallbackLocale: "en",
      messages: {
        en: { account: { save: "Save" }, greeting: "Hi {name}" },
        tr: { cancel: "İptal" },
      },
      namespaces: { en: { billing: { total: "Total" } } },
      onDiagnostic: (d) => diagnostics.push(d),
    });
    expect(core.t("account.save")).toBe("Save");
    expect(core.t("cancel")).toBe("İptal");
    expect(core.t("billing:total")).toBe("Total");
    core.t("missing");
    core.t("missing");
    expect(diagnostics.filter((d) => (d as { code: string }).code === "missing")).toHaveLength(1);
    expect(() => core.t("greeting", { secret: "sensitive" })).toThrow("required parameters");
    expect(JSON.stringify(diagnostics)).not.toContain("sensitive");
    core.register("en", { account: { save: "New" } }, "default", "merge");
    expect(core.t("account.save")).toBe("New");
    expect(core.t("greeting", { name: "A" })).toBe("Hi A");
  });
  it("handles malicious-looking values as inert text and rich tokens", () => {
    const core = createCore({
      locale: "en",
      messages: { en: { x: "<script>alert(1)</script> {name}", rich: "Read <b>{name}</b>." } },
    });
    expect(core.t("x", { name: "<img onerror=alert(1)>" })).toContain("<img onerror=alert(1)>");
    expect(core.rich("rich", { name: "<script>" }, ["b"])).toEqual([
      "Read ",
      { type: "tag", name: "b", children: ["<script>"] },
      ".",
    ]);
    expect(() => core.rich("rich", { name: "A" }, [])).toThrow();
    expect(() => core.register("en", JSON.parse('{"__proto__":{"x":"bad"}}'))).toThrow();
    expect(() => core.register("en", { a: { b: "a" }, "a.b": "b" })).toThrow("Duplicate");
  });
});
it("supports custom ICU formats, skeletons and configured timezones", () => {
  const engine = new IntlEngine(
    {
      number: { money: { style: "currency", currency: "JPY" } },
      date: { business: { year: "numeric", month: "2-digit", day: "2-digit" } },
    },
    16,
    "Pacific/Honolulu",
  );
  expect(engine.format("en", "{n, number, money}", { n: 1234.5 })).toBe(
    new Intl.NumberFormat("en", { style: "currency", currency: "JPY" }).format(1234.5),
  );
  expect(engine.format("en", "{at, date, business}", { at: 0 })).toBe(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Pacific/Honolulu",
    }).format(0),
  );
  expect(engine.format("en", "{n, number, ::currency/USD}", { n: 10 })).toContain("10");
});
it("requires own interpolation properties and rejects executable parameter objects", () => {
  const engine = new IntlEngine();
  expect(() => engine.format("en", "{constructor}", {})).toThrow();
  expect(() =>
    engine.format("en", "{x}", { x: () => "code" } as unknown as import("../src/index.ts").Values),
  ).toThrow("type");
  expect(engine.format("en", "{x}", { x: 12n })).toBe("12");
});
it("retains language and script parents when locale variants are present", () => {
  expect(fallbackChain("sl-rozaj-biske", false)).toEqual(["sl-biske-rozaj", "sl"]);
  expect(fallbackChain("de-Latn-DE-1996", false)).toEqual([
    "de-Latn-DE-1996",
    "de-Latn-DE",
    "de-Latn",
    "de",
  ]);
});
