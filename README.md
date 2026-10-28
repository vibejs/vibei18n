# VibeI18n

**Every Language. One Framework.**

ICU-powered internationalization for Vibe.js: app-scoped reactive locales, typed keys, generated ICU parameter schemas, atomic lazy loading, native Intl formatting, direction, routing, persistence, and catalog tooling.

```sh
pnpm add @usevibejs/i18n @usevibejs/ui
```

```ts
import { createI18n } from "@usevibejs/i18n";
const i18n = createI18n({
  locale: "en",
  fallbackLocale: "en",
  messages: {
    en: { welcome: "Welcome, {name}!" },
    tr: { welcome: "Hoş geldin, {name}!" },
  },
});
await i18n.ready;
createApp(App).use(i18n).mount("#app");
```

```vibe
<script setup lang="ts">
import { useI18n } from '@usevibejs/i18n';
const { t, locale, setLocale } = useI18n();
</script>
<template>
  <h1>{{ t('welcome', { name: 'Alex' }) }}</h1>
  <button @click="setLocale('tr')">Türkçe</button>
</template>
```

Use the instance's `t` for inferred keys. Generate a schema for full ICU/JSON parameter checking and typed `useI18n` in templates. Simple literal placeholders infer automatically; complex ICU needs generated or explicit schemas. Translations are text; rich messages return inert structured tokens.

```sh
pnpm install
pnpm dev           # Multilingual dashboard, documentation and playgrounds
pnpm check         # Types, lint, format, catalogs, unit/browser/package checks
pnpm bench         # Measured lookup/ICU/formatter/switch benchmarks
```

Documentation: [Getting started](docs/getting-started.md), [catalogs and loaders](docs/core.md), [formatting](docs/formatting.md), [type safety](docs/type-safety.md), [routing, direction and persistence](docs/advanced.md), [tooling](docs/tooling.md), [security and performance](docs/security-performance.md), [ecosystem](docs/ecosystem.md), [API reference](docs/reference.md), [verified framework investigation](docs/research.md).

Exports: `@usevibejs/i18n`, `/core`, `/router`, `/tooling`, `/vite`. CLI: `vibei18n check|generate|compile|pseudo|extract`. The browser runtime does not load Node/tooling dependencies. The framework-independent core imports no Vibe.js. Vibe.js 0.1.0 and full native Intl are required for the adapter; `.vibe` type checking uses the public TypeScript 7.1 content mapper.

The ten-language showcase uses example translations, not certified or human-reviewed production translations. Authentication flows are local UI previews. See the documentation for extraction, rich-component rendering and watch-mode limits. Nothing in this repository publishes or deploys a release automatically.

MIT. FormatJS and other dependency licenses are retained in [third-party notices](THIRD-PARTY-NOTICES.md); copied Vibecn source retains its own notices.
