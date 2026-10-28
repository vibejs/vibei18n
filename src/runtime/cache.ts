/** Bounded least-recently-used cache, local to each engine. */
export class LRU<K, V> {
  private readonly entries = new Map<K, V>();
  hits = 0;
  misses = 0;
  constructor(readonly capacity = 256) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError("Cache capacity must be a positive integer.");
  }
  get(key: K, create: () => V): V {
    if (this.entries.has(key)) {
      this.hits++;
      const value = this.entries.get(key)!;
      this.entries.delete(key);
      this.entries.set(key, value);
      return value;
    }
    this.misses++;
    const value = create();
    this.entries.set(key, value);
    if (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
    return value;
  }
  clear(): void {
    this.entries.clear();
  }
  get size(): number {
    return this.entries.size;
  }
}
export function optionsKey(options: object): string {
  return JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)));
}
