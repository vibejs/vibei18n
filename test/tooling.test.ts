import { it, expect } from "vitest";
import {
  analyzeMessage,
  validateCatalog,
  readCatalogJSON,
  generateTypes,
  compileCatalog,
  pseudoCatalog,
  extractMessages,
} from "../tooling/index.ts";
import { IntlEngine } from "../src/core/index.ts";
it("reports missing, extra, ICU syntax and placeholder type mismatches", () => {
  const source = {
    hello: "Hi {name}",
    total: "{n, number}",
    cart: "{n, plural, one {# item} other {# items}}",
    date: "{date, date}",
    missing: "Missing",
  };
  const target = {
    hello: "Hello {wrong}",
    total: "{n}",
    cart: "{n, plural, one {One}}",
    date: "{date, number}",
    extra: "Extra",
  };
  const diagnostics = validateCatalog(source, target, {
    file: "locales/tr.json",
    locale: "bad_tag",
  });
  for (const code of ["missing", "extra", "syntax", "parameter", "locale"])
    expect(diagnostics.some((d) => d.code === code)).toBe(true);
  expect(diagnostics.every((d) => d.file === "locales/tr.json")).toBe(true);
  expect(() => analyzeMessage("{x, plural, other {{x, select, other {invalid}}}}")).toThrow(
    "Incompatible",
  );
});
it("rejects invalid JSON, duplicates and formats", () => {
  expect(readCatalogJSON('{"a":"A","a":"B"}').diagnostics[0].code).toBe("duplicate");
  expect(readCatalogJSON('{"a":}').diagnostics[0].code).toBe("syntax");
  expect(readCatalogJSON('{"a":123}').diagnostics[0].code).toBe("structure");
  expect(readCatalogJSON('["a"]').diagnostics[0].code).toBe("structure");
});
it("generates exact AST-derived types including nested plural/select/date arguments", () => {
  const result = generateTypes({
    simple: "Save",
    greeting: "Hi {name}",
    cart: "{n, plural, one {{gender, select, other {{date, date}}}} other {#}}",
  });
  expect(result).toContain('"n": number');
  expect(result).toContain('"gender": string');
  expect(result).toContain('"date": Date | number');
  expect(result).toContain('"name": Value');
  expect(result).toContain('"simple": {  }');
});
it("precompiles and pseudolocalizes literal AST nodes without corrupting ICU or escaping", () => {
  const catalog = {
    cart: "{n, plural, =0 {None} one {# item for {name}} other {# items for {name}}}",
    quoted: "'{name}' {name}",
  };
  const engine = new IntlEngine();
  expect(
    engine.format("en", compileCatalog(catalog).cart as import("../src/index.ts").Message, {
      n: 2,
      name: "Alex",
    }),
  ).toBe("2 items for Alex");
  for (const rtl of [false, true]) {
    const pseudo = pseudoCatalog(catalog, { rtl });
    expect([...analyzeMessage(pseudo.cart as string).keys()]).toEqual(["n", "name"]);
    expect(engine.format("en", pseudo.cart as string, { n: 2, name: "Alex" })).toContain("Alex");
    expect(analyzeMessage(pseudo.quoted as string).size).toBe(1);
  }
  expect(() => pseudoCatalog(catalog, { expansion: 10 })).toThrow();
});
it("extracts TS and public .vibe ASTs with locations and explicit dynamic references", async () => {
  const ts = await extractMessages("t('hello'); i18n.t('common.save'); t(key);", "app.ts");
  expect(ts.map((r) => r.key)).toEqual(["hello", "common.save", undefined]);
  expect(ts[2].dynamic).toBe(true);
  const vibe = await extractMessages(
    '<script setup lang="ts">\nconst title = t("title");\n</script>\n<template><h1>{{ t(\'welcome\') }}</h1><button :title="t(\'save\')">Save</button></template>',
    "App.vibe",
  );
  expect(vibe.map((r) => r.key)).toEqual(["title", "welcome", "save"]);
  expect(vibe[0].line).toBe(2);
  await expect(
    extractMessages("<template><h1>{{ broken( }}</h1></template>", "Broken.vibe"),
  ).rejects.toThrow();
});
it("extracts calls in multi-statement template event handlers", async () => {
  const references = await extractMessages(
    "<template><button @click=\"a(); t('save')\">Save</button></template>",
    "Event.vibe",
  );
  expect(references[0].key).toBe("save");
});
it("rejects malformed precompiled AST resources", () => {
  for (const ast of [
    [{ type: 0, value: 123 }],
    [
      {
        type: 6,
        value: "n",
        offset: -1,
        pluralType: "cardinal",
        options: { other: { value: [] } },
      },
    ],
    [{ type: 8, value: "b", children: null }],
  ])
    expect(
      validateCatalog({ x: "X" }, { x: ast } as unknown as import("../src/index.ts").Catalog).some(
        (d) => d.code === "syntax",
      ),
    ).toBe(true);
});
it("precompiles plain markup as inert text and rich messages only by explicit opt-in", () => {
  const source = { terms: "Read <b>{name}</b>." };
  const engine = new IntlEngine();
  const plain = compileCatalog(source);
  expect(
    engine.format("en", plain.terms as import("../src/index.ts").Message, { name: "Alex" }),
  ).toBe(engine.format("en", source.terms, { name: "Alex" }));
  const rich = compileCatalog(source, { rich: true });
  expect(
    engine.rich("en", rich.terms as import("../src/index.ts").Message, { name: "Alex" }, ["b"]),
  ).toEqual(["Read ", { type: "tag", name: "b", children: ["Alex"] }, "."]);
});
