# Framework and engine investigation

VibeI18n targets the public Vibe.js 0.1.0 client runtime. Investigation covered Vibe.js AGENTS.md, CONTRACTS.md, ADRs 0001 and 0004, public UI exports, app/injection/watch/scheduler implementations, ref/computed/dependency/effect-scope implementations, component setup and disposal, router/history/types/guards, compiler SFC/template/script/Vite exports, language-tool generation and content-mapper contracts, contract exports, examples, and existing test configurations. Sibling packages were inspected without changing their runtimes.

## Verified framework behavior

1. Reactive getters link dependencies to the active subscriber; writes propagate dirty flags. No virtual DOM is involved.
2. Refs expose `.value`; computed values recompute lazily and only propagate changed values. Computed dependencies detach when their final subscriber leaves.
3. `app.use` invokes a function or object's `install(app)` once per plugin identity.
4. `app.provide` stores values in that app's context. `app.runWithContext` supplies an explicit injection context and takes precedence over a component context.
5. Component `provide` creates a prototype-linked provider object. Descendants inject from the nearest ancestor; a component does not inject its own newly provided value.
6. Each component and rendered block owns scopes. `onScopeDispose` registers cleanup; `app.onUnmount` owns plugin cleanup.
7. `nextTick` waits for pending DOM jobs and post-flush callbacks. Locale promises commit reactive state; await `nextTick` when inspecting the resulting DOM.
8. Script setup bindings are returned by setup; the compiler maps template references to setup/props/import expressions. Ref unwrapping occurs at the setup proxy boundary. Calls to `t()` execute within binding effects.
9. The public language-tools content mapper generates TypeScript from `.vibe` and maps diagnostics to original spans. Apps use TypeScript 7.1 and `tsc -b --runExternalCode`. The library’s declarations are emitted by TypeScript without declaration bundling, preserving the public schema augmentation module identity; JavaScript bundles are built by tsdown. Generated schemas flow through normal TypeScript checking. There is no public third-party language-server plugin hook; no compiler patch is needed.
10. Router guards return false to abort or a location to redirect. Guard phases await promises; a newer navigation cancels older navigation. `afterEach` receives a failure argument. Catalog preparation belongs in `beforeResolve`; activation belongs only in successful `afterEach`.
11. The public `vibe()` Vite plugin checks matching UI/compiler versions, parses `.vibe`, transforms TypeScript, and owns HMR. The i18n Vite plugin uses ordinary build/watch hooks only.
12. The compiler publicly exports `parse`, SFC/template AST types, `analyzeScript`, and `compile`. Extraction uses the SFC/template AST plus Oxc for expression analysis. No private runtime entry point is imported by this library.

## Engine decision

Verified npm registry versions: intl-messageformat **12.1.4**, @formatjs/icu-messageformat-parser **3.5.22**, Vibe.js UI/compiler/language-tools **0.1.0**. The engine pins its parser to the same version used by tooling. Native Intl supplies NumberFormat, DateTimeFormat, RelativeTimeFormat, ListFormat, Collator, and PluralRules. Full ICU locale data is required from the host; no locale-data polyfill is bundled.

intl-messageformat supports string and pre-parsed AST messages, named arguments, exact plurals, offsets, cardinal and ordinal rules, selects, nesting, escaping, skeletons, custom formats, and rich callback formatting. It evaluates ASTs without dynamic JavaScript compilation. Rich formatting is exposed as inert tokens, since Vibe.js v0.1 does not expose a supported general render-function API. Text is rendered with ordinary `.vibe` interpolation.

The trade-off is a meaningful FormatJS parser cost in the default runtime. Precompiled ASTs avoid repeated parsing but do not remove that parser from intl-messageformat's default entry. Benchmarks and packed consumer bundle measurements are recorded separately; no claim of a parser-free runtime is made.

Sources: [FormatJS engine API](https://formatjs.github.io/docs/intl-messageformat/), [FormatJS ICU syntax](https://formatjs.github.io/docs/core-concepts/icu-syntax/), [Unicode locale identifiers](https://unicode.org/reports/tr35/), [ECMA-402](https://tc39.es/ecma402/). Registry versions were checked with `pnpm view`, then verified against installed manifests and the lockfile.

## Vibecn and optional ecosystem packages

Vibecn 0.3.0 ships trusted bundled source through `planInit`, `planAdd`, and its CLI; its CLI cannot fetch arbitrary remote registry items. Components use theme tokens, native form controls, browser dialogs/popovers, and collection helpers for focus and keyboard behavior. `DirectionProvider` has `dir?: 'ltr' | 'rtl'` and a default slot, setting the nearest `dir` attribute. The showcase installs existing primitives with the actual CLI. The language switcher is a composition of Combobox parts, with translated labels and native-language names.

VibeForm 0.1.1 exposes stable `useForm`/`useField`; validators return stable public error codes and the UI translates them on each render. VibeTable 0.1.1 exposes `useTable` and TanStack v9 features; column/table identities stay stable while label callbacks and formatting read locale state. Locale collation is explicit; changing language does not automatically re-sort data. VibeAuth exposes `createVibeAuthClient` and `createAuthPlugin`; public errors can be mapped to catalog keys. VibeQuery exposes QueryClient and query APIs, suitable for a loader's fetchQuery. VibeUse exposes explicit storage adapters with lifecycle-owned cleanup. These packages are optional and are absent from VibeI18n's runtime imports.
