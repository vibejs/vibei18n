# API reference and troubleshooting

## Main entry

createI18n(options) returns core, t, dynamic, rich, locale, requestedLocale, availableLocales, fallbackLocale, isLoading, error, dir, ready, setLocale, preload, register, n, d, dateRange, rt, list, compare, install, use, dispose.

useI18n<Schema>() injects the nearest context; instance.use() retains its inferred schema without injection. defineMessages preserves literal catalogs. defineLocale validates a locale string. createLocaleContext provides and scope-owns a new instance. provideI18n provides an existing instance. i18nKey is a stable typed symbol.

useLocale and useDirection return computed state. useNumberFormat, useDateFormat, useRelativeTimeFormat, useListFormat and usePluralRules accept native Intl options and return computed Intl instances. They create no timers.

canonicalLocale, localeParents, fallbackChain, negotiateLocale and directionOf are pure locale utilities. syncDocument, persistLocale and localStorageAdapter are opt-in browser integrations returning cleanup or adapters. Browser utilities guard unavailable storage; use syncDocument only with an explicit element in non-browser environments.

Public types include Catalog, Message, Values, Value, MessageSchema, InferSchema, Translate, ParametersOf, Keys, Register, RegisteredSchema, CoreOptions, Loader, Diagnostic, LocaleState, Direction, Fallback, I18n, I18nOptions, LocaleStorage and RichToken. Types contain no public any declarations.

## Other entries

/core exports createCore, I18nCore, IntlEngine, locale utilities and catalog/type definitions. It imports no Vibe.js. Core translation calls are string-based and framework-independent.

/router exports localeFromPath, localizePath, createI18nRouteGuard and connectI18nRouter. The optional adapter uses only public router hooks.

/tooling exports analyzeMessage, messageAST, validateCatalog, readCatalogJSON, generateTypes, compileCatalog, pseudoCatalog, async extractMessages and diagnostic/reference types.

/vite exports vibeI18n. The package binary is vibei18n.

## Configuration

locale is required. fallbackLocale defaults to false. languageFallback defaults to true. messages supplies default catalogs, namespaces supplies explicit namespace catalogs, and loaders supplies per-locale functions or namespace/function maps. direction overrides automatic direction. timeZone configures ICU and date helpers. formats defines named ICU number/date/time presets. cacheSize defaults to 256 per LRU. missing defaults to key; onDiagnostic is opt-in. schema is a type-only declaration.

## Errors and troubleshooting

Missing context: install the plugin and call useI18n during setup or app.runWithContext. A context instance cannot install into two apps.

Text does not update: call t() inside the template or a computed getter, rather than storing a string snapshot in setup. Do not destructure .value into a plain string. Await nextTick for DOM assertions.

Unsupported locale: register its catalog/loader or a structural parent; fallbackLocale alone does not declare a supported requested language. BCP47 uses hyphens, not underscores.

Load failure: inspect error and retry setLocale. Loading state represents the latest switch; preload is independent background work and does not set isLoading.

ICU format failure: confirm required values, number/date types, other branches and escaping. Use check in CI for source-located catalog diagnostics. Runtime diagnostics know resource key/locale/namespace but cannot invent the calling source location.

Template type checking: use TypeScript 7.1 and @usevibejs/language-tools contentMappers; include generated types. Compiler and runtime must match exactly.

This is the initial VibeI18n release. No compatibility migration from an earlier VibeI18n API is required. To migrate a dictionary, flatten nested keys consistently, convert custom plural logic to ICU, move global locale state into app instances, and validate every translated catalog before shipping.
