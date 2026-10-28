import type { Catalog, Message, Values } from "../types/index.ts";
import { LRU } from "../runtime/cache.ts";
import { IntlEngine } from "../runtime/engine.ts";
import type { RichToken } from "../runtime/engine.ts";
import type { Formats } from "intl-messageformat";
import { flattenCatalog, splitKey, validateNamespace } from "./catalog.ts";
import { canonicalLocale, directionOf, fallbackChain } from "./locale.ts";
import type { Direction, Fallback } from "./locale.ts";
export * from "./locale.ts";
export { IntlEngine } from "../runtime/engine.ts";
export type { RichToken } from "../runtime/engine.ts";
export { defineMessages, defineLocale } from "../types/index.ts";
export type {
  Catalog,
  Message,
  MessageSchema,
  Values,
  Value,
  InferSchema,
  Translate,
} from "../types/index.ts";
export type Loader = (context: {
  locale: string;
  namespace: string;
  signal: AbortSignal;
}) => Promise<Catalog | { default: Catalog }>;
export interface Diagnostic {
  code: "missing" | "fallback" | "format" | "load";
  key?: string;
  locale: string;
  namespace?: string;
  resolvedLocale?: string;
  message: string;
}
export interface CoreOptions {
  locale: string;
  fallbackLocale?: Fallback;
  languageFallback?: boolean;
  messages?: Readonly<Record<string, Catalog>>;
  namespaces?: Readonly<Record<string, Readonly<Record<string, Catalog>>>>;
  loaders?: Readonly<Record<string, Loader | Readonly<Record<string, Loader>>>>;
  direction?: Direction;
  timeZone?: string;
  formats?: Partial<Formats>;
  cacheSize?: number;
  missing?: "key" | "throw" | ((diagnostic: Diagnostic) => string);
  onDiagnostic?: (diagnostic: Diagnostic) => void;
}
export interface LocaleState {
  readonly locale: string;
  readonly requestedLocale: string;
  readonly isLoading: boolean;
  readonly error: unknown;
}
export type CoreEvent =
  | { type: "state"; state: LocaleState }
  | { type: "catalog"; locale: string; namespace: string };
