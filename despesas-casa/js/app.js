// DOM shell (Issue #3). The only module that touches the DOM. User text reaches
// the page through textContent only (ADR-8): no HTML-string sinks.

import { formatEUR, centsToInput } from './money.js';
import { addMonths, formatDatePT, formatMonthLabel, monthKey, todayISO } from './dates.js';
import {
  addCategory, addExpense, deleteCategory, deleteExpense, loadSample, renameCategory,
  resetAll, updateExpense, RESERVED_CATEGORY_ID,
} from './model.js';
import { listForMonth, monthlySummary } from './summary.js';
import { STORAGE_KEY, clear, load, save } from './storage.js';
import { format, formatPercent, plural } from './messages.js';

const $ = (id) => document.getElementById(id);

const DEFAULT_COLOUR_INDEX = {
  habitacao: 0, alimentacao: 1, transportes: 2, 'contas-da-casa': 3,
  saude: 4, educacao: 5, lazer: 6, outros: 7,
};

/** Stable colour index: fixed for default ids, char-code sum mod 8 for new ones (design §3.2). */
function colourIndex(id) {
  if (id in DEFAULT_COLOUR_INDEX) return DEFAULT_COLOUR_INDEX[id];
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return sum % 8;
}

function newId() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

function swatch(id) {
  return el('span', { class: `swatch c-${colourIndex(id)}`, 'aria-hidden': 'true' });
}

// ---------- App state ----------
let storage = null;
let mode = 'ok'; // 'ok' | 'unavailable' | 'corrupt'
let state = resetAll();
let viewMonth = todayISO(Date.now()).slice(0, 7);
let filter = '';
let renamingId = null;
let editingId = null;
let formAttempted = false;
let dialogInvoker = null;
let dialogFocusAfter = null;
let confirmAction = null;

const categoryName = (id) => state.categories.find((c) => c.id === id)?.name ?? id;
const currentMonth = () => todayISO(Date.now()).slice(0, 7);

// ---------- Status line (polite live region) ----------
let statusTimer = null;
function announce(text) {
  const box = $('status');
  box.textContent = '';
  clearTimeout(statusTimer);
  // Re-insert after a tick so identical consecutive messages are still announced.
  statusTimer = setTimeout(() => {
    box.append(el('span', { class: 'status-glyph', 'aria-hidden': 'true', text: '✓ ' }), text);
  }, 50);
}

// ---------- Persistence ----------
function commit(next) {
  state = next;
  if (mode === 'ok') {
    const r = save(storage, state);
    if (r.ok) hideQuota();
    else if (r.code === 'quota') showQuota();
    else { mode = 'unavailable'; showUnavailable(); }
  }
}

function showUnavailable() {
  $('banner-unavailable-text').textContent = format('storage.unavailable');
  $('banner-unavailable').hidden = false;
}

function showQuota() {
  const slot = $('banner-quota-slot');
  if (slot.firstChild) return;
  slot.append(el('div', { class: 'banner banner-error', role: 'alert' },
    el('span', { class: 'banner-glyph', 'aria-hidden': 'true', text: '⚠' }),
    el('p', { text: format('storage.quota') })));
}

function hideQuota() {
  $('banner-quota-slot').replaceChildren();
}

// ---------- Rendering ----------
function render() {
  $('loading').hidden = true;
  if (mode === 'corrupt') {
    $('app').hidden = true;
    $('corrupt-text').textContent = format('storage.corrupt');
    $('corrupt-panel').hidden = false;
    return;
  }
  $('corrupt-panel').hidden = true;
  $('app').hidden = false;
  if (filter && !state.categories.some((c) => c.id === filter)) filter = '';
  const label = formatMonthLabel(viewMonth);
  $('mes-atual').textContent = label;
  $('btn-current').hidden = viewMonth === currentMonth();
  renderSummary(label);
  renderList(label);
  renderCategories();
  renderCategorySelect($('filtro'), format('list.filter.all'), filter);
}

