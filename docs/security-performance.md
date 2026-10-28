# Security and performance

Messages are untrusted text. No eval, Function constructor, HTML insertion or translator-controlled event handlers are used. Render t() output with ordinary Vibe template interpolation. A message resembling script markup remains text. Interpolation values are never logged by diagnostics. Formatting errors expose a safe message; their cause retains the original engine error for application debugging, so do not serialize causes into public telemetry without filtering.

## Rich content

```ts
const tokens = i18n.rich("terms", { product: "Atlas" }, ["strong", "link"]);
```

Tokens are strings or `{ type: 'tag', name, children }`. Only explicit allowed names have formatter callbacks. Unknown tags fail formatting. Tokens contain no URLs, executable callbacks, HTML attributes or framework render objects. Map allowed names to fixed application-owned elements and safe application-owned URLs with declarative .vibe composition. Do not assign translated strings to HTML. Arbitrary rich-component rendering is intentionally not provided because Vibe.js 0.1 has no supported public render-function API. Nested token structures are supported by the API; the consumer owns declarative rendering depth.

## Caching

Each instance has bounded LRU message and Intl formatter caches, default capacity 256. Message keys include locale, content/AST and rich/text mode. Intl keys include kind, locale and sorted option entries. Custom ICU formats and timezone belong to the engine instance. Do not mutate configuration after creation. Replacing a catalog changes the message content key; old compiled messages age out naturally. Namespace revision refs only invalidate translations that read that namespace/fallback chain. No deep watching, DOM traversal, process-wide catalog store or per-message timers are used.

`core.engine.messages` and `core.engine.formatters` expose size/hits/misses and clear(). Catalogs and completed loads remain per-instance until disposal; formatter caches are bounded, catalog count is application-controlled. Preload likely locales and split namespaces where useful. Supply pre-parsed ASTs to avoid runtime parsing for those resources. intl-messageformat's default entry still contains its parser; precompilation alone does not eliminate it from browser output.

The runtime entries contain no Node, Vite, extraction, Oxc, JSON validation or ecosystem integration code. Tooling and router are separate entry points. Packed-consumer checks verify imports and browser tree shaking. Run pnpm bench for actual measurements on the current host; values are observations, not cross-machine guarantees. Refer to the delivery report for measured bundle sizes and test results.
