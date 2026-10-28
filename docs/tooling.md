# Tooling and CI

The CLI accepts strict JSON configuration and JSON catalogs. TypeScript catalogs work at runtime; export JSON for the CLI to avoid executing resource code. Each resource declares locale, optional namespace and file. The canonical sourceLocale defines expected keys/parameters per namespace. All declared locales need all declared namespaces unless allowMissingNamespaces:true explicitly permits namespace fallback. The CLI never edits application source or deletes unused translations.

```sh
vibei18n check --config vibei18n.config.json
vibei18n check --json
vibei18n generate
vibei18n compile
vibei18n pseudo --rtl
vibei18n extract
```

Exit 0 means success, 1 validation failure, 2 usage/configuration/I/O failure. `--json` returns structured diagnostics for check and structured errors. Other successful commands print artifact summaries. Check detects invalid JSON, duplicate JSON properties, malformed catalogs, missing/extra keys, invalid ICU, required other branches, incompatible parameter uses, parameter mismatches, invalid locale syntax, and duplicate locale/namespace resources. Diagnostics include file and key, plus offsets when available. Catalog arrays must be genuine FormatJS AST resources. Well-formed locale syntax and host Intl locale support are checked; no embedded IANA registry is maintained. Tooling bounds AST analysis to 64 nested levels.

Generate writes a .d.ts to config.output. Compile writes flat-key pre-parsed AST JSON into config.output as a directory. Plain-text compilation preserves markup-looking text as literal content; use compile --rich or compileCatalog(catalog, { rich: true }) for namespaces consumed through rich(). Pseudo also uses an output directory and emits en-XA.default.json or en-XB.default.json from source catalogs. Change output appropriately for each command. Existing artifact files are overwritten; source catalogs are never targets unless explicitly misconfigured.

## Extraction

Config.sources is an explicit file list; no files are silently deleted. Extraction parses TypeScript with Oxc and .vibe scripts/templates with the framework's public parser. Literal t('key'), dynamic('key') and .t('key') references include line/column/file. Nonliteral keys produce explicit dynamic references. Optional callee names and namespace are configurable in the programmatic API; adjacent i18n comments can carry descriptions. Alias/import dataflow, arbitrary wrapper functions, v-for source/slot declaration analysis and message descriptor rewriting are not implemented. A parse error fails extraction instead of silently losing references. No automatic removal of translations is performed.

The extraction feature needs the optional @usevibejs/compiler and oxc-parser peers. The compiler version must match the app's UI. `extractMessages` from the tooling entry loads these lazily. Ordinary catalog commands do not import the framework compiler.

## Vite and watch behavior

```ts
import { vibeI18n } from "@usevibejs/i18n/vite";
export default defineConfig({ plugins: [vibe(), vibeI18n({ config: "vibei18n.config.json" })] });
```

The plugin validates before builds and on hot updates, and adds configuration/resources to Vite's watch set. Vite handles imported JSON module HMR; the plugin does not patch the compiler, rewrite source, or automatically register HMR catalog replacements. Re-register changed catalog data in a consumer HMR handler if preserving the instance. CLI watch mode is not implemented; use Vite validation or rerun CLI commands from your watcher.

## Pseudolocalization

Only parsed literal nodes are transformed, then serialized with the official FormatJS AST printer. Variable names, selectors, offsets and argument types remain intact. Accent substitution, configurable expansion (0–3), visible brackets and optional RTL isolates support layout stress testing. en-XA/en-XB are testing conventions, not normal translation quality. Set direction: rtl explicitly for an en-XB context, because the base language en has LTR metadata. The showcase provides a 320px stress frame and independently owned Arabic/Hebrew preview. Overflow inspection is visual; no automated geometric overflow detector is claimed.
