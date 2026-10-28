# Getting started

VibeI18n brings ICU-powered, reactive internationalization to Vibe.js. Every Language. One Framework.

Install `@usevibejs/i18n` alongside `@usevibejs/ui`. Use matching UI and compiler versions. Node 24.15+ or 26+ is supported; browsers need native Intl and full locale data. This release targets client-rendered Vibe.js 0.1.0.

## Create an instance

```ts
import { createI18n, defineMessages } from "@usevibejs/i18n";
const en = defineMessages({ welcome: "Welcome, {name}!", save: "Save" });
export const i18n = createI18n({
  locale: "en",
  fallbackLocale: "en",
  messages: { en, tr: { welcome: "Hoş geldin, {name}!", save: "Kaydet" } },
});
await i18n.ready;
createApp(App).use(i18n).mount("#app");
```

## First translation

```vibe
<script setup lang="ts">
import { useI18n } from '@usevibejs/i18n';
const { t, locale, setLocale } = useI18n();
</script>
<template>
  <h1>{{ t('welcome', { name: 'Alex' }) }}</h1>
  <button @click="setLocale('tr')">Türkçe</button>
  <p>{{ locale }}</p>
</template>
```

Calls in templates or computed getters react to the locale. A string assigned once during setup is a snapshot; use `computed(() => t(...))` for derived setup values. Await `setLocale`, then Vibe's `nextTick`, when you need to inspect updated DOM.

The repository includes a real compiled showcase and browser tests. Run `pnpm install`, `pnpm dev`, or `pnpm check`. No global registration, compiler patch, or forced component remount is required.
