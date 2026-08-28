/**
 * Parses an es-AR amount string into a numeric value (issue #45).
 *
 * In es-AR the dot is the thousands separator and the comma is the decimal
 * separator, so "1.234" means one thousand two hundred thirty-four, not 1,23.
 *
 * Ambiguity rule: a single dot followed by exactly 3 digits is treated as a
 * thousands separator (es-AR convention). This is a heuristic for a 2-decimal
 * currency — "12.500" reads as 12500, never as 12.5. A comma always wins as
 * the decimal separator, so "1,234" parses as 1.234 (decimal), not 1234.
 */

/** Grouped thousands: 1.234, 1.234.567, 1.234,56 (dot groups of 3, optional decimal). */
const GROUPED = /^\d{1,3}(\.\d{3})+([.,]\d+)?$/;

/**
 * Lenient single-separator form: 12,50, 1200.5, 12.50, 1.234, 1200.
 * A leading separator is allowed for decimals without a zero unit (".50" -> 0.5).
 */
const LENIENT = /^\d*([.,]\d+)?$/;

/** Dot-only, exactly 3 decimals and at least one integer digit (un-grouped thousands). */
const THREE_DECIMAL_DOT = /^\d+\.\d{3}$/;

/**
 * Returns the numeric value of an es-AR amount string, or null when invalid.
 * Never returns NaN: invalid input always resolves to null.
 */
export function parseEsArAmount(raw: string): number | null {
  const input = raw.trim();
  if (input === '') return null;
  if (!GROUPED.test(input) && !LENIENT.test(input)) return null;

  if (input.includes(',')) {
    // Comma is the decimal separator; strip all dots (thousands) and parse.
    return parseFloat(input.replace(/\./g, '').replace(',', '.'));
  }

  if (input.includes('.')) {
    if (GROUPED.test(input)) {
      // 1.234 -> 1234, 1.234.567 -> 1234567
      return parseInt(input.replace(/\./g, ''), 10);
    }
    if (THREE_DECIMAL_DOT.test(input)) {
      // Un-grouped thousands: 1234.567 -> 1234567
      return parseInt(input.replace('.', ''), 10);
    }
    // Decimal: 12.50 -> 12.5, 1200.5 -> 1200.5, .50 -> 0.5
    return parseFloat(input);
  }

  return parseInt(input, 10);
}

/**
 * es-AR percent for a 0..1 fraction with one decimal, e.g. 0.333 → '33,3%'.
 * The register rule: numbers rendered for reading always go through Intl in
 * the es-AR locale (comma decimal), never toFixed's dot output.
 */
export function formatPctEsAr(fraction: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(fraction);
}

/**
 * Prefill string for the es-AR amount text inputs from minor units.
 *
 * Plain decimal: comma as the decimal separator, NO thousands separators
 * (a stored dot would re-parse as a thousands group), trailing zeros
 * trimmed. Round-trips exactly through parseEsArAmount for any 2-decimal
 * value. `currency` is signature-only for future precision: ARS/USD share 2.
 */
export function inputValueEsAr(minorUnits: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  // es-AR keeps two decimals for both currencies: the label documents intent.
  void currency;
  const rounded = Math.round(minorUnits);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  if (cents === 0) return `${sign}${whole}`;
  // '05' | '50' → keep both, drop only a trailing zero: exact round-trip.
  const frac = String(cents).padStart(2, '0').replace(/0$/, '');
  return `${sign}${whole},${frac}`;
}
