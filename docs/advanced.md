# Contexts, direction, persistence and routing

Every createI18n instance owns its locale, catalogs, loaders and caches. A plugin instance installs into one app; use a separate instance per independent app. `useI18n()` requires component setup or app.runWithContext. No mutable global translation singleton exists.

## Nested locale scopes

```ts
const child = createLocaleContext({
  locale: "ar",
  fallbackLocale: "en",
  messages: { ar: { hello: "مرحباً" }, en: { hello: "Hello" } },
});
```

Call in a component's setup. It returns that component's child context and provides it to descendants; ancestor injection remains unchanged. It owns its own catalog snapshots and loaders. The active effect scope disposes it. `provideI18n(existing)` provides a context without taking ownership; the caller must dispose it. Child changes never propagate to the parent.

## Direction and document ownership

`dir` resolves platform locale text metadata; when unavailable, Intl.Locale.maximize supplies a script and a documented RTL script set is used. An explicit `direction` option overrides resolution. `useDirection()` returns a computed value. Bind `:dir` and `:lang` to widget roots; use CSS logical properties. This does not infer typography or other cultural preferences.

```vibe
<DirectionProvider :dir="dir"><main :lang="locale">…</main></DirectionProvider>
```

Vibecn's existing DirectionProvider sets the DOM direction used by its components. No competing component context is needed. Global document mutation is disabled by default. `syncDocument(i18n, element?)` claims explicit ownership, synchronizes active locale and direction, and returns cleanup. A second owner of the same element throws. Cleanup restores original attributes only if still equal to values written by this owner. App installation does not automatically claim the host document. Register returned cleanup with app.onUnmount or call inside a scope.

## Negotiation and persistence

`negotiateLocale(preferences, supported, fallback?)` checks canonical exact and parent candidates in supplied order. Unsupported and malformed external preferences are ignored. Regional siblings are not substituted. Choose precedence by ordering preferences: route, configured locale, saved preference, navigator.languages, fallback, or a different application policy. Browser detection is never implicit.

`localStorageAdapter(key?, window?)` tolerates blocked storage and uses storage events for cross-tab updates. `persistLocale(i18n, storage, options?)` reads initial preference, writes successful changes and suppresses echo writes from external events. It is opt-in, returns an asynchronous cleanup handle, and should be awaited before mount. Options include initial:false after application-level negotiation, setLocale for routing, and onError. It owns no cookies or user-profile behavior; implement read/write/subscribe for those. A calling component scope owns cleanup when present; outside setup register it with app.onUnmount.

## Routing

```ts
import { connectI18nRouter } from "@usevibejs/i18n/router";
const localization = connectI18nRouter(router, i18n, { namespaces: ["default", "billing"] });
await localization.setLocale("tr");
app.onUnmount(localization.stop);
```

Use existing Vibe.js routes such as /:locale/dashboard. The first path segment is the locale. URL is the source of truth: use the connection's setLocale for routed switches. It preserves path suffix, query and hash. Guards preload namespaces without activating; successful afterEach commits. Aborted, failed and cancelled navigation does not activate. Unsupported prefixes abort by default; unsupported:'ignore' leaves locale alone. Errors from catalog loading abort navigation. Vibe.js owns navigation cancellation. `createI18nRouteGuard` is the standalone preparation guard for custom workflows; pair it with a successful commit hook. Stop removes both hooks. Router cleanup belongs to the caller.

Do not concurrently drive a connected instance with direct i18n.setLocale: the URL remains authoritative. In the showcase route > saved preference > English is chosen before mount. There is no second router or automatic remount.
