// Persistence behind one versioned localStorage key (Issue #3, ADR-4).
// The Storage object is injected so tests can use an in-memory fake.
// Never throws; never overwrites unreadable data on load.

import { isValidCents } from './money.js';
import { isValidISODate } from './dates.js';
import { DESCRIPTION_MAX, RESERVED_CATEGORY_ID, SCHEMA_VERSION, initialState } from './model.js';

export const STORAGE_KEY = 'despesas-casa:v1';

const isStr = (v) => typeof v === 'string';

function toState(doc) {
  if (!doc || typeof doc !== 'object' || doc.schemaVersion !== SCHEMA_VERSION) return null;
  const { categories, expenses } = doc;
  if (!Array.isArray(categories) || !Array.isArray(expenses)) return null;
  const cats = [];
  for (const c of categories) {
    if (!c || !isStr(c.id) || !c.id || !isStr(c.name) || !c.name.trim()) return null;
    if (cats.some((x) => x.id === c.id)) return null;
    cats.push({ id: c.id, name: c.name });
  }
  if (!cats.some((c) => c.id === RESERVED_CATEGORY_ID)) return null;
  const ids = new Set(cats.map((c) => c.id));
  const exps = [];
  for (const e of expenses) {
    if (!e || !isStr(e.id) || !isValidCents(e.amountCents) || !isValidISODate(e.date)) return null;
    if (!ids.has(e.categoryId) || !isStr(e.description) || [...e.description].length > DESCRIPTION_MAX) return null;
    if (!Number.isFinite(e.createdAt)) return null;
    exps.push({
      id: e.id, amountCents: e.amountCents, date: e.date,
      categoryId: e.categoryId, description: e.description, createdAt: e.createdAt,
    });
  }
  return { schemaVersion: SCHEMA_VERSION, categories: cats, expenses: exps };
}

/**
 * @param {Storage|null|undefined} storage
 * @returns {{ status: 'empty'|'ok'|'corrupt'|'unavailable', state }}
 */
export function load(storage) {
  if (!storage) return { status: 'unavailable', state: initialState() };
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'unavailable', state: initialState() };
  }
  if (raw === null || raw === undefined) return { status: 'empty', state: initialState() };
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', state: initialState() };
  }
  const state = toState(doc);
  return state ? { status: 'ok', state } : { status: 'corrupt', state: initialState() };
}

function isQuotaError(e) {
  return Boolean(e) && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || e.code === 22 || e.code === 1014);
}

/** Write the whole document. Returns { ok } or { ok: false, code: 'quota'|'unavailable' }. */
export function save(storage, state) {
  if (!storage) return { ok: false, code: 'unavailable' };
  const doc = { schemaVersion: SCHEMA_VERSION, categories: state.categories, expenses: state.expenses };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(doc));
    return { ok: true };
  } catch (e) {
    return { ok: false, code: isQuotaError(e) ? 'quota' : 'unavailable' };
  }
}

/** "Eliminar todos os dados": remove the key, so the next load is first use. */
export function clear(storage) {
  if (!storage) return { ok: false, code: 'unavailable' };
  try {
    storage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, code: 'unavailable' };
  }
}
