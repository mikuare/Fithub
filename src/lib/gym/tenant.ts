import type { Gym, ID } from '@/types';
import { nowISO } from '@/lib/date';
import { uid } from '@/lib/id';

/* ============================================================
   Tenancy
   A gym is the tenant. It owns its branding, its pricing and its
   timetable, and it is joined by a short code rather than being
   listed publicly — which is what a local, cash-run gym actually
   wants. Nothing here assumes a payment processor exists.
   ============================================================ */

/**
 * No I, O, 0 or 1 in the random half: those are the characters people misread
 * when a code is spoken down the phone or written on a card. The name-derived
 * half keeps them, because "IRON" is recognisable and "RN" is not.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Letters lifted from the gym's own name, so the code is recognisable. */
function stem(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (letters.slice(0, 4) || 'GYM').padEnd(3, 'X');
}

function suffix(length = 3): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Codes are compared with punctuation and case stripped, so 'iron 4k2' works. */
export function normalizeJoinCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatJoinCode(code: string): string {
  const raw = normalizeJoinCode(code);
  return raw.length > 3 ? `${raw.slice(0, raw.length - 3)}-${raw.slice(-3)}` : raw;
}

/**
 * A code that is not already taken. Retries with a fresh suffix, then widens
 * it — a collision is far more likely than the caller passing a huge list.
 */
export function generateJoinCode(name: string, taken: Iterable<string> = []): string {
  const used = new Set([...taken].map(normalizeJoinCode));
  const base = stem(name);
  for (let attempt = 0; attempt < 24; attempt++) {
    const code = `${base}${suffix(attempt < 16 ? 3 : 4)}`;
    if (!used.has(code)) return code;
  }
  return `${base}${suffix(6)}`;
}

export function findGymByCode(gyms: Gym[], code: string): Gym | null {
  const wanted = normalizeJoinCode(code);
  if (!wanted) return null;
  return gyms.find((g) => normalizeJoinCode(g.join_code) === wanted) ?? null;
}

export interface NewGymInput {
  name: string;
  address?: string;
  createdBy: ID | null;
  existingCodes?: string[];
  currency?: string;
}

/** A gym that is valid the moment it is created — everything else is editable. */
export function newGym(input: NewGymInput): Gym {
  return {
    id: uid('gym'),
    name: input.name.trim(),
    join_code: generateJoinCode(input.name, input.existingCodes ?? []),
    description: '',
    address: input.address?.trim() ?? '',
    phone: '',
    email: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    open_hour: 6,
    close_hour: 22,
    capacity: 40,
    currency: input.currency ?? 'USD',
    logo_data_url: null,
    photos: [],
    created_by: input.createdBy,
    active: true,
    created_at: nowISO(),
  };
}

export interface SetupStep {
  key: 'branding' | 'details' | 'pricing' | 'timetable';
  label: string;
  hint: string;
  done: boolean;
}

/**
 * What is still missing before the gym is worth showing to members. Shown as a
 * checklist rather than a blocking wizard: a gym should be usable from the
 * moment it has a name, and improved afterwards.
 */
export function setupSteps(gym: Gym, planCount: number, classCount: number): SetupStep[] {
  return [
    {
      key: 'branding',
      label: 'Add your logo and photos',
      hint: 'Members see these before they see anything else.',
      done: Boolean(gym.logo_data_url) || gym.photos.length > 0,
    },
    {
      key: 'details',
      label: 'Address and contact details',
      hint: 'So people can find you and call you.',
      done: gym.address.trim().length > 0 && (gym.phone.trim().length > 0 || gym.email.trim().length > 0),
    },
    {
      key: 'pricing',
      label: 'Set your pricing',
      hint: 'At least one membership plan members can pay for.',
      done: planCount > 0,
    },
    {
      key: 'timetable',
      label: 'Publish your timetable',
      hint: 'Classes members can book a spot in.',
      done: classCount > 0,
    },
  ];
}

export function setupProgress(steps: SetupStep[]): number {
  if (!steps.length) return 100;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}

/** Currencies the gym picker offers. Symbol is for display only. */
export const GYM_CURRENCIES: Array<{ code: string; symbol: string; label: string }> = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'PHP', symbol: '₱', label: 'Philippine Peso' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'AED', symbol: 'AED', label: 'UAE Dirham' },
];

export function currencySymbol(code: string): string {
  return GYM_CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/** Money as the gym would write it on a receipt. */
export function formatMoney(amount: number, currency: string): string {
  const symbol = currencySymbol(currency);
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return symbol.length > 1 ? `${symbol} ${value}` : `${symbol}${value}`;
}
