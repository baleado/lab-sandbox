// Synthetic sample data (Issue #3, AC10, AC14). Every description is invented and
// ends in "(exemplo)"; there are no names of people, shops, places or accounts.
// Deterministic for a given `now`. Pure module.

import { addMonths, daysInMonth, monthKey, todayISO } from './dates.js';

// [day of month, cents, categoryId, description]
const PREVIOUS_MONTH = [
  [1, 65000, 'habitacao', 'Renda (exemplo)'],
  [3, 8745, 'alimentacao', 'Supermercado (exemplo)'],
  [5, 4200, 'contas-da-casa', 'Eletricidade (exemplo)'],
  [8, 3000, 'transportes', 'Passe mensal (exemplo)'],
  [11, 1890, 'saude', 'Farmácia (exemplo)'],
  [14, 6230, 'alimentacao', 'Mercado (exemplo)'],
  [18, 2500, 'lazer', 'Cinema (exemplo)'],
  [21, 2675, 'contas-da-casa', 'Água (exemplo)'],
  [24, 4500, 'educacao', 'Material escolar (exemplo)'],
  [27, 1200, 'outros', 'Presente (exemplo)'],
];

const CURRENT_MONTH = [
  [1, 65000, 'habitacao', 'Renda (exemplo)'],
  [2, 9410, 'alimentacao', 'Supermercado (exemplo)'],
  [4, 3999, 'contas-da-casa', 'Internet (exemplo)'],
  [6, 3000, 'transportes', 'Passe mensal (exemplo)'],
  [9, 1250, 'alimentacao', 'Padaria (exemplo)'],
  [12, 3550, 'saude', 'Consulta (exemplo)'],
  [16, 1800, 'lazer', 'Livro (exemplo)'],
  [20, 2045, 'transportes', 'Combustível (exemplo)'],
];

const pad = (n) => String(n).padStart(2, '0');

function build(rows, key, maxDay, prefix, baseMs) {
  return rows.map(([day, amountCents, categoryId, description], i) => ({
    id: `exemplo-${prefix}-${i + 1}`,
    amountCents,
    date: `${key}-${pad(Math.min(day, maxDay))}`,
    categoryId,
    description,
    createdAt: baseMs + i,
  }));
}

/** About 18 invented expenses across the current and previous month (relative to `now`). */
export function buildSample(now) {
  const today = todayISO(now);
  const current = monthKey(today);
  const previous = addMonths(current, -1);
  const todayDay = Number(today.slice(8, 10));
  const base = Number(now instanceof Date ? now.getTime() : now);
  return [
    ...build(PREVIOUS_MONTH, previous, daysInMonth(previous), 'a', base),
    // Current month: never later than today.
    ...build(CURRENT_MONTH, current, todayDay, 'b', base + PREVIOUS_MONTH.length),
  ];
}
