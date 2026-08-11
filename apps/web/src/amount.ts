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
