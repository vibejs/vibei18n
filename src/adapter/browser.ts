import { getCurrentScope, onScopeDispose } from "@usevibejs/ui";
import type { I18n } from "./index.ts";
import type { MessageSchema } from "../types/index.ts";
import { negotiateLocale } from "../core/locale.ts";
export interface LocaleStorage {
  read(): string | null | Promise<string | null>;
  write(locale: string): void | Promise<void>;
  subscribe?(listener: (locale: string | null) => void): () => void;
}
function owned(stop: () => void): () => void {
  if (getCurrentScope()) onScopeDispose(stop);
  return stop;
}
export function localStorageAdapter(
  key = "vibei18n.locale",
  windowObject: Window | undefined = typeof window === "undefined" ? undefined : window,
): LocaleStorage {
  return {
    read() {
      try {
        return windowObject?.localStorage.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    write(locale) {
      try {
        windowObject?.localStorage.setItem(key, locale);
      } catch {
        /* Persistence is optional. */
      }
    },
    subscribe(listener) {
      const handler = (event: StorageEvent) => {
        try {
          if (event.storageArea === windowObject?.localStorage && event.key === key)
            listener(event.newValue);
        } catch {
          /* Storage may be blocked. */
        }
      };
      windowObject?.addEventListener("storage", handler);
      return () => windowObject?.removeEventListener("storage", handler);
    },
  };
}
export interface PersistenceOptions {
  /** Disable when the application has already resolved a higher-priority route/config source. */
  initial?: boolean;
  /** Supply the router connection action when URL locale is authoritative. */
  setLocale?: (locale: string) => Promise<unknown>;
  onError?: (error: unknown) => void;
}
export async function persistLocale<S extends MessageSchema>(
  i18n: I18n<S>,
  storage: LocaleStorage,
  options: PersistenceOptions = {},
): Promise<() => void> {
  let active = true;
  let observed = i18n.locale.value;
  let writes = Promise.resolve();
  const initialState = i18n.core.state;
  const unsubscribe = i18n.core.subscribe((event) => {
    if (
      !active ||
      event.type !== "state" ||
      event.state.isLoading ||
      event.state.locale === observed
    )
      return;
    const next = (observed = event.state.locale);
    writes = writes
      .then(async () => {
        if (active) await storage.write(next);
      })
      .catch((error) => {
        options.onError?.(error);
      });
  });
  const sync = async (value: string | null) => {
    if (!active) return;
    const next = negotiateLocale([value], i18n.availableLocales.value);
    if (next && next !== i18n.locale.value) {
      observed = next;
      try {
        await (options.setLocale ?? i18n.setLocale)(next);
      } catch (error) {
        observed = i18n.locale.value;
        options.onError?.(error);
      }
    }
  };
  const unlisten = storage.subscribe?.((value) => {
    void sync(value);
  });
  const stop = owned(() => {
    active = false;
    unsubscribe();
    unlisten?.();
  });
  if (options.initial !== false)
    try {
      const saved = await storage.read();
      if (i18n.core.state === initialState) await sync(saved);
    } catch (error) {
      options.onError?.(error);
    }
  return stop;
}
// A WeakMap is ownership metadata only; it contains no locale state and cannot keep documents alive.
const documents = new WeakMap<HTMLElement, object>();
export function syncDocument<S extends MessageSchema>(
  i18n: I18n<S>,
  element: HTMLElement = document.documentElement,
): () => void {
  if (documents.has(element))
    throw new Error(
      "Document language attributes already have an owner. Use a widget root instead.",
    );
  const owner = {};
  documents.set(element, owner);
  const before = { lang: element.getAttribute("lang"), dir: element.getAttribute("dir") };
  let written = { lang: "", dir: "" };
  const apply = () => {
    written = { lang: i18n.locale.value, dir: i18n.dir.value };
    element.setAttribute("lang", written.lang);
    element.setAttribute("dir", written.dir);
  };
  apply();
  const unsubscribe = i18n.core.subscribe((event) => {
    if (event.type === "state" && !event.state.isLoading) apply();
  });
  return owned(() => {
    unsubscribe();
    if (documents.get(element) !== owner) return;
    documents.delete(element);
    for (const attribute of ["lang", "dir"] as const)
      if (element.getAttribute(attribute) === written[attribute]) {
        const previous = before[attribute];
        if (previous === null) element.removeAttribute(attribute);
        else element.setAttribute(attribute, previous);
      }
  });
}
