import type { Message } from "../types/index.ts";
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
export function flattenCatalog(input: unknown): ReadonlyMap<string, Message> {
  const result = new Map<string, Message>();
  const ancestors = new Set<object>();
  function visit(value: unknown, prefix: string, depth: number): void {
    if (typeof value === "string" || Array.isArray(value)) {
      if (!prefix || result.has(prefix))
        throw new TypeError(`Duplicate or empty message key: ${prefix}`);
      // Snapshot resources: subsequent consumer mutation must not bypass invalidation.
      result.set(prefix, typeof value === "string" ? value : structuredClone(value));
      return;
    }
    if (
      !value ||
      typeof value !== "object" ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      depth > 32 ||
      ancestors.has(value)
    )
      throw new TypeError(`Invalid catalog at ${prefix || "<root>"}`);
    ancestors.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (!key || key.includes(":") || key.split(".").some((part) => forbidden.has(part) || !part))
        throw new TypeError(`Invalid catalog key: ${key}`);
      visit(child, prefix ? `${prefix}.${key}` : key, depth + 1);
    }
    ancestors.delete(value);
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("Catalog must be an object.");
  visit(input, "", 0);
  return result;
}
export function splitKey(key: string, namespace = "default"): [string, string] {
  const separator = key.indexOf(":");
  return separator < 0 ? [namespace, key] : [key.slice(0, separator), key.slice(separator + 1)];
}

export function validateNamespace(namespace: string): void {
  if (!/^[\p{L}\p{N}_-][\p{L}\p{N}_.-]*$/u.test(namespace))
    throw new TypeError(
      "Namespace must contain only letters, numbers, dots, underscores or hyphens.",
    );
}
