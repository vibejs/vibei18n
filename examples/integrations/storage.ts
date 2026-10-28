import { watch } from "@usevibejs/ui";
import { useStorage } from "@usevibejs/use";
import { persistLocale } from "../../src/index.ts";
import type { I18n, MessageSchema, PersistenceOptions } from "../../src/index.ts";
/** Call in setup/effect scope. VibeUse remains the only persistent-storage writer. */
export async function useStoredLocale<S extends MessageSchema>(
  i18n: I18n<S>,
  key = "atlas.locale",
  options: PersistenceOptions = {},
) {
  const storage = useStorage(key, "", { writeDefaults: false });
  try {
    const stop = await persistLocale(
      i18n,
      {
        read: () => storage.data.value,
        write: (locale) => {
          storage.data.value = locale;
        },
        subscribe: (listener) => watch(storage.data, (value) => listener(value), { flush: "sync" }),
      },
      options,
    );
    return () => {
      stop();
      storage.stop();
    };
  } catch (error) {
    storage.stop();
    throw error;
  }
}
