// AC1–AC6, AC10: state transitions and validation (pure model).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, validateExpense, addExpense, updateExpense, deleteExpense,
  addCategory, renameCategory, deleteCategory, loadSample, resetAll, DEFAULT_CATEGORIES,
} from '../js/model.js';
import { listForMonth, monthlySummary } from '../js/summary.js';
import { formatEUR } from '../js/money.js';
import { formatDatePT } from '../js/dates.js';
import { normSpaces, seqIds } from './helpers.mjs';

const NOW = Date.UTC(2026, 9, 10, 12);
const opts = () => ({ idFn: seqIds('e'), now: NOW });
const deepFreeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
const add = (s, input, o = opts()) => { const r = addExpense(s, input, o); assert.equal(r.ok, true, JSON.stringify(r.errors)); return r.state; };

test('AC5: first use has the 8 pt-PT default categories', () => {
  const names = initialState().categories.map((c) => c.name);
  assert.deepEqual(names, ['Habitação', 'Alimentação', 'Transportes', 'Contas da casa', 'Saúde', 'Educação', 'Lazer', 'Outros']);
  assert.deepEqual(initialState().expenses, []);
  assert.equal(initialState().schemaVersion, 1);
});

test('AC1: add 12,50 / Alimentação stores 1250 cents and shows in list, format and totals', () => {
  const s0 = deepFreeze(initialState());
  const r = addExpense(s0, { amount: '12,50', date: '2026-10-10', categoryId: 'alimentacao', description: ' Supermercado (exemplo) ' }, opts());
  assert.equal(r.ok, true);
  assert.deepEqual(r.expense, { id: 'e-1', amountCents: 1250, date: '2026-10-10', categoryId: 'alimentacao', description: 'Supermercado (exemplo)', createdAt: NOW });
  const list = listForMonth(r.state, '2026-10');
  assert.equal(list.length, 1);
  assert.equal(normSpaces(formatEUR(list[0].amountCents)), '12,50 €');
  assert.equal(formatDatePT(list[0].date), '10/10/2026');
  const sum = monthlySummary(r.state, '2026-10');
  assert.equal(sum.totalCents, 1250);
  assert.equal(sum.count, 1);
  assert.equal(s0.expenses.length, 0, 'input state not mutated');
});

test('AC2: each invalid field gives a code and nothing is saved', () => {
  const s0 = deepFreeze(initialState());
  const r = addExpense(s0, { amount: '', date: '', categoryId: '', description: 'x'.repeat(101) }, opts());
  assert.deepEqual(r, { ok: false, errors: { amount: 'required', date: 'required', categoryId: 'required', description: 'tooLong' } });
  assert.equal(r.state, undefined);
  assert.deepEqual(addExpense(s0, { amount: '1', date: '2026-02-30', categoryId: 'nope' }, opts()).errors, { date: 'invalid', categoryId: 'unknown' });
  for (const [amount, code] of [['0', 'notPositive'], ['-1', 'notNumber'], ['abc', 'notNumber'], ['1,234', 'tooManyDecimals']]) {
    assert.deepEqual(addExpense(s0, { amount, date: '2026-10-10', categoryId: 'lazer' }, opts()).errors, { amount: code }, amount);
  }
  assert.equal(validateExpense({ amount: '12.50', date: '2026-10-10', categoryId: 'lazer', description: 'x'.repeat(100) }, s0).ok, true);
  assert.equal(validateExpense({ amount: '12.50', date: '2026-10-10', categoryId: 'lazer' }, s0).value.description, '');
});

test('AC3: edit keeps id/createdAt, no duplicate, moves between months', () => {
  let s = add(initialState(), { amount: '10', date: '2026-10-31', categoryId: 'lazer', description: 'a' });
  s = add(s, { amount: '5', date: '2026-10-02', categoryId: 'saude' }, { idFn: () => 'other', now: NOW + 1 });
  const frozen = deepFreeze(s);
  const r = updateExpense(frozen, 'e-1', { amount: '20,00', date: '2026-11-01', categoryId: 'transportes', description: 'b' });
  assert.equal(r.ok, true);
  assert.equal(r.state.expenses.length, 2, 'no duplicate');
  assert.deepEqual(r.expense, { id: 'e-1', amountCents: 2000, date: '2026-11-01', categoryId: 'transportes', description: 'b', createdAt: NOW });
  assert.deepEqual(listForMonth(r.state, '2026-10').map((e) => e.id), ['other']);
  assert.deepEqual(listForMonth(r.state, '2026-11').map((e) => e.id), ['e-1']);
  assert.equal(monthlySummary(r.state, '2026-10').totalCents, 500);
  assert.equal(monthlySummary(r.state, '2026-11').totalCents, 2000);
  assert.equal(frozen.expenses[0].amountCents, 1000, 'original untouched (cancel = no call)');
});

test('AC3: a failed edit changes nothing; unknown id is reported', () => {
  const s = deepFreeze(add(initialState(), { amount: '10', date: '2026-10-31', categoryId: 'lazer' }));
  assert.deepEqual(updateExpense(s, 'e-1', { amount: 'x', date: '2026-10-31', categoryId: 'lazer' }), { ok: false, errors: { amount: 'notNumber' } });
  assert.deepEqual(updateExpense(s, 'missing', { amount: '1', date: '2026-10-31', categoryId: 'lazer' }), { ok: false, errors: { id: 'notFound' } });
});

