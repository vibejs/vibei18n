import { createI18n, defineMessages, type InferSchema, type Translate } from "../src/index.ts";
const en = defineMessages({
  common: { save: "Save" },
  profile: { greeting: "Hello {name}" },
  complex: "{n, plural, one {#} other {#}}",
});
const i18n = createI18n({ locale: "en", messages: { en } });
i18n.t("common.save");
i18n.t("profile.greeting", { name: "Alex" });
// @ts-expect-error Unknown key.
i18n.t("common.unknown");
// @ts-expect-error Missing required parameter.
i18n.t("profile.greeting");
// @ts-expect-error Wrong parameter.
i18n.t("profile.greeting", { wrong: "Alex" });
// @ts-expect-error Plain messages take no parameters.
i18n.t("common.save", { wrong: "Alex" });
const typed: Translate<{
  cart: { n: number };
  date: { at: Date | number };
  select: { gender: string };
}> = (() => "") as Translate<{
  cart: { n: number };
  date: { at: Date | number };
  select: { gender: string };
}>;
typed("cart", { n: 3 });
typed("date", { at: new Date() });
typed("select", { gender: "female" });
// @ts-expect-error Numeric ICU parameters reject strings.
typed("cart", { n: "three" });
const schema: InferSchema<typeof en> = {
  "common.save": {},
  "profile.greeting": { name: "A" },
  complex: { n: 2 },
};
void schema;
i18n.dynamic("runtime-key", { anything: 1 });

const punctuation = createI18n({
  locale: "en",
  messages: { en: { comma: "Hello, world", apostrophe: "It's saved", spaced: "Hi { name }" } },
});
punctuation.t("comma");
punctuation.t("apostrophe");
punctuation.t("spaced", { name: "A" });