function renderSummary(label) {
  const s = monthlySummary(state, viewMonth);
  $('sum-total').textContent = formatEUR(s.totalCents);
  $('sum-count').textContent = plural('summary.count', s.count);
  const empty = s.count === 0;
  $('sum-empty').hidden = !empty;
  $('sum-table').hidden = empty;
  if (empty) {
    $('sum-empty-text').textContent = format('empty.month', { month: label });
    const noData = state.expenses.length === 0;
    $('sum-first-use').hidden = !noData;
    $('btn-empty-sample').hidden = !noData;
  }
  const rows = s.byCategory.map((c) => {
    const fill = el('span', { class: `bar-fill c-${colourIndex(c.categoryId)}` });
    fill.style.width = `${c.percent}%`; // CSSOM, allowed by the CSP
    return el('tr', {},
      el('td', {},
        el('span', { class: 'cat-name' }, swatch(c.categoryId), el('span', { text: c.name })),
        el('span', { class: 'bar', 'aria-hidden': 'true' }, fill)),
      el('td', { class: 'num', text: formatEUR(c.totalCents) }),
      el('td', { class: 'num', text: formatPercent(c.percent) }));
  });
  $('sum-tbody').replaceChildren(...rows);
}

function rowHiddenText(e) {
  return format('row.hidden', {
    description: e.description || format('list.noDescriptionLower'),
    amount: formatEUR(e.amountCents),
    date: formatDatePT(e.date),
  });
}

function renderList(label) {
  const items = listForMonth(state, viewMonth, filter || undefined);
  const lis = items.map((e) => {
    const hidden = rowHiddenText(e);
    return el('li', { class: 'expense-row', 'data-id': e.id },
      el('span', { class: 'row-date', text: formatDatePT(e.date) }),
      el('span', { class: 'row-amount', text: formatEUR(e.amountCents) }),
      el('span', { class: e.description ? 'row-desc' : 'row-desc is-empty', text: e.description || format('list.noDescription') }),
      el('span', { class: 'row-cat' }, swatch(e.categoryId), el('span', { text: categoryName(e.categoryId) })),
      el('span', { class: 'row-actions' },
        el('button', { type: 'button', class: 'btn btn-secondary', 'data-action': 'edit', 'data-id': e.id },
          format('row.edit'), el('span', { class: 'visually-hidden', text: hidden })),
        el('button', { type: 'button', class: 'btn btn-danger-outline', 'data-action': 'delete', 'data-id': e.id },
          format('row.delete'), el('span', { class: 'visually-hidden', text: hidden }))));
  });
  $('lista').replaceChildren(...lis);
  $('lista').hidden = items.length === 0;
  $('list-empty').hidden = items.length !== 0;
  if (items.length === 0) {
    $('list-empty-text').textContent = filter
      ? format('empty.filter', { category: categoryName(filter), month: label })
      : format('empty.list');
    $('btn-filter-reset').hidden = !filter;
  }
}

function renderCategorySelect(select, firstLabel, selected) {
  const opts = [el('option', { value: '', text: firstLabel })];
  for (const c of state.categories) opts.push(el('option', { value: c.id, text: c.name }));
  select.replaceChildren(...opts);
  select.value = state.categories.some((c) => c.id === selected) ? selected : '';
}

