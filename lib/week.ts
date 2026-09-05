const SYDNEY = "Australia/Sydney";

function sydneyParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    day: get("day"),
    month: get("month"),
    year: get("year"),
  };
}

/** Monday-start week label in Australia/Sydney. */
export function sydneyWeekLabel(date = new Date()): string {
  const weekdayIndex: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  const now = sydneyParts(date);
  const offset = weekdayIndex[now.weekday] ?? 0;
  const monday = new Date(date.getTime() - offset * 24 * 60 * 60 * 1000);
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);

  const start = sydneyParts(monday);
  const end = sydneyParts(sunday);

  if (start.month === end.month) {
    return `${start.day}–${end.day} ${end.month} ${end.year}`;
  }
  return `${start.day} ${start.month} – ${end.day} ${end.month} ${end.year}`;
}

export function sydneyTodayLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
