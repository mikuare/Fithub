export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Sum with a selector, ignoring null/undefined entries. */
export function sumBy<T>(rows: T[], pick: (row: T) => number | null | undefined): number {
  let total = 0;
  for (const row of rows) {
    const v = pick(row);
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

export function avgBy<T>(rows: T[], pick: (row: T) => number | null | undefined): number | null {
  const vals = rows.map(pick).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const row of rows) {
    const k = key(row);
    (out[k] ||= []).push(row);
  }
  return out;
}

export function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function titleCase(s: string): string {
  return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

/** mm:ss, or h:mm:ss past an hour. */
export function formatDuration(totalSeconds: number, forceHours = false): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0 || forceHours) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

/** Compact human duration: "1h 04m", "58 min", "45s". */
export function humanDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m} min`;
}

export function formatNumber(n: number, dp = 0): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  '#B9F227', '#7C5CFF', '#38BDF8', '#34C77B', '#F5BE3E',
  '#F87171', '#F472B6', '#22D3EE', '#A78BFA', '#FB923C',
];

export function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Percentage 0..100 guarded against divide-by-zero. */
export function pct(value: number, total: number): number {
  if (!total) return 0;
  return clamp((value / total) * 100, 0, 100);
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Case/diacritic-insensitive substring search used by every filter UI. */
export function matches(haystack: string, needle: string): boolean {
  if (!needle.trim()) return true;
  const norm = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return norm(haystack).includes(norm(needle.trim()));
}