function renderCategories() {
  const items = state.categories.map((c) => {
    const li = el('li', { class: 'cat-item', 'data-id': c.id });
    if (renamingId === c.id) {
      const inputId = `cat-rename-${c.id}`;
      const errId = `${inputId}-error`;
      li.append(el('form', { class: 'cat-rename', novalidate: true, 'data-id': c.id },
        el('div', { class: 'field' },
          el('label', { for: inputId, text: format('cat.renameLabel', { name: c.name }) }),
          el('div', { class: 'inline-controls' },
            el('input', { type: 'text', id: inputId, autocomplete: 'off', value: c.name }),
            el('button', { type: 'submit', class: 'btn btn-primary', text: format('form.save') }),
            el('button', { type: 'button', class: 'btn btn-secondary', 'data-action': 'cat-rename-cancel', 'data-id': c.id, text: format('form.cancel') })),
          el('p', { class: 'field-error', id: errId, role: 'alert', hidden: true }))));
    } else {
      const buttons = el('span', { class: 'cat-buttons' },
        el('button', { type: 'button', class: 'btn btn-secondary', 'data-action': 'cat-rename', 'data-id': c.id },
          format('cat.rename'), el('span', { class: 'visually-hidden', text: ` «${c.name}»` })));
      if (c.id !== RESERVED_CATEGORY_ID) {
        buttons.append(el('button', { type: 'button', class: 'btn btn-danger-outline', 'data-action': 'cat-delete', 'data-id': c.id },
          format('cat.delete'), el('span', { class: 'visually-hidden', text: ` «${c.name}»` })));
      }
      li.append(el('div', { class: 'cat-line' },
        el('span', { class: 'cat-label' }, swatch(c.id), el('span', { text: c.name })),
        c.id === RESERVED_CATEGORY_ID ? el('span', { class: 'cat-reserved', text: format('cat.reserved') }) : null,
        buttons));
    }
    return li;
  });
  $('cat-list').replaceChildren(...items);
}

function focusRowButton(id, action = 'edit') {
  const btn = $('lista').querySelector(`button[data-action="${action}"][data-id="${CSS.escape(id)}"]`);
  if (btn) { btn.focus(); return true; }
  return false;
}

function focusFirst(...candidates) {
  for (const c of candidates) {
    const node = typeof c === 'string' ? $(c) : c;
    if (node && node.isConnected && !node.hidden && !node.closest('[hidden]')) { node.focus(); return; }
  }
}

// ---------- Field errors ----------
const FIELDS = {
  amount: { input: 'f-valor', error: 'f-valor-error', hint: 'f-valor-hint' },
  date: { input: 'f-data', error: 'f-data-error' },
  categoryId: { input: 'f-categoria', error: 'f-categoria-error' },
  description: { input: 'f-descricao', error: 'f-descricao-error', hint: 'f-descricao-count' },
};

function setFieldError(inputEl, errorEl, hintId, text) {
  if (text) {
    errorEl.replaceChildren(el('span', { 'aria-hidden': 'true', text: '⚠ ' }), text);
    errorEl.hidden = false;
    inputEl.setAttribute('aria-invalid', 'true');
    inputEl.setAttribute('aria-describedby', [hintId, errorEl.id].filter(Boolean).join(' '));
  } else {
    errorEl.replaceChildren();
    errorEl.hidden = true;
    inputEl.removeAttribute('aria-invalid');
    if (hintId) inputEl.setAttribute('aria-describedby', hintId);
    else inputEl.removeAttribute('aria-describedby');
  }
}

function readForm() {
  return {
    amount: $('f-valor').value,
    date: $('f-data').value,
    categoryId: $('f-categoria').value,
    description: $('f-descricao').value,
  };
}

function showFormErrors(errors) {
  for (const [field, f] of Object.entries(FIELDS)) {
    const code = errors[field];
    setFieldError($(f.input), $(f.error), f.hint, code ? format(`${field}.${code}`) : '');
  }
}

function updateCounter() {
  $('f-descricao-count').textContent = format('form.counter', { n: [...$('f-descricao').value].length });
}

// ---------- Expense dialog ----------
function openExpenseDialog(expense, invoker) {
  editingId = expense ? expense.id : null;
  formAttempted = false;
  dialogInvoker = invoker;
  $('dlg-despesa-title').textContent = format(expense ? 'form.editTitle' : 'form.addTitle');
  renderCategorySelect($('f-categoria'), format('form.categoryPlaceholder'), expense ? expense.categoryId : '');
  $('f-valor').value = expense ? centsToInput(expense.amountCents) : '';
  $('f-data').value = expense ? expense.date : todayISO(Date.now());
  $('f-descricao').value = expense ? expense.description : '';
  $('form-summary').textContent = '';
  showFormErrors({});
  updateCounter();
  dialogFocusAfter = null;
  $('dlg-despesa').showModal();
  $('f-valor').focus();
}

