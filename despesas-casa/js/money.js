// Money helpers (Issue #3, ADR-5). Amounts are integer cents; never floats.
// Pure module: no DOM, no window.

export const MAX_CENTS = 99999999; // 999 999,99 €

const AMOUNT_SHAPE = /^(\d+)(?:[.,](\d+))?$/;

const EUR = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

/**
 * Parse a user-typed amount ("12,50" or "12.50") into integer cents.
 * Uses string/integer arithmetic only (never float multiplication).
 * @param {unknown} text
 * @returns {{ ok: true, cents: number } | { ok: false, code: 'required'|'notNumber'|'tooManyDecimals'|'notPositive'|'tooLarge' }}
 */
export function parseAmount(text) {
  const s = typeof text === 'string' ? text.trim() : '';
  if (s === '') return { ok: false, code: 'required' };
  const m = AMOUNT_SHAPE.exec(s);
  // Rejects letters, signs, spaces, "1.234,56", "12," and ",50".
  if (!m) return { ok: false, code: 'notNumber' };
  const [, intPart, fracPart = ''] = m;
  if (fracPart.length > 2) return { ok: false, code: 'tooManyDecimals' };
  const intDigits = intPart.replace(/^0+(?=\d)/, '');
  if (intDigits.length > 6) return { ok: false, code: 'tooLarge' };
  const cents = Number(intDigits) * 100 + Number(fracPart.padEnd(2, '0'));
  if (cents <= 0) return { ok: false, code: 'notPositive' };
  if (cents > MAX_CENTS) return { ok: false, code: 'tooLarge' };
  return { ok: true, cents };
}

/** Format integer cents as pt-PT euros, e.g. 1250 -> "12,50 €" (ICU spacing). */
export function formatEUR(cents) {
  return EUR.format(cents / 100);
}

/** Integer cents to the plain text used to prefill the amount input: 1250 -> "12,50". */
export function centsToInput(cents) {
  const whole = Math.trunc(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  return `${whole},${rest}`;
}

/** True for a whole number of cents in the stored range (1 .. 99 999 999). */
export function isValidCents(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_CENTS;
}