export class I18nCore {
  readonly engine: IntlEngine;
  private readonly catalogs = new Map<string, Map<string, ReadonlyMap<string, Message>>>();
  private readonly loaders = new Map<string, Map<string, Loader>>();
  private readonly chains = new LRU<string, readonly string[]>(64);
  private readonly versions = new Map<string, number>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly listeners = new Set<(event: CoreEvent) => void>();
  private readonly warned = new Set<string>();
  private readonly abort = new AbortController();
  private sequence = 0;
  private disposed = false;
  private current: LocaleState;
  readonly fallbackLocale: Fallback;
  constructor(readonly options: CoreOptions) {
    const locale = canonicalLocale(options.locale);
    this.fallbackLocale = options.fallbackLocale ?? false;
    fallbackChain(locale, this.fallbackLocale, options.languageFallback !== false);
    this.engine = new IntlEngine(options.formats, options.cacheSize, options.timeZone);
    this.current = Object.freeze({
      locale,
      requestedLocale: locale,
      isLoading: false,
      error: undefined,
    });
    for (const [tag, catalog] of Object.entries(options.messages ?? {}))
      this.register(tag, catalog);
    for (const [tag, namespaces] of Object.entries(options.namespaces ?? {}))
      for (const [name, catalog] of Object.entries(namespaces)) this.register(tag, catalog, name);
    for (const [tag, loader] of Object.entries(options.loaders ?? {})) {
      const canonical = canonicalLocale(tag);
      if (this.loaders.has(canonical))
        throw new TypeError(`Duplicate canonical loader locale: ${canonical}`);
      this.loaders.set(
        canonical,
        new Map(typeof loader === "function" ? [["default", loader]] : Object.entries(loader)),
      );
    }
  }
  fallbackLocales(locale: string): readonly string[] {
    return this.chains.get(locale, () =>
      fallbackChain(locale, this.fallbackLocale, this.options.languageFallback !== false),
    );
  }
  get state(): LocaleState {
    return this.current;
  }
  get availableLocales(): readonly string[] {
    return [...new Set([...this.catalogs.keys(), ...this.loaders.keys()])];
  }
  get dir(): Direction {
    return this.options.direction ?? directionOf(this.current.locale);
  }
  subscribe(listener: (event: CoreEvent) => void): () => void {
    this.assertAlive();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(event: CoreEvent): void {
    for (const listener of this.listeners) listener(event);
  }
  private update(state: LocaleState): void {
    this.current = Object.freeze(state);
    this.emit({ type: "state", state: this.current });
  }
  private assertAlive(): void {
    if (this.disposed) throw new Error("VibeI18n context has been disposed.");
  }
  private diagnostic(diagnostic: Diagnostic): void {
    const id = JSON.stringify(diagnostic);
    if (this.warned.has(id)) return;
    if (this.warned.size >= 256) this.warned.delete(this.warned.values().next().value!);
    this.warned.add(id);
    this.options.onDiagnostic?.(diagnostic);
  }
  register(
    locale: string,
    catalog: Catalog,
    namespace = "default",
    mode: "replace" | "merge" = "replace",
  ): void {
    this.assertAlive();
    validateNamespace(namespace);
    const canonical = canonicalLocale(locale);
    const next = flattenCatalog(catalog);
    const namespaces =
      this.catalogs.get(canonical) ?? new Map<string, ReadonlyMap<string, Message>>();
    namespaces.set(
      namespace,
      mode === "merge" ? new Map([...(namespaces.get(namespace) ?? []), ...next]) : next,
    );
    this.catalogs.set(canonical, namespaces);
    const resource = JSON.stringify([canonical, namespace]);
    this.versions.set(resource, (this.versions.get(resource) ?? 0) + 1);
    this.emit({ type: "catalog", locale: canonical, namespace });
  }
  hasCatalog(locale: string, namespace = "default"): boolean {
    return this.catalogs.get(canonicalLocale(locale))?.has(namespace) ?? false;
  }
  async preload(
    locale: string,
    namespaces: readonly string[] = ["default"],
    reload = false,
  ): Promise<void> {
    this.assertAlive();
    const canonical = canonicalLocale(locale);
    await Promise.all(
      namespaces.map(async (namespace) => {
        const id = JSON.stringify([canonical, namespace]);
        if (this.pending.has(id)) return this.pending.get(id);
        if (!reload && this.hasCatalog(canonical, namespace)) return;
        const loader = this.loaders.get(canonical)?.get(namespace);
        if (!loader) {
          if (this.hasCatalog(canonical, namespace)) return;
          throw new Error(`No catalog or loader for ${canonical}:${namespace}`);
        }
        const version = this.versions.get(id) ?? 0;
        const promise = Promise.resolve()
          .then(() => loader({ locale: canonical, namespace, signal: this.abort.signal }))
          .then((resource) => {
            if (this.disposed || (this.versions.get(id) ?? 0) !== version) return;
            const module =
              Object.hasOwn(resource, "default") &&
              typeof resource.default === "object" &&
              !Array.isArray(resource.default) &&
              (Object.prototype.toString.call(resource) === "[object Module]" ||
                Object.keys(resource).length === 1);
            const catalog = module ? resource.default : resource;
            if (!catalog || typeof catalog !== "object" || Array.isArray(catalog))
              throw new TypeError("Loaded catalog must be an object.");
            this.register(canonical, Object.fromEntries(flattenCatalog(catalog)), namespace);
          })
          .finally(() => {
            this.pending.delete(id);
          });
        this.pending.set(id, promise);
        return promise;
      }),
    );
  }
  async prepareLocale(locale: string, namespaces: readonly string[] = ["default"]): Promise<void> {
    this.assertAlive();
    const chain = this.fallbackLocales(locale);
    if (
      !fallbackChain(locale, false, this.options.languageFallback !== false).some((tag) =>
        this.availableLocales.includes(tag),
      )
    )
      throw new RangeError(`Unsupported locale: ${locale}`);
    await Promise.all(
      chain.flatMap((tag) =>
        namespaces.flatMap((namespace) =>
          this.loaders.get(tag)?.has(namespace) ? [this.preload(tag, [namespace])] : [],
        ),
      ),
    );
    for (const namespace of namespaces)
      if (!chain.some((tag) => this.hasCatalog(tag, namespace)))
        throw new Error(`No catalog for namespace ${namespace} in ${locale}`);
  }
  /** Commit only a fully prepared locale. Router adapters use this after successful navigation. */
  activateLocale(locale: string): void {
    this.assertAlive();
    ++this.sequence;
    const canonical = canonicalLocale(locale);
    this.update({
      locale: canonical,
      requestedLocale: canonical,
      isLoading: false,
      error: undefined,
    });
  }
  async setLocale(locale: string, namespaces: readonly string[] = ["default"]): Promise<boolean> {
    this.assertAlive();
    const canonical = canonicalLocale(locale);
    const id = ++this.sequence;
    this.update({ ...this.current, requestedLocale: canonical, isLoading: true, error: undefined });
    try {
      await this.prepareLocale(canonical, namespaces);
      if (this.disposed || id !== this.sequence) return false;
      this.update({
        locale: canonical,
        requestedLocale: canonical,
        isLoading: false,
        error: undefined,
      });
      return true;
    } catch (error) {
      if (this.disposed || id !== this.sequence) return false;
      this.update({ ...this.current, isLoading: false, error });
      throw error;
    }
  }
  private resolve(
    key: string,
    locale: string,
    namespace?: string,
  ): { message: Message; locale: string } | undefined {
    const [name, path] = splitKey(key, namespace);
    for (const candidate of this.fallbackLocales(locale)) {
      const message = this.catalogs.get(candidate)?.get(name)?.get(path);
      if (message === undefined) continue;
      if (candidate !== locale)
        this.diagnostic({
          code: "fallback",
          key: path,
          locale,
          namespace: name,
          resolvedLocale: candidate,
          message: `Using ${candidate} for ${name}:${path}`,
        });
      return { message, locale: candidate };
    }
    return undefined;
  }
  private missing(key: string, locale: string, namespace?: string): string {
    const [name, path] = splitKey(key, namespace);
    const diagnostic: Diagnostic = {
      code: "missing",
      key: path,
      locale,
      namespace: name,
      message: `Missing translation ${name}:${path} for ${locale}`,
    };
    this.diagnostic(diagnostic);
    if (this.options.missing === "throw") throw new Error(diagnostic.message);
    return typeof this.options.missing === "function" ? this.options.missing(diagnostic) : key;
  }
  t(key: string, values?: Values, locale = this.current.locale, namespace?: string): string {
    const resolved = this.resolve(key, locale, namespace);
    if (!resolved) return this.missing(key, locale, namespace);
    try {
      return this.engine.format(resolved.locale, resolved.message, values);
    } catch (cause) {
      const [name, path] = splitKey(key, namespace);
      // Never forward engine errors: they may contain interpolation values.
      const message = `Cannot format ${name}:${path} for ${resolved.locale}; check ICU syntax and required parameters.`;
      this.diagnostic({
        code: "format",
        key: path,
        locale,
        namespace: name,
        resolvedLocale: resolved.locale,
        message,
      });
      throw new Error(message, { cause });
    }
  }
  rich(
    key: string,
    values: Values,
    tags: readonly string[],
    locale = this.current.locale,
  ): readonly (string | RichToken)[] {
    const resolved = this.resolve(key, locale);
    return resolved
      ? this.engine.rich(resolved.locale, resolved.message, values, tags)
      : [this.missing(key, locale)];
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ++this.sequence;
    this.abort.abort();
    this.listeners.clear();
    this.catalogs.clear();
    this.loaders.clear();
    this.versions.clear();
    this.engine.clear();
    this.warned.clear();
    this.chains.clear();
  }
}
export function createCore(options: CoreOptions): I18nCore {
  return new I18nCore(options);
}
