# Catalogs, locales and namespaces

Catalogs are UTF-8 TypeScript objects or JSON resources. Leaves are ICU strings or FormatJS AST arrays. Nested objects flatten to dot keys; flat JSON dot keys are also accepted. A flattened collision is rejected. Namespaces use a separate colon: `billing:invoice.total`. An unprefixed key always uses the default namespace. Nesting does not implicitly create namespaces.

## Registration and independent loading

```ts
const i18n = createI18n({
  locale: "en",
  fallbackLocale: "en",
  messages: { en: { navigation: { home: "Home" } } },
  namespaces: { en: { billing: { total: "Total" } } },
  loaders: {
    tr: {
      default: () => import("./locales/tr.json"),
      billing: () => import("./locales/tr-billing.json"),
    },
  },
});
await i18n.preload("tr", ["billing"]);
i18n.register("en", { total: "Updated total" }, "billing", "merge");
i18n.dynamic("billing:total");
```

Register defaults to replacing a namespace. Merge keeps existing flattened keys and replaces collisions with the new value. Inputs are snapshotted. Loader module namespace objects and sole-default export wrappers are unwrapped; a raw loader catalog whose only root key is default must be supplied as an explicit module default or registered directly to avoid that reserved wrapper shape. No deep watch traverses catalog objects. App packages may register their own namespaces. Runtime namespace names are strings; generated schemas provide static namespaced keys.

## Fallback and missing translations

Locales are canonicalized with Intl.Locale. Regional/script parent candidates use Intl.Locale fields and baseName, preserving a script candidate before a language candidate. `en-GB → en`, `zh-Hant-TW → zh-Hant → zh`; extensions are removed through baseName. Set `languageFallback: false` to disable structural parents. Explicit fallback maps are consulted before implicit parent candidates; `default` contains the final fallback list. Cycles are deduplicated.

```ts
fallbackLocale: { 'zh-Hant-TW': ['zh-Hant', 'en'], default: ['en'] }
```

Fallback is deterministic for each namespace/key. No matching regional sibling is invented: pt-PT does not silently select pt-BR. A key formats with the locale of the resolved message. Separate number/date helpers format using the active locale. Missing defaults to displaying the key; `missing: 'throw'` or a function changes it. `onDiagnostic` receives key, namespace, requested and resolved locales and a safe message. Diagnostic duplicates are bounded and deduplicated. No interpolation values are logged. Warnings are opt-in through this callback; the runtime does not guess build mode or print to the console.

## Atomic transitions

`locale` is active, `requestedLocale` is intent, `isLoading` describes the latest switch, and `error` is the latest switch error. `ready` loads the initial locale. Await it before mounting to avoid an uninitialized view. The previous active locale stays visible during later loading. A monotonically increasing request token prevents older loads from activating. A stale successful catalog can still be cached for later use. Failure keeps the active locale, rejects the promise and exposes error; retry by calling setLocale again.

`preload(locale, namespaces, reload)` deduplicates in-flight requests, caches successful resources and retries failed ones. Reload refreshes a cached resource; concurrent reloads share the current request. Loaders receive locale, namespace and a disposal AbortSignal. Disposing a context aborts willing loaders and prevents late commits even if a loader ignores cancellation. Resources remain cached per instance until disposal; applications with unbounded dynamic locale sets should create scoped instances. Message and Intl caches are LRU-bounded.
