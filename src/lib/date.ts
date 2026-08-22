import type { ISODate, Weekday } from '@/types';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_MIN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Local-time YYYY-MM-DD. Never use toISOString() — it shifts by timezone. */
export function toISODate(d: Date = new Date()): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = fromISODate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function addMonths(date: ISODate, n: number): ISODate {
  const d = fromISODate(date);
  d.setMonth(d.getMonth() + n);
  return toISODate(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  const ms = fromISODate(a).getTime() - fromISODate(b).getTime();
  return Math.round(ms / 86_400_000);
}

export function weekdayOf(date: ISODate): Weekday {
  return fromISODate(date).getDay() as Weekday;
}

/** Start of the week containing `date`. weekStart 0=Sunday, 1=Monday. */
export function startOfWeek(date: ISODate, weekStart: 0 | 1 = 1): ISODate {
  const d = fromISODate(date);
  const day = d.getDay();
  const back = (day - weekStart + 7) % 7;
  d.setDate(d.getDate() - back);
  return toISODate(d);
}

export function endOfWeek(date: ISODate, weekStart: 0 | 1 = 1): ISODate {
  return addDays(startOfWeek(date, weekStart), 6);
}

export function startOfMonth(date: ISODate): ISODate {
  const d = fromISODate(date);
  d.setDate(1);
  return toISODate(d);
}

export function endOfMonth(date: ISODate): ISODate {
  const d = fromISODate(date);
  d.setMonth(d.getMonth() + 1, 0);
  return toISODate(d);
}

export function isSameDay(a: ISODate, b: ISODate): boolean {
  return a === b;
}

export function isBetween(date: ISODate, start: ISODate, end: ISODate): boolean {
  return date >= start && date <= end;
}

export function rangeDays(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 1500) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function formatDate(date: ISODate, style: 'short' | 'medium' | 'long' | 'day' = 'medium'): string {
  const d = fromISODate(date);
  switch (style) {
    case 'short':
      return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
    case 'long':
      return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    case 'day':
      return DAY_SHORT[d.getDay()];
    default:
      return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
  }
}

/** "Today", "Yesterday", "Tomorrow", else a short date. */
export function relativeDay(date: ISODate): string {
  const delta = diffDays(date, today());
  if (delta === 0) return 'Today';
  if (delta === -1) return 'Yesterday';
  if (delta === 1) return 'Tomorrow';
  if (delta > 1 && delta < 7) return DAY_NAMES[weekdayOf(date)];
  return formatDate(date, 'short');
}

export function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function formatClock(time: string): string {
  const [hRaw, m] = time.split(':').map(Number);
  const h = hRaw ?? 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, '0')} ${period}`;
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function ageFrom(birth: ISODate | null): number | null {
  if (!birth) return null;
  const b = fromISODate(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}
