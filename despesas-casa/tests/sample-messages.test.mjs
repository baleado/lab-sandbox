// AC10/AC14 (synthetic sample data) and pt-PT messages (AC2, AC6, AC9, design §4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSample } from '../js/sample-data.js';
import { initialState, loadSample, validateExpense } from '../js/model.js';
import { monthlySummary } from '../js/summary.js';
import { todayISO, addMonths, isValidISODate } from '../js/dates.js';
import { MESSAGES, format, plural, formatPercent } from '../js/messages.js';
import { read } from './helpers.mjs';

const NOWS = [Date.UTC(2026, 9, 10, 12), new Date(2026, 9, 1, 0, 30).getTime(), new Date(2026, 2, 31, 23, 0).getTime(), new Date(2027, 0, 1, 9).getTime()];
const SYNTHETIC = /^[A-Za-zÀ-ÿ ]+ \(exemplo\)$/;

test('AC10: sample covers ≥2 months, ≥5 categories, non-zero current month', () => {
  for (const now of NOWS) {
    const exp = buildSample(now);
    const cur = todayISO(now).slice(0, 7);
    const months = new Set(exp.map((e) => e.date.slice(0, 7)));
    assert.deepEqual([...months].sort(), [addMonths(cur, -1), cur]);
    assert.ok(new Set(exp.map((e) => e.categoryId)).size >= 5);
    assert.ok(exp.length >= 15 && exp.length <= 20);
    const s = loadSample(initialState(), now).state;
    assert.ok(monthlySummary(s, cur).totalCents > 0);
    assert.ok(monthlySummary(s, addMonths(cur, -1)).totalCents > 0);
    for (const e of exp) {
      assert.ok(isValidISODate(e.date), e.date);
      assert.ok(e.date <= todayISO(now), 'no future-dated sample');
      assert.equal(validateExpense({ amount: String(e.amountCents / 100), date: e.date, categoryId: e.categoryId, description: e.description }, s).ok, true);
    }
  }
});

test('AC10: sample is deterministic for a given now', () => {
  assert.deepEqual(buildSample(NOWS[0]), buildSample(NOWS[0]));
});

test('AC14: sample descriptions are invented (allow-list pattern, no names)', () => {
  for (const e of buildSample(NOWS[0])) assert.match(e.description, SYNTHETIC);
});

// Every key from the Azulejo (Designer) handoff §4 must exist.
const DESIGN_KEYS = [
  'app.title', 'app.tag', 'skip', 'notice.text', 'month.prev', 'month.next', 'month.current', 'action.add',
  'summary.h2', 'summary.total', 'summary.byCategory', 'summary.col.category', 'summary.col.total', 'summary.col.percent',
  'list.h2', 'list.filter.label', 'list.filter.all', 'list.noDescription', 'row.edit', 'row.delete',
  'form.addTitle', 'form.editTitle', 'form.required', 'form.amount', 'form.amountHint', 'form.date', 'form.category',
  'form.categoryPlaceholder', 'form.description', 'form.counter', 'form.save', 'form.cancel', 'settings.h2',
  'cat.h3', 'cat.rename', 'cat.delete', 'cat.renameLabel', 'cat.reserved', 'cat.newLabel', 'cat.add',
  'data.h3', 'data.sample', 'data.reset', 'footer', 'loading', 'noscript',
  'empty.month', 'empty.list', 'empty.filter', 'empty.filterReset', 'empty.firstUse',
  'amount.required', 'amount.notNumber', 'amount.tooManyDecimals', 'amount.notPositive', 'amount.tooLarge',
  'date.required', 'date.invalid', 'categoryId.required', 'categoryId.unknown', 'description.tooLong',
  'form.errorSummary.one', 'form.errorSummary.many',
  'category.empty', 'category.tooLong', 'category.duplicate', 'category.inUse', 'category.protected',
  'storage.unavailable', 'storage.quota', 'storage.corrupt',
];

test('design §4: every microcopy key exists and is non-empty', () => {
  for (const k of DESIGN_KEYS) assert.ok(typeof MESSAGES[k] === 'string' && MESSAGES[k].length > 0, k);
});

test('AC2/AC6: every validation code the model can return has pt-PT text', () => {
  const codes = { amount: ['required', 'notNumber', 'tooManyDecimals', 'notPositive', 'tooLarge'], date: ['required', 'invalid'],
    categoryId: ['required', 'unknown'], description: ['tooLong'], category: ['empty', 'tooLong', 'duplicate', 'inUse', 'protected'] };
  for (const [field, list] of Object.entries(codes)) for (const c of list) assert.ok(MESSAGES[`${field}.${c}`], `${field}.${c}`);
});

test('key copy matches the design exactly', () => {
  assert.equal(format('amount.required'), 'Indique o valor da despesa.');
  assert.equal(format('categoryId.required'), 'Escolha uma categoria.');
  assert.equal(format('category.duplicate', { name: 'Lazer' }), 'Já existe uma categoria com o nome «Lazer».');
  assert.equal(format('empty.month', { month: 'outubro de 2026' }), 'Ainda não há despesas em outubro de 2026.');
  assert.equal(plural('summary.count', 1), '1 despesa');
  assert.equal(plural('summary.count', 0), '0 despesas');
  assert.equal(plural('summary.count', 12), '12 despesas');
  assert.equal(formatPercent(52.6), '52,6%');
  assert.equal(format('confirm.reset.ok'), 'Eliminar tudo');
  assert.throws(() => format('no.such.key'));
});

test('AC4/AC6/AC10: every delete action is labelled "Eliminar"', () => {
  for (const k of ['row.delete', 'cat.delete', 'confirm.expense.ok', 'confirm.category.ok']) assert.equal(MESSAGES[k], 'Eliminar');
  assert.match(MESSAGES['data.reset'], /^Eliminar /);
  assert.doesNotMatch(Object.values(MESSAGES).join('\n'), /\b[Aa]pagar\b|\b[Aa]pagad[ao]\b|\b[Rr]emover\b/);
});

test('AC9: the data notice is in messages.js and in the static HTML', () => {
  const html = read('index.html');
  assert.ok(html.includes(MESSAGES['notice.text']));
  assert.match(MESSAGES['notice.text'], /só neste navegador/);
  assert.match(MESSAGES['notice.text'], /protótipo/);
});
