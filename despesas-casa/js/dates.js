// Date helpers (Issue #3, ADR-5/ADR-6). Expense dates are "YYYY-MM-DD" strings and
// are never turned into Date objects for month logic, so the device time zone
// cannot move an expense to another month. Pure module: no DOM, no window.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;

const MONTH_LABEL = new Intl.DateTimeFormat('pt-PT', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const pad = (n, len = 2) => String(n).padStart(len, '0');

/** "YYYY-MM-DD" that is a real calendar day (so "2026-02-30" is invalid). */
export function isValidISODate(s) {
  if (typeof s !== 'string') return false;
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1 || mo < 1 || mo > 12 || d < 1) return false;
  const probe = new Date(0);
  probe.setUTCFullYear(y, mo - 1, d); // UTC round-trip, avoids the 0-99 year quirk of Date.UTC
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

/** "2026-10-31" -> "31/10/2026" by string slicing (no Date). */
export function formatDatePT(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** "2026-10-31" -> "2026-10". */
export function monthKey(iso) {
  return iso.slice(0, 7);
}

export function isValidMonthKey(key) {
  const m = typeof key === 'string' && MONTH_KEY.exec(key);
  return Boolean(m) && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** Integer month arithmetic across years: addMonths("2026-12", 1) -> "2027-01". */
export function addMonths(key, n) {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  return `${pad(ny, 4)}-${pad(nm)}`;
}

/** The device's local calendar day for `now` (Date or epoch ms), as "YYYY-MM-DD". */
export function todayISO(now) {
  const d = now instanceof Date ? now : new Date(now);
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Number of days in a month key, e.g. "2026-02" -> 28. */
export function daysInMonth(key) {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const probe = new Date(0);
  probe.setUTCFullYear(y, m, 0);
  return probe.getUTCDate();
}

/** "2026-10" -> "outubro de 2026". Time zone fixed to UTC so the label never shifts. */
export function formatMonthLabel(key) {
  const probe = new Date(0);
  probe.setUTCFullYear(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
  return MONTH_LABEL.format(probe);
}
