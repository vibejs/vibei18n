import { computed } from "@usevibejs/ui";
import type { VibeAuthClient } from "@usevibejs/auth";
import type { I18n, MessageSchema } from "../../src/index.ts";
/** Only allowlisted public codes reach the catalog. Raw errors/identifiers stay private. */
export function localizedAuthError<S extends MessageSchema>(
  i18n: I18n<S>,
  auth: Pick<VibeAuthClient, "error">,
  publicCodes: Readonly<Record<string, string>>,
  genericKey: string,
) {
  return computed(() => {
    const error: unknown = auth.error.value;
    if (!error) return "";
    const code =
      typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
    const key = code && Object.hasOwn(publicCodes, code) ? publicCodes[code] : genericKey;
    return i18n.dynamic(key);
  });
}
