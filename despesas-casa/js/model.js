// State and validation (Issue #3). Pure: every function returns a new state and
// never mutates its input. Errors are codes; pt-PT text lives in messages.js.

import { parseAmount } from './money.js';
import { isValidISODate } from './dates.js';
import { buildSample } from './sample-data.js';

export const SCHEMA_VERSION = 1;
export const RESERVED_CATEGORY_ID = 'outros';
export const DESCRIPTION_MAX = 100;
export const CATEGORY_NAME_MAX = 30;

export const DEFAULT_CATEGORIES = Object.freeze([
  { id: 'habitacao', name: 'Habitação' },
  { id: 'alimentacao', name: 'Alimentação' },
  { id: 'transportes', name: 'Transportes' },
  { id: 'contas-da-casa', name: 'Contas da casa' },
  { id: 'saude', name: 'Saúde' },
  { id: 'educacao', name: 'Educação' },
  { id: 'lazer', name: 'Lazer' },
  { id: 'outros', name: 'Outros' },
].map((c) => Object.freeze(c)));

/** First-use state: default categories, no expenses. */
export function initialState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    expenses: [],
  };
}

const hasCategory = (state, id) => state.categories.some((c) => c.id === id);

/**
 * Validate form input. `input.amount` is the raw text typed by the user.
 * @returns {{ ok: true, value: { amountCents, date, categoryId, description } }
 *         | { ok: false, errors: { amount?, date?, categoryId?, description? } }}
 */
export function validateExpense(input, state) {
  const errors = {};
  const amount = parseAmount(input?.amount);
  if (!amount.ok) errors.amount = amount.code;

  const date = typeof input?.date === 'string' ? input.date.trim() : '';
  if (date === '') errors.date = 'required';
  else if (!isValidISODate(date)) errors.date = 'invalid';

  const categoryId = typeof input?.categoryId === 'string' ? input.categoryId : '';
  if (categoryId === '') errors.categoryId = 'required';
  else if (!hasCategory(state, categoryId)) errors.categoryId = 'unknown';

  const description = typeof input?.description === 'string' ? input.description.trim() : '';
  if ([...description].length > DESCRIPTION_MAX) errors.description = 'tooLong';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { amountCents: amount.cents, date, categoryId, description } };
}

/** Add an expense. Returns { ok: true, state, expense } or { ok: false, errors }. */
export function addExpense(state, input, { idFn, now }) {
  const v = validateExpense(input, state);
  if (!v.ok) return v;
  const expense = { id: idFn(), ...v.value, createdAt: Number(now) };
  return { ok: true, state: { ...state, expenses: [...state.expenses, expense] }, expense };
}

/** Update an expense in place, keeping id and createdAt (no duplicate). */
export function updateExpense(state, id, input) {
  const current = state.expenses.find((e) => e.id === id);
  if (!current) return { ok: false, errors: { id: 'notFound' } };
  const v = validateExpense(input, state);
  if (!v.ok) return v;
  const expense = { ...current, ...v.value, id: current.id, createdAt: current.createdAt };
  return {
    ok: true,
    state: { ...state, expenses: state.expenses.map((e) => (e.id === id ? expense : e)) },
    expense,
  };
}

/** Delete an expense. An unknown id is a no-op (deleted: false). */
export function deleteExpense(state, id) {
  const expenses = state.expenses.filter((e) => e.id !== id);
  return { ok: true, state: { ...state, expenses }, deleted: expenses.length !== state.expenses.length };
}

const normName = (s) => s.toLocaleLowerCase('pt-PT');

function checkCategoryName(state, name, exceptId) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed === '') return { ok: false, code: 'empty' };
  if ([...trimmed].length > CATEGORY_NAME_MAX) return { ok: false, code: 'tooLong' };
  const n = normName(trimmed);
  if (state.categories.some((c) => c.id !== exceptId && normName(c.name) === n)) {
    return { ok: false, code: 'duplicate', name: trimmed };
  }
  return { ok: true, name: trimmed };
}

/** Add a category (name trimmed, 1–30 chars, unique case-insensitively). */
export function addCategory(state, name, { idFn }) {
  const c = checkCategoryName(state, name);
  if (!c.ok) return c;
  const category = { id: idFn(), name: c.name };
  return { ok: true, state: { ...state, categories: [...state.categories, category] }, category };
}

/** Rename a category; expenses reference the stable id, so all of them follow. */
export function renameCategory(state, id, name) {
  if (!hasCategory(state, id)) return { ok: false, code: 'notFound' };
  const c = checkCategoryName(state, name, id);
  if (!c.ok) return c;
  return {
    ok: true,
    state: { ...state, categories: state.categories.map((x) => (x.id === id ? { ...x, name: c.name } : x)) },
  };
}

/** Delete an unused category. `outros` -> protected; used by expenses -> inUse. */
export function deleteCategory(state, id) {
  if (id === RESERVED_CATEGORY_ID) return { ok: false, code: 'protected' };
  if (!hasCategory(state, id)) return { ok: false, code: 'notFound' };
  if (state.expenses.some((e) => e.categoryId === id)) return { ok: false, code: 'inUse' };
  return { ok: true, state: { ...state, categories: state.categories.filter((c) => c.id !== id) } };
}

/**
 * Replace all expenses with the synthetic sample set. Categories are kept; any
 * default category the sample needs that the user deleted is restored at the end.
 */
export function loadSample(state, now) {
  const expenses = buildSample(now);
  const categories = [...state.categories];
  for (const id of new Set(expenses.map((e) => e.categoryId))) {
    if (!categories.some((c) => c.id === id)) {
      categories.push({ ...DEFAULT_CATEGORIES.find((c) => c.id === id) });
    }
  }
  return { ok: true, state: { ...state, categories, expenses } };
}

/** Delete all data: back to the first-use state. */
export function resetAll() {
  return initialState();
}
