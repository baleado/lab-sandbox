// Dates (AC1 DD/MM/AAAA, AC2 invalid date, AC7 month boundaries in any TZ).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidISODate, formatDatePT, monthKey, addMonths, todayISO, formatMonthLabel, daysInMonth, isValidMonthKey } from '../js/dates.js';

test('AC2: ISO date validation rejects impossible days and bad shapes', () => {
  for (const s of ['2026-10-31', '2026-11-01', '2024-02-29', '2026-01-01', '0099-05-05']) assert.equal(isValidISODate(s), true, s);
  for (const s of ['2026-02-30', '2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-10-00', '31/10/2026', '2026-1-1', '', undefined, 20261031])
    assert.equal(isValidISODate(s), false, String(s));
});

test('AC1: list dates are DD/MM/AAAA by string slicing', () => {
  assert.equal(formatDatePT('2026-10-31'), '31/10/2026');
  assert.equal(formatDatePT('2026-01-05'), '05/01/2026');
});

test('AC7: month key comes from the date string, whatever the TZ', () => {
  assert.equal(monthKey('2026-10-31'), '2026-10');
  assert.equal(monthKey('2026-11-01'), '2026-11');
});

test('AC7: addMonths wraps years in both directions', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-10', 0), '2026-10');
  assert.equal(addMonths('2026-10', 15), '2028-01');
  assert.equal(addMonths('2026-10', -22), '2024-12');
});

test('AC7: todayISO uses the device local calendar day', () => {
  const d = new Date(2026, 9, 31, 23, 59, 30); // local time
  assert.equal(todayISO(d), '2026-10-31');
  assert.equal(todayISO(d.getTime()), '2026-10-31');
  assert.equal(todayISO(new Date(2026, 10, 1, 0, 0, 1)), '2026-11-01');
});

test('month labels are pt-PT and never shift with the TZ', () => {
  assert.equal(formatMonthLabel('2026-10'), 'outubro de 2026');
  assert.equal(formatMonthLabel('2026-11'), 'novembro de 2026');
  assert.equal(formatMonthLabel('2027-01'), 'janeiro de 2027');
  assert.equal(formatMonthLabel('2026-12'), 'dezembro de 2026');
});

test('daysInMonth and isValidMonthKey', () => {
  assert.equal(daysInMonth('2026-02'), 28);
  assert.equal(daysInMonth('2024-02'), 29);
  assert.equal(daysInMonth('2026-10'), 31);
  assert.equal(isValidMonthKey('2026-10'), true);
  assert.equal(isValidMonthKey('2026-13'), false);
});
