import { createApp } from "@usevibejs/ui";
import {
  createI18n,
  localStorageAdapter,
  persistLocale,
  syncDocument,
  negotiateLocale,
} from "../../../src/index.ts";
import { localeFromPath } from "../../../src/router/index.ts";
import App from "./App.vibe";
import OtherApp from "./OtherApp.vibe";
import { i18n } from "./i18n.ts";
import { router, routing } from "./routing.ts";
import "./styles.css";
await i18n.ready;
const storage = localStorageAdapter();
// This application chooses route > saved preference > English. Browser preferences are opt-in.
const initial =
  localeFromPath(location.pathname, i18n.availableLocales.value) ??
  negotiateLocale([await storage.read()], i18n.availableLocales.value, "en") ??
  "en";
await i18n.setLocale(initial);
if (!localeFromPath(location.pathname, i18n.availableLocales.value))
  await router.replace(`/${initial}/dashboard${location.search}${location.hash}`);
const app = createApp(App).use(i18n).use(router);
await router.isReady();
app.onUnmount(syncDocument(i18n));
app.onUnmount(await persistLocale(i18n, storage, { initial: false, setLocale: routing.setLocale }));
app.onUnmount(routing.stop);
app.mount("#app");
const other = createI18n({
  locale: "tr",
  messages: { tr: { hello: "Bağımsız uygulama" }, en: { hello: "Independent application" } },
});
await other.ready;
const widget = createApp(OtherApp, {
  onDispose: (): void => {
    widget.unmount();
  },
}).use(other);
widget.mount("#secondary");
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    widget.unmount();
    app.unmount();
  });
