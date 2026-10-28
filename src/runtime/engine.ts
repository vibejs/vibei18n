import { IntlMessageFormat } from "intl-messageformat";
import type { FormatXMLElementFn, Formats } from "intl-messageformat";
import type { Message, Values } from "../types/index.ts";
import { LRU, optionsKey } from "./cache.ts";
export interface RichToken {
  readonly type: "tag";
  readonly name: string;
  readonly children: readonly (string | RichToken)[];
}
function safeValues(values: Values = {}): Record<string, import("../types/index.ts").Value> {
  const result: Record<string, import("../types/index.ts").Value> = Object.create(null);
  for (const [name, value] of Object.entries(values)) {
    if (
      value !== null &&
      value !== undefined &&
      !["string", "number", "boolean", "bigint"].includes(typeof value) &&
      !(value instanceof Date)
    )
      throw new TypeError(`Invalid interpolation parameter type: ${name}`);
    result[name] = value;
  }
  return result;
}
export class IntlEngine {
  readonly messages: LRU<string, IntlMessageFormat>;
  readonly formatters: LRU<
    string,
    | Intl.NumberFormat
    | Intl.DateTimeFormat
    | Intl.RelativeTimeFormat
    | Intl.ListFormat
    | Intl.Collator
    | Intl.PluralRules
  >;
  constructor(
    readonly formats?: Partial<Formats>,
    capacity = 256,
    readonly timeZone?: string,
  ) {
    this.messages = new LRU(capacity);
    this.formatters = new LRU(capacity);
  }
  message(locale: string, message: Message, rich = false): IntlMessageFormat {
    const key = JSON.stringify([locale, message, rich]);
    return this.messages.get(
      key,
      () =>
        new IntlMessageFormat(
          typeof message === "string" ? message : structuredClone([...message]),
          locale,
          this.formats,
          {
            ignoreTag: !rich,
            formatters: {
              getNumberFormat: (tag, options) =>
                this.number(Array.isArray(tag) ? tag[0] : (tag ?? locale), options),
              getDateTimeFormat: (tag, options) =>
                this.date(Array.isArray(tag) ? tag[0] : (tag ?? locale), options),
              getPluralRules: (tag, options) =>
                this.plural(Array.isArray(tag) ? tag[0] : (tag ?? locale), options),
            },
          },
        ),
    );
  }
  format(locale: string, message: Message, values?: Values): string {
    const result = this.message(locale, message).format(safeValues(values));
    if (typeof result !== "string" && typeof result !== "number")
      throw new TypeError("Plain translations must produce text.");
    return String(result);
  }
  rich(
    locale: string,
    message: Message,
    values: Values,
    tags: readonly string[],
  ): readonly (string | RichToken)[] {
    const callbacks: Record<string, FormatXMLElementFn<RichToken>> = Object.create(null);
    for (const name of tags)
      callbacks[name] = (children) => ({
        type: "tag",
        name,
        children: children.map((v) => (typeof v === "string" ? v : v)),
      });
    const result = this.message(locale, message, true).format<RichToken>(
      Object.assign(safeValues(values), callbacks),
    );
    return Array.isArray(result) ? result : [result];
  }
  private formatter<T>(kind: string, locale: string, options: object, create: () => T): T {
    return this.formatters.get(
      `${kind}:${locale}:${optionsKey(options)}`,
      create as () => Intl.NumberFormat,
    ) as T;
  }
  number(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
    return this.formatter("number", locale, options, () => new Intl.NumberFormat(locale, options));
  }
  date(locale: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
    const effective = { ...(this.timeZone ? { timeZone: this.timeZone } : {}), ...options };
    return this.formatter(
      "date",
      locale,
      effective,
      () => new Intl.DateTimeFormat(locale, effective),
    );
  }
  relative(locale: string, options: Intl.RelativeTimeFormatOptions = {}): Intl.RelativeTimeFormat {
    return this.formatter(
      "relative",
      locale,
      options,
      () => new Intl.RelativeTimeFormat(locale, options),
    );
  }
  list(locale: string, options: Intl.ListFormatOptions = {}): Intl.ListFormat {
    return this.formatter("list", locale, options, () => new Intl.ListFormat(locale, options));
  }
  collator(locale: string, options: Intl.CollatorOptions = {}): Intl.Collator {
    return this.formatter("collator", locale, options, () => new Intl.Collator(locale, options));
  }
  plural(locale: string, options: Intl.PluralRulesOptions = {}): Intl.PluralRules {
    return this.formatter("plural", locale, options, () => new Intl.PluralRules(locale, options));
  }
  clear(): void {
    this.messages.clear();
    this.formatters.clear();
  }
}
