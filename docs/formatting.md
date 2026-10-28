# ICU and Intl formatting

VibeI18n uses intl-messageformat 12.1.4 and the matching FormatJS ICU parser. It does not parse ICU with regular expressions, execute translation code, or maintain manual plural rules.

## ICU messages

```json
{
  "hello": "Hello, {name}!",
  "cart": "{count, plural, =0 {No items} one {# item} other {# items}}",
  "subject": "{gender, select, male {He} female {She} other {They}}",
  "rank": "{position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}",
  "amount": "{amount, number}",
  "date": "{date, date, medium}"
}
```

Plural categories belong to each language. Japanese/Korean use other; Russian, Polish and Arabic have additional categories. Exact =0 is evaluated separately from a category. ICU supports nesting, offsets, skeletons and escaping. Use apostrophes around syntax characters (`'{name}'` displays literal braces), and doubled apostrophes for a literal apostrophe when escaping. Use ASCII apostrophe deliberately; typographic apostrophes in prose are ordinary text. A required other branch is validated by the parser.

## Number and currency

```ts
n(1234.56);
n(0.35, { style: "percent" });
n(1200, { notation: "compact" });
n(1234.56, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" });
n(12, { style: "unit", unit: "kilometer" });
```

All native Intl options are accepted, including grouping, sign and precision. Currency is always explicitly selected; language never implies a financial currency. Intl owns ISO currency precision, symbols and positioning. No exchange-rate conversion is performed. Named ICU presets can be supplied through `formats` (number/date/time maps); ordinary helpers accept the same native options directly.

## Dates and times

```ts
const i18n = createI18n({ locale: "en", timeZone: "Europe/Istanbul", messages: { en } });
i18n.d(new Date(), { dateStyle: "long", timeStyle: "short" });
i18n.d(timestamp, { hour: "2-digit", hourCycle: "h23", timeZone: "UTC" });
i18n.dateRange(start, end, { dateStyle: "medium" });
```

The configured timezone applies to helpers and ICU date/time arguments. A per-call timezone overrides it. Intl handles DST and calendars; a Date is an instant, not a date-only business value. Preserve date-only values such as Calendar's YYYY-MM-DD until application-specific conversion is required. Range formatting uses native formatRange; older hosts get separately formatted endpoints joined with an en dash. There is no attempt to simulate native locale range elision.

## Relative time, lists and collation

```ts
rt(-5, "minute");
rt(-1, "day", { numeric: "auto" });
list(["Apple", "Banana", "Orange"], { type: "conjunction" });
i18n.compare("Élodie", "Cem", { sensitivity: "base", numeric: true });
```

Relative formatting accepts seconds through years and does not create timers. Applications own scheduling. List styles include long/short/narrow and conjunction/disjunction/unit. Collation is explicit and does not mutate or sort application data. Formatter composables expose reactive computed Intl instances when parts, resolvedOptions, ranges, or specialized operations are needed.