function submitExpense(ev) {
  ev.preventDefault();
  formAttempted = true;
  const input = readForm();
  const before = editingId ? state.expenses.find((x) => x.id === editingId) : null;
  const r = editingId ? updateExpense(state, editingId, input) : addExpense(state, input, { idFn: newId, now: Date.now() });
  if (!r.ok) {
    const errors = r.errors;
    if (errors.id) { $('dlg-despesa').close(); render(); return; } // expense vanished (other tab)
    showFormErrors(errors);
    const n = Object.keys(errors).length;
    $('form-summary').textContent = n === 1 ? format('form.errorSummary.one') : format('form.errorSummary.many', { n });
    const first = Object.keys(FIELDS).find((f) => errors[f]);
    $(FIELDS[first].input).focus();
    return;
  }
  commit(r.state);
  const target = monthKey(r.expense.date);
  const moved = target !== viewMonth;
  viewMonth = target;
  const label = formatMonthLabel(target);
  if (before) {
    announce(moved && monthKey(before.date) !== target
      ? format('status.editedMonth', { month: label }) : format('status.edited'));
    dialogFocusAfter = () => focusRowButton(r.expense.id) || focusFirst('h-despesas');
  } else {
    announce(moved ? format('status.addedMonth', { month: label }) : format('status.added'));
    const inv = dialogInvoker;
    dialogFocusAfter = () => focusFirst(inv, 'btn-add');
  }
  render();
  $('dlg-despesa').close();
}

function revalidateField(field) {
  if (!formAttempted) return;
  const v = updateExpenseDryRun();
  const f = FIELDS[field];
  const code = v.ok ? null : v.errors[field];
  setFieldError($(f.input), $(f.error), f.hint, code ? format(`${field}.${code}`) : '');
  if (v.ok) $('form-summary').textContent = '';
}

function updateExpenseDryRun() {
  // Validation only; nothing is saved.
  return addExpense(state, readForm(), { idFn: () => 'dry-run', now: 0 });
}

// ---------- Confirmation dialog ----------
function openConfirm({ title, body, okText, okClass, onConfirm, invoker, focusAfter }) {
  $('dlg-confirmar-title').textContent = title;
  $('dlg-confirmar-body').replaceChildren(...body.map((t) => el('p', { text: t })));
  const ok = $('c-ok');
  ok.textContent = okText;
  ok.className = `btn ${okClass}`;
  confirmAction = onConfirm;
  dialogInvoker = invoker;
  dialogFocusAfter = focusAfter || null;
  $('dlg-confirmar').showModal();
  $('c-cancel').focus();
}

function onDialogClose() {
  confirmAction = null;
  const after = dialogFocusAfter;
  const inv = dialogInvoker;
  dialogFocusAfter = null;
  dialogInvoker = null;
  // Run after the browser's own focus restoration.
  setTimeout(() => {
    if (after) after();
    else if (inv && inv.isConnected) inv.focus();
  }, 0);
}

// ---------- Actions ----------
function confirmDeleteExpense(id, invoker) {
  const e = state.expenses.find((x) => x.id === id);
  if (!e) return;
  const body = [`${formatEUR(e.amountCents)} · ${categoryName(e.categoryId)} · ${formatDatePT(e.date)}`];
  if (e.description) body.push(e.description);
  body.push(format('confirm.irreversible'));
  openConfirm({
    title: format('confirm.expense.title'), body, okText: format('confirm.expense.ok'), okClass: 'btn-danger', invoker,
    onConfirm: () => {
      const list = listForMonth(state, viewMonth, filter || undefined);
      const idx = list.findIndex((x) => x.id === id);
      const next = list[idx + 1] || list[idx - 1];
      commit(deleteExpense(state, id).state);
      announce(format('status.deleted'));
      render();
      dialogFocusAfter = () => (next && focusRowButton(next.id)) || focusFirst('h-despesas');
    },
  });
}

