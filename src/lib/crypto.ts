/**
 * Password hashing for the local (no-backend) auth adapter.
 *
 * PBKDF2-SHA256 with a per-user random salt. This protects the stored value
 * from casual inspection of the browser database; it is NOT a substitute for
 * a real backend. When Supabase credentials are configured the app uses
 * Supabase Auth instead and this module is bypassed entirely — the Settings
 * screen tells the user which mode they are in.
 */

const ITERATIONS = 210_000;

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${toHex(salt.buffer)}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltHex, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !saltHex || !hash) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex) as unknown as BufferSource, iterations: Number(iterStr) || ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return timingSafeEqual(toHex(bits), hash);
}

/** Constant-time-ish comparison so the hash cannot be probed byte by byte. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string; issues: string[] } {
  const issues: string[] = [];
  if (password.length < 10) issues.push('Use at least 10 characters');
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) issues.push('Mix upper and lower case');
  if (!/\d/.test(password)) issues.push('Include a number');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('Include a symbol');
  if (/^(password|12345|qwerty|letmein|fitness)/i.test(password)) issues.push('Avoid common passwords');

  const met = 4 - Math.min(4, issues.length);
  const score = (password.length >= 16 && issues.length === 0 ? 4 : met) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score], issues };
}
