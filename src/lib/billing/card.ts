import type { CardBrand } from '@/types';

/* ============================================================
   Card input validation — entirely client-side and in-memory.
   The full number is checked, masked and thrown away; only the
   brand and last four digits ever reach storage.
   ============================================================ */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Luhn checksum. Catches typos, says nothing about whether a card is real. */
export function luhnValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function detectBrand(number: string): CardBrand {
  const d = digitsOnly(number);
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^35/.test(d)) return 'jcb';
  return 'unknown';
}

/** Groups digits for display: 4-4-4-4, or 4-6-5 for Amex. */
export function formatCardNumber(value: string): string {
  const d = digitsOnly(value).slice(0, 19);
  if (detectBrand(d) === 'amex') {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(' ');
  }
  return d.replace(/(.{4})/g, '$1 ').trim();
}

/** Accepts 'MM/YY'; valid when it parses and the card has not expired. */
export function expiryValid(expiry: string, now: Date = new Date()): boolean {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  // A card expires at the end of its printed month.
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  return endOfMonth >= now;
}

export function cvcValid(cvc: string, brand: CardBrand): boolean {
  const d = digitsOnly(cvc);
  return brand === 'amex' ? d.length === 4 : d.length === 3;
}

export function last4(number: string): string {
  return digitsOnly(number).slice(-4);
}

/** Philippine mobile number as used by GCash / Maya: 09XXXXXXXXX or +639XXXXXXXXX. */
export function phMobileValid(value: string): boolean {
  const d = digitsOnly(value);
  return /^09\d{9}$/.test(d) || /^639\d{9}$/.test(d);
}

/** '09171234567' → '09•• ••• 4567' — enough to recognise, useless to abuse. */
export function maskMobile(value: string): string {
  const d = digitsOnly(value);
  const local = d.startsWith('63') ? `0${d.slice(2)}` : d;
  return `${local.slice(0, 2)}•• ••• ${local.slice(-4)}`;
}
