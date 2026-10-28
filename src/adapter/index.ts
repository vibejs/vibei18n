import {
  computed,
  shallowRef,
  provide,
  inject,
  hasInjectionContext,
  getCurrentScope,
  onScopeDispose,
} from "@usevibejs/ui";
import type { App, ComputedRef, InjectionKey, ShallowRef } from "@usevibejs/ui";
import { I18nCore, directionOf } from "../core/index.ts";
import type { CoreOptions, Direction } from "../core/index.ts";
import type {
  Catalog,
  InferSchema,
  MessageSchema,
  RegisteredSchema,
  Translate,
  Values,
} from "../types/index.ts";
export const i18nKey: InjectionKey<I18n> = Symbol("VibeI18n");
export interface I18n<S extends MessageSchema = MessageSchema> {
  readonly core: I18nCore;
  readonly locale: ComputedRef<string>;
  readonly requestedLocale: ComputedRef<string>;
  readonly isLoading: ComputedRef<boolean>;
  readonly error: ComputedRef<unknown>;
  readonly availableLocales: ComputedRef<readonly string[]>;
  readonly fallbackLocale: CoreOptions["fallbackLocale"];
  readonly dir: ComputedRef<Direction>;
  readonly t: Translate<S>;
  readonly dynamic: (key: string, values?: Values) => string;
  readonly ready: Promise<boolean>;
  readonly setLocale: I18nCore["setLocale"];
  readonly preload: I18nCore["preload"];
  readonly register: I18nCore["register"];
  readonly rich: I18nCore["rich"];
  n(value: number | bigint, options?: Intl.NumberFormatOptions): string;
  d(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  dateRange(start: Date | number, end: Date | number, options?: Intl.DateTimeFormatOptions): string;
  rt(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions,
  ): string;
  list(values: Iterable<string>, options?: Intl.ListFormatOptions): string;
  compare(a: string, b: string, options?: Intl.CollatorOptions): number;
  install(app: App): void;
  use(): I18n<S>;
  dispose(): void;
}
export type I18nOptions<
  M extends Readonly<Record<string, Catalog>>,
  S extends MessageSchema,
> = Omit<CoreOptions, "messages"> & { messages?: M; schema?: S };
function adapt<S extends MessageSchema>(core: I18nCore): I18n<S> {
  const state = shallowRef(core.state);
  const revisions = new Map<string, ShallowRef<number>>();
  const catalogRevision = shallowRef(0);
  const version = (tag: string, namespace: string) => {
    const id = JSON.stringify([tag, namespace]);
    let ref = revisions.get(id);
    if (!ref) {
      ref = shallowRef(0);
      revisions.set(id, ref);
    }
    return ref;
  };
  const stop = core.subscribe((event) => {
    if (event.type === "state") state.value = event.state;
    else {
      version(event.locale, event.namespace).value++;
      catalogRevision.value++;
    }
  });
  const locale = computed(() => state.value.locale);
  const read = (key: string) => {
    const namespace = key.includes(":") ? key.slice(0, key.indexOf(":")) : "default";
    for (const tag of core.fallbackLocales(locale.value)) void version(tag, namespace).value;
  };
  const dynamic = (key: string, values?: Values) => {
    read(key);
    return core.t(key, values, locale.value);
  };
  let installed: App | undefined;
  const context: I18n<S> = {
    core,
    locale,
    requestedLocale: computed(() => state.value.requestedLocale),
    isLoading: computed(() => state.value.isLoading),
    error: computed(() => state.value.error),
    availableLocales: computed(() => {
      void catalogRevision.value;
      return core.availableLocales;
    }),
    fallbackLocale: core.fallbackLocale,
    dir: computed(() => core.options.direction ?? directionOf(locale.value)),
    // The generic call signature only constrains consumer calls; runtime keys are strings.
    t: dynamic as Translate<S>,
    dynamic,
    ready: core.setLocale(core.state.locale),
    setLocale: core.setLocale.bind(core),
    preload: core.preload.bind(core),
    register: core.register.bind(core),
    rich: (key, values, tags, tag) => {
      read(key);
      return core.rich(key, values, tags, tag ?? locale.value);
    },
    n: (value, options) => core.engine.number(locale.value, options).format(value),
    d: (value, options) => core.engine.date(locale.value, options).format(value),
    dateRange: (start, end, options) => {
      const formatter = core.engine.date(locale.value, options);
      return typeof formatter.formatRange === "function"
        ? formatter.formatRange(start, end)
        : `${formatter.format(start)} – ${formatter.format(end)}`;
    },
    rt: (value, unit, options) => core.engine.relative(locale.value, options).format(value, unit),
    list: (values, options) => core.engine.list(locale.value, options).format(values),
    compare: (a, b, options) => core.engine.collator(locale.value, options).compare(a, b),
    install(app) {
      if (installed && installed !== app)
        throw new Error("Create a separate VibeI18n instance for each application.");
      installed = app;
      app.provide(i18nKey, context as I18n);
      app.onUnmount(context.dispose);
    },
    use: () => context,
    dispose() {
      stop();
      core.dispose();
      revisions.clear();
    },
  };
  // Mark the initial promise handled even if a consumer reads error instead of awaiting ready.
  void context.ready.catch(() => {});
  return context;
}
export function createI18n<
  const M extends Readonly<Record<string, Catalog>> = Readonly<Record<string, Catalog>>,
  S extends MessageSchema = InferSchema<M[keyof M]>,
>(options: I18nOptions<M, S>): I18n<S> {
  return adapt<S>(new I18nCore(options));
}
export function useI18n<S extends MessageSchema = RegisteredSchema>(): I18n<S> {
  if (!hasInjectionContext())
    throw new Error("useI18n() requires component setup or app.runWithContext().");
  const context = inject(i18nKey, undefined);
  if (!context) throw new Error("Install VibeI18n with app.use(i18n) before calling useI18n().");
  return context as I18n<S>;
}
export function provideI18n<S extends MessageSchema>(context: I18n<S>): I18n<S> {
  provide(i18nKey, context as I18n);
  return context;
}
/** Child catalogs are snapshots, independently owned. Pass loaders/messages explicitly. */
export function createLocaleContext<
  const M extends Readonly<Record<string, Catalog>> = Readonly<Record<string, Catalog>>,
  S extends MessageSchema = InferSchema<M[keyof M]>,
>(options: I18nOptions<M, S>): I18n<S> {
  const child = createI18n(options);
  provideI18n(child);
  if (getCurrentScope()) onScopeDispose(child.dispose);
  return child;
}
export function useLocale(): I18n["locale"] {
  return useI18n().locale;
}
export function useDirection(): I18n["dir"] {
  return useI18n().dir;
}
export function useNumberFormat(
  options: Intl.NumberFormatOptions = {},
): ComputedRef<Intl.NumberFormat> {
  const { core, locale } = useI18n();
  return computed(() => core.engine.number(locale.value, options));
}
export function useDateFormat(
  options: Intl.DateTimeFormatOptions = {},
): ComputedRef<Intl.DateTimeFormat> {
  const { core, locale } = useI18n();
  return computed(() => core.engine.date(locale.value, options));
}
export function useRelativeTimeFormat(
  options: Intl.RelativeTimeFormatOptions = {},
): ComputedRef<Intl.RelativeTimeFormat> {
  const { core, locale } = useI18n();
  return computed(() => core.engine.relative(locale.value, options));
}
export function useListFormat(options: Intl.ListFormatOptions = {}): ComputedRef<Intl.ListFormat> {
  const { core, locale } = useI18n();
  return computed(() => core.engine.list(locale.value, options));
}
export function usePluralRules(
  options: Intl.PluralRulesOptions = {},
): ComputedRef<Intl.PluralRules> {
  const { core, locale } = useI18n();
  return computed(() => core.engine.plural(locale.value, options));
}
