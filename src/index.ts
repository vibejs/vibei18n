/** Application-wide translation schema, extended by generated catalog declarations. */
export interface Register {}
export * from "./adapter/index.ts";
export * from "./adapter/browser.ts";
export {
  canonicalLocale,
  localeParents,
  fallbackChain,
  negotiateLocale,
  directionOf,
} from "./core/locale.ts";
export { defineLocale, defineMessages } from "./types/index.ts";
export type { Direction, Fallback } from "./core/locale.ts";
export type { CoreOptions, Diagnostic, Loader, LocaleState } from "./core/index.ts";
export type {
  Catalog,
  Message,
  MessageSchema,
  InferSchema,
  Translate,
  Value,
  Values,
  RegisteredSchema,
  ParametersOf,
  Keys,
} from "./types/index.ts";
export type { RichToken } from "./runtime/engine.ts";
