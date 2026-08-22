/**
 * Row id generator. Always returns a plain RFC-4122 v4 UUID — the Postgres
 * schema types every primary key as `uuid`, so the old human-friendly
 * `prefix_…` ids would be rejected the moment the Supabase backend is used.
 * The parameter survives as a call-site hint only and is deliberately ignored.
 */
export function uid(_hint = ''): string {
  const c = typeof crypto !== 'undefined' ? (crypto as Partial<Crypto>) : undefined;
  if (c?.randomUUID) return c.randomUUID();
  // Non-secure contexts (plain-HTTP LAN testing) lack randomUUID; shape one.
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Human-facing gym member code, e.g. FH-4K7Q-22. */
export function memberCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `FH-${pick(4)}-${pick(2)}`;
}
