import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
import type { MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { printAST } from "@formatjs/icu-messageformat-parser/printer.js";
import { parseTree, printParseErrorCode } from "jsonc-parser";
import type { Node as JsonNode, ParseError } from "jsonc-parser";
import { flattenCatalog } from "../src/core/catalog.ts";
import type { Catalog, Message } from "../src/types/index.ts";
import { canonicalLocale } from "../src/core/locale.ts";
export interface CatalogDiagnostic {
  code: "syntax" | "structure" | "missing" | "extra" | "parameter" | "locale" | "duplicate";
  file: string;
  key: string;
  message: string;
  offset?: number;
}
export interface Parameter {
  type: "value" | "number" | "date" | "select" | "tag";
  roles: readonly string[];
}
export function messageAST(message: Message): MessageFormatElement[] {
  return typeof message === "string"
    ? parse(message, { captureLocation: false, requiresOtherClause: true })
    : structuredClone([...message]);
}
export function analyzeMessage(message: Message): ReadonlyMap<string, Parameter> {
  const result = new Map<string, Parameter>();
  const add = (name: string, type: Parameter["type"], role: string) => {
    const previous = result.get(name);
    if (previous && previous.type !== type && previous.type !== "value" && type !== "value")
      throw new TypeError(`Incompatible uses of parameter {${name}}`);
    result.set(name, {
      type: previous && type === "value" ? previous.type : type,
      roles: [...new Set([...(previous?.roles ?? []), role])].sort(),
    });
  };
  function walk(nodes: readonly MessageFormatElement[], depth = 0): void {
    if (!Array.isArray(nodes) || depth > 64)
      throw new TypeError("Invalid or excessively nested message AST.");
    for (const node of nodes) {
      if (!node || typeof node !== "object" || !Number.isInteger(node.type))
        throw new TypeError("Invalid message AST element.");
      if (node.type !== TYPE.pound && typeof node.value !== "string")
        throw new TypeError("Message AST values must be strings.");
      if (node.type !== TYPE.literal && node.type !== TYPE.pound && !node.value)
        throw new TypeError("Empty AST parameter name.");
      if (
        node.type === TYPE.plural &&
        (!Number.isFinite(node.offset) ||
          node.offset < 0 ||
          !["cardinal", "ordinal"].includes(node.pluralType))
      )
        throw new TypeError("Invalid plural AST configuration.");
      if (
        (node.type === TYPE.number || node.type === TYPE.date || node.type === TYPE.time) &&
        node.style != null &&
        typeof node.style !== "string" &&
        (typeof node.style !== "object" ||
          ![0, 1].includes(node.style.type) ||
          !node.style.parsedOptions ||
          typeof node.style.parsedOptions !== "object")
      )
        throw new TypeError("Invalid AST format style.");
      switch (node.type) {
        case TYPE.argument:
          add(node.value, "value", "argument");
          break;
        case TYPE.number:
          add(node.value, "number", "number");
          break;
        case TYPE.date:
        case TYPE.time:
          add(node.value, "date", node.type === TYPE.date ? "date" : "time");
          break;
        case TYPE.select:
        case TYPE.plural:
          add(
            node.value,
            node.type === TYPE.select ? "select" : "number",
            node.type === TYPE.select
              ? "select"
              : node.pluralType === "ordinal"
                ? "ordinal"
                : "plural",
          );
          if (
            !node.options ||
            typeof node.options !== "object" ||
            !Object.hasOwn(node.options, "other")
          )
            throw new TypeError(`Missing other branch for {${node.value}}`);
          for (const option of Object.values<
            import("@formatjs/icu-messageformat-parser").PluralOrSelectOption
          >(node.options))
            walk(option.value, depth + 1);
          break;
        case TYPE.tag:
          add(node.value, "tag", "tag");
          walk(node.children, depth + 1);
          break;
        case TYPE.literal:
        case TYPE.pound:
          break;
        default:
          throw new TypeError("Unsupported message AST element.");
      }
    }
  }
  walk(messageAST(message));
  return result;
}
export function validateCatalog(
  source: Catalog,
  target: Catalog,
  options: { file?: string; locale?: string; allowExtra?: boolean } = {},
): CatalogDiagnostic[] {
  const file = options.file ?? "<catalog>";
  const diagnostics: CatalogDiagnostic[] = [];
  if (options.locale)
    try {
      canonicalLocale(options.locale);
      if (!Intl.NumberFormat.supportedLocalesOf(options.locale).length)
        diagnostics.push({
          code: "locale",
          file,
          key: "",
          message: `Locale is not supported by this host's Intl data: ${options.locale}`,
        });
    } catch {
      diagnostics.push({
        code: "locale",
        file,
        key: "",
        message: `Invalid locale identifier: ${options.locale}`,
      });
    }
  let base: ReadonlyMap<string, Message>, translated: ReadonlyMap<string, Message>;
  try {
    base = flattenCatalog(source);
    translated = flattenCatalog(target);
  } catch (error) {
    return [
      ...diagnostics,
      {
        code: "structure",
        file,
        key: "",
        message: error instanceof Error ? error.message : "Invalid catalog",
      },
    ];
  }
  const analysis = (key: string, message: Message) => {
    try {
      return analyzeMessage(message);
    } catch (error) {
      diagnostics.push({
        code: "syntax",
        file,
        key,
        message: error instanceof Error ? error.message : "Invalid ICU",
      });
      return undefined;
    }
  };
  const sourceParameters = new Map(
    [...base].map(([key, message]) => [key, analysis(key, message)]),
  );
  for (const [key, message] of translated) {
    const parameters = analysis(key, message);
    if (!base.has(key)) {
      if (!options.allowExtra)
        diagnostics.push({ code: "extra", file, key, message: "Unexpected extra key" });
      continue;
    }
    const expected = sourceParameters.get(key);
    if (!parameters || !expected) continue;
    for (const [name, parameter] of expected) {
      const actual = parameters.get(name);
      if (!actual)
        diagnostics.push({
          code: "parameter",
          file,
          key,
          message: `Missing placeholder {${name}}`,
        });
      else if (actual.type !== parameter.type || actual.roles.join() !== parameter.roles.join())
        diagnostics.push({
          code: "parameter",
          file,
          key,
          message: `Placeholder {${name}} has incompatible type or ICU usage (${parameter.roles.join("/")} → ${actual.roles.join("/")})`,
        });
    }
    for (const name of parameters.keys())
      if (!expected.has(name))
        diagnostics.push({
          code: "parameter",
          file,
          key,
          message: `Unexpected placeholder {${name}}`,
        });
  }
  for (const key of base.keys())
    if (!translated.has(key))
      diagnostics.push({ code: "missing", file, key, message: "Missing translation key" });
  return diagnostics;
}
export function readCatalogJSON(
  text: string,
  file = "<catalog>",
): { catalog?: Catalog; diagnostics: CatalogDiagnostic[] } {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: false, disallowComments: true });
  const diagnostics: CatalogDiagnostic[] = errors.map((error) => ({
    code: "syntax",
    file,
    key: "",
    message: printParseErrorCode(error.error),
    offset: error.offset,
  }));
  function walk(node: JsonNode, path: string): void {
    if (node.type === "object") {
      const names = new Set<string>();
      for (const property of node.children ?? []) {
        const name: string = property.children?.[0]?.value;
        if (names.has(name))
          diagnostics.push({
            code: "duplicate",
            file,
            key: path ? `${path}.${name}` : name,
            message: "Duplicate JSON property",
            offset: property.offset,
          });
        names.add(name);
        if (property.children?.[1]) walk(property.children[1], path ? `${path}.${name}` : name);
      }
    }
  }
  if (root) walk(root, "");
  if (diagnostics.length) return { diagnostics };
  try {
    const catalog: unknown = JSON.parse(text);
    flattenCatalog(catalog as Catalog);
    return { catalog: catalog as Catalog, diagnostics };
  } catch (error) {
    return {
      diagnostics: [
        {
          code: "structure",
          file,
          key: "",
          message: error instanceof Error ? error.message : "Invalid catalog",
        },
      ],
    };
  }
}
export function generateTypes(
  catalog: Catalog,
  options: { namespace?: string; name?: string; augment?: boolean } = {},
): string {
  const lines = [
    "// Generated by vibei18n generate. Do not edit.",
    "import type { Value } from '@usevibejs/i18n';",
    `export type ${options.name ?? "Messages"} = {`,
  ];
  for (const [key, message] of flattenCatalog(catalog)) {
    const parameters = analyzeMessage(message);
    if ([...parameters.values()].some((parameter) => parameter.type === "tag"))
      throw new TypeError(`Rich message ${key} needs token callbacks; use rich() explicitly.`);
    const type = (parameter: Parameter): string =>
      parameter.type === "number"
        ? "number"
        : parameter.type === "date"
          ? "Date | number"
          : parameter.type === "select"
            ? "string"
            : "Value";
    lines.push(
      `  readonly ${JSON.stringify(options.namespace ? `${options.namespace}:${key}` : key)}: { ${[...parameters].map(([name, p]) => `readonly ${JSON.stringify(name)}: ${type(p)}`).join("; ")} };`,
    );
  }
  lines.push("}");
  if (options.augment)
    lines.push(
      `declare module '@usevibejs/i18n' { interface Register { messages: ${options.name ?? "Messages"} } }`,
    );
  return lines.join("\n") + "\n";
}
export function compileCatalog(catalog: Catalog, options: { rich?: boolean } = {}): Catalog {
  return Object.fromEntries(
    [...flattenCatalog(catalog)].map(([key, message]) => {
      analyzeMessage(message);
      return [
        key,
        typeof message === "string"
          ? parse(message, { ignoreTag: options.rich !== true, requiresOtherClause: true })
          : messageAST(message),
      ];
    }),
  );
}
const accents: Readonly<Record<string, string>> = {
  a: "à",
  b: "ƀ",
  c: "ç",
  d: "đ",
  e: "ë",
  f: "ƒ",
  g: "ğ",
  h: "ħ",
  i: "ï",
  j: "ĵ",
  k: "ķ",
  l: "ľ",
  m: "ɱ",
  n: "ñ",
  o: "ö",
  p: "þ",
  q: "ɋ",
  r: "ř",
  s: "š",
  t: "ţ",
  u: "ü",
  v: "ṽ",
  w: "ŵ",
  x: "ẋ",
  y: "ÿ",
  z: "ž",
};
export interface PseudoOptions {
  rtl?: boolean;
  expansion?: number;
}
export function pseudoCatalog(catalog: Catalog, options: PseudoOptions = {}): Catalog {
  const expansion = options.expansion ?? 0.3;
  if (!Number.isFinite(expansion) || expansion < 0 || expansion > 3)
    throw new RangeError("Expansion must be between zero and three.");
  const text = (value: string) => {
    if (!value.trim()) return value;
    const converted = [...value]
      .map((char) => {
        const accent = accents[char.toLowerCase()];
        return accent ? (char === char.toUpperCase() ? accent.toUpperCase() : accent) : char;
      })
      .join("");
    return options.rtl
      ? `\u2067${converted}${"ـ".repeat(Math.ceil(value.length * expansion))}\u2069`
      : `${converted}${"~".repeat(Math.ceil(value.length * expansion))}`;
  };
  function walk(nodes: MessageFormatElement[]): void {
    for (const node of nodes) {
      if (node.type === TYPE.literal) node.value = text(node.value);
      else if (node.type === TYPE.tag) walk(node.children);
      else if (node.type === TYPE.plural || node.type === TYPE.select)
        for (const option of Object.values(node.options)) walk(option.value);
    }
  }
  return Object.fromEntries(
    [...flattenCatalog(catalog)].map(([key, message]) => {
      const ast = messageAST(message);
      walk(ast);
      return [key, `[${printAST(ast)}]`];
    }),
  );
}