test('AC4: delete removes from list and totals; unknown id is a no-op', () => {
  const s = deepFreeze(add(initialState(), { amount: '10', date: '2026-10-31', categoryId: 'lazer' }));
  const r = deleteExpense(s, 'e-1');
  assert.equal(r.deleted, true);
  assert.deepEqual(listForMonth(r.state, '2026-10'), []);
  assert.equal(monthlySummary(r.state, '2026-10').totalCents, 0);
  const n = deleteExpense(s, 'nope');
  assert.equal(n.deleted, false);
  assert.deepEqual(n.state, s);
  assert.equal(s.expenses.length, 1, 'input not mutated');
});

test('AC5: every stored expense has exactly one known category', () => {
  const s = loadSample(initialState(), NOW).state;
  const ids = new Set(s.categories.map((c) => c.id));
  for (const e of s.expenses) assert.ok(typeof e.categoryId === 'string' && ids.has(e.categoryId));
});

test('AC6: add a category and use it right away', () => {
  const r = addCategory(initialState(), '  Animais  ', { idFn: () => 'cat-1' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.category, { id: 'cat-1', name: 'Animais' });
  assert.equal(r.state.categories.at(-1).id, 'cat-1');
  const s = add(r.state, { amount: '3', date: '2026-10-01', categoryId: 'cat-1' });
  assert.equal(monthlySummary(s, '2026-10').byCategory[0].name, 'Animais');
});

test('AC6: duplicates (case-insensitive), empty and > 30 chars are rejected', () => {
  const s = initialState();
  assert.deepEqual(addCategory(s, 'lazer', { idFn: () => 'x' }), { ok: false, code: 'duplicate', name: 'lazer' });
  assert.deepEqual(addCategory(s, 'SAÚDE', { idFn: () => 'x' }), { ok: false, code: 'duplicate', name: 'SAÚDE' });
  assert.deepEqual(addCategory(s, '   ', { idFn: () => 'x' }), { ok: false, code: 'empty' });
  assert.deepEqual(addCategory(s, 'x'.repeat(31), { idFn: () => 'x' }), { ok: false, code: 'tooLong' });
  assert.equal(addCategory(s, 'x'.repeat(30), { idFn: () => 'x' }).ok, true);
  assert.deepEqual(renameCategory(s, 'lazer', 'Saúde'), { ok: false, code: 'duplicate', name: 'Saúde' });
});

test('AC6: rename updates every expense in that category (stable id)', () => {
  let s = add(initialState(), { amount: '3', date: '2026-10-01', categoryId: 'lazer' });
  s = add(s, { amount: '4', date: '2026-09-01', categoryId: 'lazer' }, { idFn: () => 'z', now: NOW });
  const r = renameCategory(deepFreeze(s), 'lazer', 'Lazer e cultura');
  assert.equal(r.ok, true);
  assert.equal(r.state.categories.find((c) => c.id === 'lazer').name, 'Lazer e cultura');
  assert.equal(monthlySummary(r.state, '2026-10').byCategory[0].name, 'Lazer e cultura');
  assert.equal(monthlySummary(r.state, '2026-09').byCategory[0].name, 'Lazer e cultura');
  assert.equal(renameCategory(s, 'lazer', 'LAZER').ok, true, 'case change of itself is allowed');
  assert.equal(renameCategory(s, 'missing', 'X').code, 'notFound');
});

test('AC6: in-use and Outros cannot be deleted; unused can', () => {
  const s = add(initialState(), { amount: '3', date: '2026-10-01', categoryId: 'lazer' });
  assert.deepEqual(deleteCategory(s, 'lazer'), { ok: false, code: 'inUse' });
  assert.deepEqual(deleteCategory(s, 'outros'), { ok: false, code: 'protected' });
  const r = deleteCategory(s, 'educacao');
  assert.equal(r.ok, true);
  assert.equal(r.state.categories.some((c) => c.id === 'educacao'), false);
});

test('AC10: load sample replaces expenses, keeps categories, restores needed defaults', () => {
  let s = add(initialState(), { amount: '3', date: '2026-10-01', categoryId: 'lazer' });
  s = deleteCategory(s, 'educacao').state;
  s = renameCategory(s, 'saude', 'Saúde e bem-estar').state;
  const r = loadSample(deepFreeze(s), NOW);
  assert.equal(r.ok, true);
  assert.ok(r.state.expenses.every((e) => e.id.startsWith('exemplo-')), 'previous expenses replaced');
  assert.equal(r.state.categories.find((c) => c.id === 'saude').name, 'Saúde e bem-estar');
  assert.ok(r.state.categories.some((c) => c.id === 'educacao'), 'deleted default restored because the sample uses it');
  assert.ok(monthlySummary(r.state, '2026-10').totalCents > 0);
  assert.ok(monthlySummary(r.state, '2026-09').totalCents > 0);
});

test('AC10: reset returns the first-use state', () => {
  assert.deepEqual(resetAll(), initialState());
  assert.equal(DEFAULT_CATEGORIES.length, 8);
});
