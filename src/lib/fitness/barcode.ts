/* ============================================================
   Barcode scanning support — the pure parts.
   The camera and BarcodeDetector live in the component; checksum
   validation and Open Food Facts response mapping live here so
   they can be tested without a browser.
   ============================================================ */

export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * EAN-8 / UPC-A / EAN-13 check-digit validation (all use the same
 * alternating 1–3 weighting from the right). Catches misreads and typos.
 */
export function barcodeValid(code: string): boolean {
  const d = normalizeBarcode(code);
  if (![8, 12, 13].includes(d.length)) return false;
  let sum = 0;
  for (let i = 0; i < d.length - 1; i++) {
    const digit = d.charCodeAt(d.length - 2 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === d.charCodeAt(d.length - 1) - 48;
}

/** Open Food Facts product lookup URL. Only the barcode digits are sent. */
export function offProductUrl(code: string): string {
  return `https://world.openfoodfacts.org/api/v0/product/${normalizeBarcode(code)}.json`;
}

export interface ScannedMacros {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface ScannedProduct {
  name: string;
  brand: string | null;
  servingSize: string | null;
  per100g: ScannedMacros;
  perServing: ScannedMacros | null;
  /** True when every per-100g macro is present — otherwise the UI says so. */
  complete: boolean;
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  // Community records occasionally serialise a numeric nutrient as a string.
  // Accept plain numeric strings, but never coerce blanks or strings with units.
  if (typeof value === 'string' && /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function macros(n: Record<string, unknown>, suffix: '100g' | 'serving'): ScannedMacros {
  // Energy may only exist in kJ; convert when kcal is absent.
  let calories = num(n[`energy-kcal_${suffix}`]);
  if (calories === null) {
    const kj = num(n[`energy_${suffix}`]);
    calories = kj === null ? null : Math.round(kj / 4.184);
  } else {
    calories = Math.round(calories);
  }
  const r = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  return {
    calories,
    protein_g: r(num(n[`proteins_${suffix}`])),
    carbs_g: r(num(n[`carbohydrates_${suffix}`])),
    fat_g: r(num(n[`fat_${suffix}`])),
  };
}

/**
 * Maps an Open Food Facts response to what the log needs. Missing values stay
 * null — the UI reports them as missing instead of pretending they are zero.
 */
export function mapOffProduct(json: unknown): ScannedProduct | null {
  const root = json as { status?: number; product?: Record<string, unknown> } | null;
  const product = root?.product;
  if (!product || root?.status === 0) return null;

  const name = typeof product.product_name === 'string' && product.product_name.trim()
    ? product.product_name.trim()
    : null;
  if (!name) return null;

  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
  const per100g = macros(nutriments, '100g');
  const perServingRaw = macros(nutriments, 'serving');
  const hasServing = Object.values(perServingRaw).some((v) => v !== null);

  return {
    name,
    brand: typeof product.brands === 'string' && product.brands.trim() ? product.brands.split(',')[0].trim() : null,
    servingSize: typeof product.serving_size === 'string' && product.serving_size.trim() ? product.serving_size.trim() : null,
    per100g,
    perServing: hasServing ? perServingRaw : null,
    complete: Object.values(per100g).every((v) => v !== null),
  };
}
