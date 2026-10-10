// AC7 (dashboard totals) and AC8 (list order, filter).
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, addExpense } from '../js/model.js';
import { listForMonth, monthlySummary } from '../js/summary.js';
import { formatEUR } from '../js/money.js';
import { normSpaces } from './helpers.mjs';

function build(rows) {
  let s = initialState();
  rows.forEach(([amount, date, categoryId, createdAt], i) => {
    const r = addExpense(s, { amount, date, categoryId }, { idFn: () => `x${i + 1}`, now: createdAt ?? i });
    assert.equal(r.ok, true);
    s = r.state;
  });
  return s;
}

test('AC7: 0,10 € + 0,20 € = exactly 0,30 €', () => {
  const s = build([['0,10', '2026-10-01', 'lazer'], ['0,20', '2026-10-02', 'lazer']]);
  const sum = monthlySummary(s, '2026-10');
  assert.equal(sum.totalCents, 30);
  assert.equal(normSpaces(formatEUR(sum.totalCents)), '0,30 €');
});

test('AC7: totals, count and per-category totals/percent sorted desc', () => {
  const s = build([
    ['650', '2026-10-01', 'habitacao'], ['300', '2026-10-05', 'alimentacao'], ['12,40', '2026-10-06', 'alimentacao'],
    ['50', '2026-10-07', 'lazer'], ['999', '2026-09-30', 'lazer'], ['1', '2026-11-01', 'saude'],
  ]);
  const sum = monthlySummary(s, '2026-10');
  assert.equal(sum.totalCents, 101240);
  assert.equal(sum.count, 4);
  assert.deepEqual(sum.byCategory.map((c) => [c.categoryId, c.name, c.totalCents, c.percent]), [
    ['habitacao', 'Habitação', 65000, 64.2],
    ['alimentacao', 'Alimentação', 31240, 30.9],
    ['lazer', 'Lazer', 5000, 4.9],
  ]);
});

test('AC7: ties sort by name (pt-PT)', () => {
  const s = build([['5', '2026-10-01', 'transportes'], ['5', '2026-10-02', 'alimentacao'], ['5', '2026-10-03', 'educacao']]);
  assert.deepEqual(monthlySummary(s, '2026-10').byCategory.map((c) => c.name), ['Alimentação', 'Educação', 'Transportes']);
});

test('AC7: empty month gives zeros and no categories', () => {
  const s = build([['5', '2026-10-01', 'lazer']]);
  assert.deepEqual(monthlySummary(s, '2026-12'), { totalCents: 0, count: 0, byCategory: [] });
  assert.equal(normSpaces(formatEUR(0)), '0,00 €');
});

test('AC7: 31/10/2026 counts in October and 01/11/2026 in November, in this TZ', () => {
  const s = build([['10', '2026-10-31', 'lazer'], ['20', '2026-11-01', 'lazer'], ['30', '2026-12-31', 'lazer'], ['40', '2027-01-01', 'lazer']]);
  assert.equal(monthlySummary(s, '2026-10').totalCents, 1000);
  assert.equal(monthlySummary(s, '2026-11').totalCents, 2000);
  assert.equal(monthlySummary(s, '2026-12').totalCents, 3000);
  assert.equal(monthlySummary(s, '2027-01').totalCents, 4000);
  assert.ok(process.env.TZ === undefined || typeof process.env.TZ === 'string');
});

test('AC7: large sums stay exact integers', () => {
  const rows = Array.from({ length: 100 }, (_, i) => ['999999,99', `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, 'outros']);
  const sum = monthlySummary(build(rows), '2026-10');
  assert.equal(sum.totalCents, 9999999900);
  assert.ok(Number.isSafeInteger(sum.totalCents));
});

test('AC8: newest date first, ties by createdAt (newest first)', () => {
  const s = build([
    ['1', '2026-10-05', 'lazer', 100], ['2', '2026-10-20', 'lazer', 50], ['3', '2026-10-05', 'lazer', 200], ['4', '2026-10-01', 'lazer', 300],
  ]);
  assert.deepEqual(listForMonth(s, '2026-10').map((e) => e.amountCents), [200, 300, 100, 400]);
});

test('AC8 (Should): category filter applies to the list only', () => {
  const s = build([['1', '2026-10-05', 'lazer'], ['2', '2026-10-06', 'saude'], ['3', '2026-11-01', 'lazer']]);
  assert.deepEqual(listForMonth(s, '2026-10', 'lazer').map((e) => e.amountCents), [100]);
  assert.deepEqual(listForMonth(s, '2026-10', 'educacao'), []);
  assert.equal(listForMonth(s, '2026-10', '').length, 2);
  assert.equal(monthlySummary(s, '2026-10').totalCents, 300);
});
