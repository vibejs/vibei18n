export type Direction = "ltr" | "rtl";
export type Fallback =
  | string
  | readonly string[]
  | Readonly<Record<string, readonly string[]>>
  | false;
export function canonicalLocale(locale: string): string {
  return new Intl.Locale(locale).toString();
}
export function localeParents(locale: string): string[] {
  const tag = new Intl.Locale(locale);
  const result = [tag.toString(), tag.baseName];
  result.push([tag.language, tag.script, tag.region].filter(Boolean).join("-"));
  if (tag.script) result.push(`${tag.language}-${tag.script}`);
  result.push(tag.language);
  return [...new Set(result)];
}
export function fallbackChain(
  locale: string,
  fallback: Fallback = false,
  parents = true,
): string[] {
  const result: string[] = [];
  const mapping = new Map<string, readonly string[]>();
  if (fallback && typeof fallback === "object" && !Array.isArray(fallback))
    for (const [key, values] of Object.entries(fallback)) {
      const name = key === "default" ? key : canonicalLocale(key);
      if (mapping.has(name)) throw new TypeError(`Duplicate canonical fallback locale: ${name}`);
      mapping.set(name, values);
    }
  const seen = new Set<string>();
  const visit = (input: string) => {
    const canonical = canonicalLocale(input);
    if (seen.has(canonical)) return;
    seen.add(canonical);
    result.push(canonical);
    if (fallback && typeof fallback === "object" && !Array.isArray(fallback)) {
      for (const next of mapping.get(canonical) ?? []) visit(next);
    }
    if (parents) for (const parent of localeParents(canonical).slice(1)) visit(parent);
  };
  visit(locale);
  if (typeof fallback === "string") visit(fallback);
  else if (Array.isArray(fallback)) fallback.forEach(visit);
  else if (fallback) for (const next of mapping.get("default") ?? []) visit(next);
  return result;
}
export function negotiateLocale(
  preferences: readonly (string | null | undefined)[],
  supported: readonly string[],
  fallback?: string,
): string | undefined {
  const available = new Set(supported.map(canonicalLocale));
  for (const preference of preferences) {
    if (!preference) continue;
    try {
      for (const candidate of localeParents(preference))
        if (available.has(candidate)) return candidate;
    } catch {
      /* Ignore malformed external preferences. */
    }
  }
  if (fallback) {
    const candidate = canonicalLocale(fallback);
    if (available.has(candidate)) return candidate;
  }
  return undefined;
}
const rtlScripts = new Set([
  "Arab",
  "Hebr",
  "Thaa",
  "Nkoo",
  "Adlm",
  "Rohg",
  "Syrc",
  "Samr",
  "Mand",
]);
export function directionOf(locale: string): Direction {
  const tag = new Intl.Locale(locale);
  const metadata = tag as Intl.Locale & {
    getTextInfo?: () => { direction: Direction };
    textInfo?: { direction: Direction };
  };
  return (
    metadata.getTextInfo?.().direction ??
    metadata.textInfo?.direction ??
    (rtlScripts.has(tag.maximize().script ?? "") ? "rtl" : "ltr")
  );
}
