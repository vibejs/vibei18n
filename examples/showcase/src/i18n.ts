import { createI18n } from "../../../src/index.ts";
import en from "./locales/en.json";
export const languages = [
  { value: "en", label: "English", code: "EN" },
  { value: "fr", label: "Français", code: "FR" },
  { value: "de", label: "Deutsch", code: "DE" },
  { value: "it", label: "Italiano", code: "IT" },
  { value: "pt-BR", label: "Português (Brasil)", code: "PT" },
  { value: "ru", label: "Русский", code: "RU" },
  { value: "es", label: "Español", code: "ES" },
  { value: "tr", label: "Türkçe", code: "TR" },
  { value: "ko", label: "한국어", code: "KO" },
  { value: "ja", label: "日本語", code: "JA" },
];
export const i18n = createI18n({
  locale: "en",
  fallbackLocale: "en",
  timeZone: "UTC",
  messages: { en },
  namespaces: { en: { help: { fallback: "This message comes from the English fallback." } } },
  loaders: {
    fr: () => import("./locales/fr.json"),
    de: () => import("./locales/de.json"),
    it: () => import("./locales/it.json"),
    "pt-BR": () => import("./locales/pt-BR.json"),
    ru: () => import("./locales/ru.json"),
    es: () => import("./locales/es.json"),
    tr: () => import("./locales/tr.json"),
    ko: () => import("./locales/ko.json"),
    ja: () => import("./locales/ja.json"),
  },
});
