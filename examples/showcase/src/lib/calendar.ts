// Gregorian, local date-only arithmetic. No UTC conversion of consumer selections.
export function parseDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day)
    return date;
}

export const dateKey = (date: Date): string =>
  `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + amount);
  const last = new Date(next);
  last.setMonth(last.getMonth() + 1, 0);
  next.setDate(Math.min(date.getDate(), last.getDate()));
  return next;
}

export function firstWeekday(locale: string): number {
  const info = new Intl.Locale(locale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
  };
  const first = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
  if (first !== undefined) return first % 7;
  // Older browsers expose neither API. Region is still resolved through Intl, including
  // language-only locales such as en and ar. Values follow CLDR's territory week starts.
  const region = info.maximize().region;
  if (region === "MV") return 5;
  if ("AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY".split(" ").includes(region!)) return 6;
  return "AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW"
    .split(" ")
    .includes(region!)
    ? 0
    : 1;
}