function changeMonth(key) {
  viewMonth = key;
  render();
  announce(format('status.month', { month: formatMonthLabel(key) }));
}

function setFilter(value) {
  filter = value;
  render();
  if (!filter) announce(format('status.filterAll'));
  else {
    const n = listForMonth(state, viewMonth, filter).length;
    announce(plural('status.filter', n, { category: categoryName(filter) }));
  }
}

function catError(code, name) {
  return format(`category.${code}`, { name });
}

function onCategoryListClick(ev) {
  const btn = ev.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const c = state.categories.find((x) => x.id === id);
  if (action === 'cat-rename') {
    renamingId = id;
    renderCategories();
    const input = $(`cat-rename-${id}`);
    input.focus();
    input.select();
  } else if (action === 'cat-rename-cancel') {
    endRename(id);
  } else if (action === 'cat-delete' && c) {
    const li = btn.closest('li');
    li.querySelector('.cat-inline-error')?.remove();
    const r = deleteCategory(state, id);
    if (!r.ok) {
      if (r.code === 'inUse' || r.code === 'protected') {
        li.append(el('p', { class: 'field-error cat-inline-error', role: 'alert' },
          el('span', { 'aria-hidden': 'true', text: '⚠ ' }), catError(r.code, c.name)));
      }
      return;
    }
    openConfirm({
      title: format('confirm.category.title', { name: c.name }),
      body: [format('confirm.irreversible')],
      okText: format('confirm.category.ok'), okClass: 'btn-danger', invoker: btn,
      onConfirm: () => {
        const again = deleteCategory(state, id);
        if (!again.ok) return;
        commit(again.state);
        announce(format('status.catDeleted', { name: c.name }));
        render();
        dialogFocusAfter = () => focusFirst('h-categorias');
      },
    });
  }
}

function endRename(id) {
  renamingId = null;
  renderCategories();
  const btn = $('cat-list').querySelector(`button[data-action="cat-rename"][data-id="${CSS.escape(id)}"]`);
  if (btn) btn.focus();
}

function onRenameSubmit(ev) {
  const form = ev.target.closest('form.cat-rename');
  if (!form) return;
  ev.preventDefault();
  const id = form.dataset.id;
  const input = $(`cat-rename-${id}`);
  const r = renameCategory(state, id, input.value);
  if (!r.ok) {
    setFieldError(input, $(`cat-rename-${id}-error`), null, catError(r.code, r.name ?? input.value.trim()));
    input.focus();
    return;
  }
  commit(r.state);
  const name = categoryName(id);
  renamingId = null;
  render();
  announce(format('status.catRenamed', { name }));
  endRename(id);
}

function onAddCategory(ev) {
  ev.preventDefault();
  const input = $('cat-new');
  const r = addCategory(state, input.value, { idFn: newId });
  if (!r.ok) {
    setFieldError(input, $('cat-new-error'), null, catError(r.code, r.name ?? input.value.trim()));
    input.focus();
    return;
  }
  setFieldError(input, $('cat-new-error'), null, '');
  commit(r.state);
  input.value = '';
  render();
  announce(format('status.catAdded', { name: r.category.name }));
  input.focus();
}

function confirmSample(invoker) {
  openConfirm({
    title: format('confirm.sample.title'), body: [format('confirm.sample.body')],
    okText: format('confirm.sample.ok'), okClass: 'btn-primary', invoker,
    onConfirm: () => {
      commit(loadSample(state, Date.now()).state);
      viewMonth = currentMonth();
      announce(format('status.sample'));
      render();
      dialogFocusAfter = () => focusFirst(invoker, 'btn-add');
    },
  });
}

