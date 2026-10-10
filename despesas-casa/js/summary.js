// Monthly list and totals (Issue #3, AC7, AC8). Pure module: integer sums only.

import { monthKey } from './dates.js';

const byNewest = (a, b) =>
  (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (b.createdAt - a.createdAt);

/**
 * That month's expenses, newest date first (ties: newest createdAt first).
 * @param {{ expenses: Array }} state
 * @param {string} key "YYYY-MM"
 * @param {string} [categoryId] optional filter
 */
export function listForMonth(state, key, categoryId) {
  return state.expenses
    .filter((e) => monthKey(e.date) === key && (!categoryId || e.categoryId === categoryId))
    .sort(byNewest);
}

/**
 * Totals for one month: { totalCents, count, byCategory: [{ categoryId, name, totalCents, percent }] }.
 * percent is rounded to 1 decimal (display only); sorted by total desc, ties by name (pt-PT).
 */
export function monthlySummary(state, key) {
  const items = listForMonth(state, key);
  const totals = new Map();
  let totalCents = 0;
  for (const e of items) {
    totalCents += e.amountCents;
    totals.set(e.categoryId, (totals.get(e.categoryId) || 0) + e.amountCents);
  }
  const names = new Map(state.categories.map((c) => [c.id, c.name]));
  const byCategory = [...totals].map(([categoryId, cents]) => ({
    categoryId,
    name: names.get(categoryId) ?? categoryId,
    totalCents: cents,
    percent: Math.round((cents * 1000) / totalCents) / 10,
  }));
  byCategory.sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, 'pt-PT'));
  return { totalCents, count: items.length, byCategory };
}
