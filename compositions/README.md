# Language switcher composition

Install Vibecn's `combobox` using its existing CLI, then copy LanguageSwitcher.vibe into the generated UI directory next to Combobox.vibe. Keep the Vibecn license shipped by its installer. This composition is original MIT code; it does not replace a UI primitive.

Pass locales with native-language labels, translated label/emptyLabel/loadingLabel/retryLabel props, and optionally change(locale). The default action is the injected i18n.setLocale. Routed apps should pass an action using the router connection and reject on aborted navigation. It supports keyboard search/selection through Vibecn, an active indicator, loading, retries, concurrent requests, and scope-owned watchers. Locale persistence is configured on the i18n instance separately.

The published Vibecn 0.3.0 registry does not contain this item; a published `add language-switcher` command is not advertised. No Vibecn dependency is required by the VibeI18n runtime.
