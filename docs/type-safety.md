# Type safety

`defineMessages` preserves literal strings. `createI18n({ messages: { en } })` infers nested dot keys up to eight object segments. The instance's `t` rejects unknown keys. Simple unescaped `{name}` placeholders are inferred up to twenty placeholders. No-parameter messages reject extra arguments. Widened JSON strings retain key safety but need generated types for parameter safety.

## Generated ICU schemas

Full ICU expressions, rich tags and apostrophe escaping cannot be reliably parsed in conditional types. They deliberately use a Values escape hatch until you supply an AST-generated schema. Do not interpret permissive complex-message parameters as proof of runtime validity.

```json
{
  "sourceLocale": "en",
  "resources": [{ "locale": "en", "file": "locales/en.json" }],
  "output": "src/messages.gen.d.ts"
}
```

```sh
vibei18n generate --config vibei18n.config.json
```

The output contains flat message indexes and augments `Register` from `@usevibejs/i18n`. Include it in the application's tsconfig. `useI18n()` then gets the generated schema automatically, including `.vibe` expressions through the normal Vibe.js content mapper. Each application compilation must use one consistent registered schema. For per-instance schemas, pass `schema: undefined as unknown as MyMessages` to createI18n, or use `useI18n<MyMessages>()` at a context boundary you control. This is an explicit type declaration, not runtime catalog validation.

The parser infers plural/ordinal/number arguments as number, select arguments as string, date/time as Date | number, and ordinary arguments as Value. Nested expressions are traversed. Incompatible uses reject generation. Select values stay string because ICU permits arbitrary strings to resolve to other. Generated rich-tag messages are rejected; use the explicit token API. Very large catalogs should use generated flat schemas and separate TypeScript modules; no unbounded recursive conditional type is used.

`dynamic(key, values)` is the deliberate string-key escape hatch. Runtime-loaded catalogs have no static shape unless you supply a schema. Runtime formatting detects missing parameters regardless of static types. Enable strict TypeScript and use matching UI/compiler/language-tools versions; do not add a wildcard `declare module '*.vibe'`.