function confirmReset(invoker) {
  openConfirm({
    title: format('confirm.reset.title'), body: [format('confirm.reset.body')],
    okText: format('confirm.reset.ok'), okClass: 'btn-danger', invoker,
    onConfirm: () => {
      if (mode !== 'unavailable') {
        const r = clear(storage);
        if (!r.ok) { mode = 'unavailable'; showUnavailable(); } else mode = 'ok';
      }
      state = resetAll();
      hideQuota();
      filter = '';
      renamingId = null;
      viewMonth = currentMonth();
      render();
      announce(format('status.reset'));
      dialogFocusAfter = () => focusFirst(invoker, 'btn-add');
    },
  });
}

// ---------- Start ----------
function getStorage() {
  try {
    const s = window.localStorage;
    s.getItem(STORAGE_KEY);
    return s;
  } catch {
    return null;
  }
}

function start() {
  storage = getStorage();
  const r = load(storage);
  state = r.state;
  mode = r.status === 'corrupt' ? 'corrupt' : r.status === 'unavailable' ? 'unavailable' : 'ok';
  if (mode === 'unavailable') showUnavailable();

  $('btn-prev').addEventListener('click', () => changeMonth(addMonths(viewMonth, -1)));
  $('btn-next').addEventListener('click', () => changeMonth(addMonths(viewMonth, 1)));
  $('btn-current').addEventListener('click', () => {
    changeMonth(currentMonth());
    $('btn-prev').focus(); // the pressed button is now hidden
  });
  $('btn-add').addEventListener('click', (e) => openExpenseDialog(null, e.currentTarget));
  $('btn-empty-add').addEventListener('click', (e) => openExpenseDialog(null, e.currentTarget));
  $('btn-empty-sample').addEventListener('click', (e) => confirmSample(e.currentTarget));
  $('btn-sample').addEventListener('click', (e) => confirmSample(e.currentTarget));
  $('btn-reset').addEventListener('click', (e) => confirmReset(e.currentTarget));
  $('btn-corrupt-reset').addEventListener('click', (e) => confirmReset(e.currentTarget));
  $('filtro').addEventListener('change', (e) => setFilter(e.target.value));
  $('btn-filter-reset').addEventListener('click', () => { setFilter(''); $('filtro').focus(); });

  $('lista').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const e = state.expenses.find((x) => x.id === btn.dataset.id);
    if (!e) return;
    if (btn.dataset.action === 'edit') openExpenseDialog(e, btn);
    else if (btn.dataset.action === 'delete') confirmDeleteExpense(e.id, btn);
  });

  $('form-despesa').addEventListener('submit', submitExpense);
  $('f-cancel').addEventListener('click', () => $('dlg-despesa').close());
  $('f-descricao').addEventListener('input', updateCounter);
  for (const field of Object.keys(FIELDS)) {
    const input = $(FIELDS[field].input);
    input.addEventListener('change', () => revalidateField(field));
    input.addEventListener('blur', () => revalidateField(field));
  }
  $('dlg-despesa').addEventListener('close', onDialogClose);

  $('c-cancel').addEventListener('click', () => $('dlg-confirmar').close());
  $('c-ok').addEventListener('click', () => {
    const action = confirmAction;
    confirmAction = null;
    if (action) action();
    $('dlg-confirmar').close();
  });
  $('dlg-confirmar').addEventListener('close', onDialogClose);

  $('cat-list').addEventListener('click', onCategoryListClick);
  $('cat-list').addEventListener('submit', onRenameSubmit);
  $('cat-list').addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && renamingId && ev.target.matches('form.cat-rename input')) {
      ev.preventDefault();
      endRename(renamingId);
    }
  });
  $('cat-add-form').addEventListener('submit', onAddCategory);

  // Another tab changed the data: re-read (last write wins).
  window.addEventListener('storage', (ev) => {
    if (ev.key !== STORAGE_KEY && ev.key !== null) return;
    if ($('dlg-despesa').open || $('dlg-confirmar').open) return;
    const again = load(storage);
    if (again.status === 'corrupt') mode = 'corrupt';
    else { mode = again.status === 'unavailable' ? 'unavailable' : 'ok'; state = again.state; }
    render();
  });

  render();
}

start();
