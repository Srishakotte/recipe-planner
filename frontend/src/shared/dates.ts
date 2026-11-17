/** Local-date helpers. toISOString() converts to UTC and can shift the day, so never use it for dates. */

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

/** Monday of the week containing `iso` (or today). */
export function weekStartOf(iso = todayIso()): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return addDays(iso, -((date.getDay() + 6) % 7));
}

/** API dates come back as "2026-11-17T00:00:00.000Z"; the date part is the calendar day. */
export const datePart = (value: string) => value.slice(0, 10);

export function formatDay(iso: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, options);
}

export function daysUntil(iso: string): number {
  const [y, m, d] = datePart(iso).split('-').map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

export function relativeDay(days: number): string {
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
