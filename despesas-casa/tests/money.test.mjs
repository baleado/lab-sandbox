// AC2 (amount parsing) and pt-PT currency formatting (AC1, AC7, AC13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatEUR, centsToInput, isValidCents, MAX_CENTS } from '../js/money.js';
import { normSpaces } from './helpers.mjs';

test('AC2: "12,50" and "12.50" are both 1250 cents', () => {
  assert.deepEqual(parseAmount('12,50'), { ok: true, cents: 1250 });
  assert.deepEqual(parseAmount('12.50'), { ok: true, cents: 1250 });
  assert.deepEqual(parseAmount('  12,5 '), { ok: true, cents: 1250 });
});

test('AC2: valid amounts parse exactly (no float error)', () => {
  const cases = [['0,01', 1], ['0.10', 10], ['0,20', 20], ['1', 100], ['1234,56', 123456],
    ['999999,99', 99999999], ['000012,30', 1230], ['19.99', 1999], ['0,29', 29], ['1,15', 115], ['4.35', 435]];
  for (const [text, cents] of cases) assert.deepEqual(parseAmount(text), { ok: true, cents }, text);
});

test('AC2: invalid amounts give the right code', () => {
  const cases = [
    ['', 'required'], ['   ', 'required'], [undefined, 'required'], [null, 'required'],
    ['0', 'notPositive'], ['0,00', 'notPositive'], ['0.0', 'notPositive'],
    ['-1', 'notNumber'], ['+5', 'notNumber'], ['abc', 'notNumber'], ['12a', 'notNumber'],
    ['1.234,56', 'notNumber'], ['1 234,56', 'notNumber'], ['12,', 'notNumber'], [',50', 'notNumber'], ['1e3', 'notNumber'],
    ['12,345', 'tooManyDecimals'], ['0.001', 'tooManyDecimals'],
    ['1000000', 'tooLarge'], ['1000000,00', 'tooLarge'],
  ];
  for (const [text, code] of cases) assert.deepEqual(parseAmount(text), { ok: false, code }, String(text));
});

test('AC2: parser never multiplies a float (source check)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/money.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /parseFloat|Number\.parseFloat/);
});

test('formatting: pt-PT euros via Intl', () => {
  assert.equal(normSpaces(formatEUR(1250)), '12,50 €');
  assert.equal(normSpaces(formatEUR(30)), '0,30 €');
  assert.equal(normSpaces(formatEUR(0)), '0,00 €');
  assert.equal(normSpaces(formatEUR(123456)), '1234,56 €');
  assert.equal(normSpaces(formatEUR(1234567)), '12 345,67 €');
  assert.equal(normSpaces(formatEUR(MAX_CENTS)), '999 999,99 €');
});

test('centsToInput prefills the amount field with a comma, no grouping or €', () => {
  assert.equal(centsToInput(1250), '12,50');
  assert.equal(centsToInput(5), '0,05');
  assert.equal(centsToInput(99999999), '999999,99');
  for (const c of [1, 99, 100, 1250, 123456, 99999999]) assert.deepEqual(parseAmount(centsToInput(c)), { ok: true, cents: c });
});

test('isValidCents: integers 1..99 999 999 only', () => {
  for (const v of [1, 1250, MAX_CENTS]) assert.equal(isValidCents(v), true);
  for (const v of [0, -1, 12.5, MAX_CENTS + 1, '1250', NaN]) assert.equal(isValidCents(v), false, String(v));
});
