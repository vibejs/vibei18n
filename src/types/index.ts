import type { Register } from "../index.ts";
import type { MessageFormatElement } from "@formatjs/icu-messageformat-parser";

export type Message = string | readonly MessageFormatElement[];
export interface Catalog {
  readonly [key: string]: Message | Catalog;
}
export type Value = string | number | bigint | boolean | Date | null | undefined;
export type Values = Readonly<Record<string, Value>>;
export type MessageSchema = Readonly<Record<string, Values>>;

export type RegisteredSchema = Register extends { messages: infer S extends MessageSchema }
  ? S
  : MessageSchema;
// Bound object traversal to eight segments; generate a flat schema for deeper catalogs.
export type Keys<C, D extends unknown[] = []> = D["length"] extends 8
  ? never
  : C extends Catalog
    ? string extends keyof C
      ? string
      : {
          [K in keyof C & string]: C[K] extends Message ? K : `${K}.${Keys<C[K], [...D, 0]>}`;
        }[keyof C & string]
    : never;
type At<C, K extends string> = C extends unknown
  ? K extends keyof C
    ? C[K]
    : K extends `${infer H}.${infer T}`
      ? H extends keyof C
        ? At<C[H], T>
        : never
      : never
  : never;
type Space = " " | "\n" | "\t" | "\r";
type Trim<S extends string, D extends unknown[] = []> = D["length"] extends 32
  ? string
  : S extends `${Space}${infer T}`
    ? Trim<T, [...D, 0]>
    : S extends `${infer T}${Space}`
      ? Trim<T, [...D, 0]>
      : S;
type SimpleNames<S extends string, D extends unknown[] = []> = D["length"] extends 20
  ? string
  : S extends `${string}{${infer N}}${infer Rest}`
    ? N extends `${string},${string}` | `${string}{${string}`
      ? string
      : Trim<N> | SimpleNames<Rest, [...D, 0]>
    : S extends `${string}{${string}`
      ? string
      : never;
/** Complex ICU and apostrophe escaping need generated schemas; never pretend to parse ICU in types. */
export type ParametersOf<S> = S extends string
  ? string extends S
    ? Values
    : S extends `${string}{${string}`
      ? S extends `${string}'${string}`
        ? Values
        : { [K in SimpleNames<S>]: Value }
      : {}
  : Values;
export type InferSchema<C> = { readonly [K in Keys<C>]: ParametersOf<At<C, K>> };
export type Translate<S extends MessageSchema> = <K extends keyof S & string>(
  key: K,
  ...args: string extends keyof S
    ? [values?: Values]
    : keyof S[K] extends never
      ? [values?: never]
      : string extends keyof S[K]
        ? [values: S[K]]
        : [values: S[K]]
) => string;
export function defineMessages<const C extends Catalog>(messages: C): C {
  return messages;
}
export function defineLocale<const L extends string>(locale: L): L {
  Intl.getCanonicalLocales(locale);
  return locale;
}
