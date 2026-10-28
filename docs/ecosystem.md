# Ecosystem integrations

VibeI18n has only a Vibe.js peer for ordinary runtime use. Vibecn, Form, Table, Auth, Query and Use remain optional. The showcase uses published UI/compiler 0.1.0, Vibecn 0.3.0 source, Form 0.1.1 and Table 0.1.1.

## Vibecn

Install existing primitives through Vibecn's CLI, then copy `compositions/LanguageSwitcher.vibe` into the same UI directory. It accepts explicit locale items, translated labels and a locale-change callback. Combobox supplies search, active-descendant keyboard navigation and selection semantics. DirectionProvider receives i18n.dir. Avoid forcing a second direction context. The published Vibecn 0.3.0 bundled registry does not yet include language-switcher; no working published `add language-switcher` command is promised by this release.

Existing Button/Input/Field labels come from t(). Calendar accepts locale and a label, and keeps date-only values as YYYY-MM-DD. Dialog content slots accept translated text; disable its fixed English close control and supply a translated DialogClose. Combobox's optional default trigger/clear labels are English; the composition disables those controls and uses a translated input label. No mandatory VibeI18n dependency is added to existing primitives.

## VibeForm

Construct useForm and useField once in setup. Store stable validation codes (e.g. required) and translate when rendering; previously visible errors then update too. Do not capture translated strings in long-lived validation state. Changing display language does not alter the semantic submitted value. The showcase preserves dirty name/email fields while switching languages and renders native accessible error associations.

## VibeTable

Construct useTable once and keep columns stable. Header callbacks read t(); cells call n()/d(). Keep selection/pagination in VibeTable. Supply i18n.compare to an explicit sortFn for locale-aware ordering. The showcase does not automatically trigger sorting on language change, since reordering data is an application decision. Search uses toLocaleLowerCase for the active locale. Table state and row identity remain stable across locale changes.

## VibeAuth

Create the existing VibeAuth client/plugin normally. The type-checked examples/integrations/auth.ts helper accepts VibeAuth’s public error ref and localizes only explicitly allowlisted codes. Map safe public error codes to message keys; do not translate raw backend error text, tokens, OAuth parameters, passwords or identifiers. The showcase includes login/registration/reset/verification/session/organization label flows as a local preview; it sends no credentials and is not a functioning authentication service. An optional production VibeAuth backend/session lifecycle is application-owned and is not bundled here.

## VibeQuery

The tested examples/integrations/query.ts adapter uses the actual VibeQuery QueryClient. A loader can return `queryClient.fetchQuery({ queryKey: ['catalog', locale, namespace, version], queryFn })`. Return parsed validated JSON, not executable remote source. The query cache owns network caching; VibeI18n owns only active catalog snapshots and request deduplication. Invalidate/refetch through QueryClient and call preload(locale, namespaces, true) to replace a catalog. Core loading does not require a query cache.

## VibeUse

The tested examples/integrations/storage.ts composition uses VibeUse 0.1.1. If the application already uses useStorage, supply its state through the LocaleStorage read/write/subscribe adapter contract rather than adding another persistence writer. useStorage returns data and resource lifecycle methods; its caller owns cleanup. The built-in localStorageAdapter is sufficient without VibeUse. No cross-package cycle is introduced.
