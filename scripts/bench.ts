import { performance } from "node:perf_hooks";
import { writeFile, mkdir } from "node:fs/promises";
import { createCore } from "@usevibejs/i18n/core";
const core = createCore({
  locale: "en",
  cacheSize: 64,
  messages: {
    en: { simple: "Hello", icu: "{n, plural, one {# item for {name}} other {# items for {name}}}" },
    tr: { simple: "Merhaba", icu: "{n, plural, other {{name} için # öğe}}" },
  },
});
const measure = (iterations: number, fn: () => void) => {
  for (let i = 0; i < 1000; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const milliseconds = performance.now() - start;
  return { iterations, milliseconds, nanosecondsPerOperation: (milliseconds * 1e6) / iterations };
};
const heapBefore = process.memoryUsage().heapUsed;
const simple = measure(50000, () => {
  core.t("simple");
});
const icu = measure(50000, () => {
  core.t("icu", { n: 7, name: "Alex" });
});
const number = measure(50000, () => {
  core.engine.number("tr", { style: "currency", currency: "USD" }).format(1234.5);
});
const start = performance.now();
for (let i = 0; i < 1000; i++) await core.setLocale(i % 2 ? "en" : "tr");
const result = {
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  simple,
  icu,
  number,
  localeSwitch: { iterations: 1000, milliseconds: performance.now() - start },
  heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
  messageCache: {
    size: core.engine.messages.size,
    hits: core.engine.messages.hits,
    misses: core.engine.messages.misses,
  },
  formatterCache: {
    size: core.engine.formatters.size,
    hits: core.engine.formatters.hits,
    misses: core.engine.formatters.misses,
  },
  note: "Single-process warmed microbenchmark. Heap delta includes ordinary allocations and is not a retained-memory or leak measurement.",
};
await mkdir("reports", { recursive: true });
await writeFile("reports/benchmark.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
