// AC9 (persistence in the browser only) and AC10 (reset): storage.js with a fake Storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, load, save, clear } from '../js/storage.js';
import { initialState, addExpense, loadSample, addCategory } from '../js/model.js';
import { FakeStorage } from './helpers.mjs';

const NOW = Date.UTC(2026, 9, 10, 12);

test('AC9: key is despesas-casa:v1 and save → load round-trips (reload)', () => {
  const st = new FakeStorage();
  let s = loadSample(initialState(), NOW).state;
  s = addCategory(s, 'Animais', { idFn: () => 'cat-1' }).state;
  assert.equal(STORAGE_KEY, 'despesas-casa:v1');
  assert.deepEqual(save(st, s), { ok: true });
  assert.deepEqual([...st.map.keys()], ['despesas-casa:v1']);
  assert.deepEqual(load(st), { status: 'ok', state: s });
});

test('AC9: amounts are stored as integer cents in one JSON document', () => {
  const st = new FakeStorage();
  const r = addExpense(initialState(), { amount: '0,10', date: '2026-10-01', categoryId: 'lazer' }, { idFn: () => 'a', now: NOW });
  save(st, r.state);
  const doc = JSON.parse(st.map.get(STORAGE_KEY));
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.expenses[0].amountCents, 10);
  assert.ok(Number.isInteger(doc.expenses[0].amountCents));
});

test('first use: absent key gives empty status with the initial state', () => {
  assert.deepEqual(load(new FakeStorage()), { status: 'empty', state: initialState() });
});

test('corrupt or unknown-schema data is reported and never overwritten by load', () => {
  const bad = ['{not json', '[]', 'null', '{"schemaVersion":2,"categories":[],"expenses":[]}',
    JSON.stringify({ schemaVersion: 1, categories: [{ id: 'outros', name: 'Outros' }], expenses: [{ id: 'a', amountCents: 12.5, date: '2026-10-01', categoryId: 'outros', description: '', createdAt: 1 }] }),
    JSON.stringify({ schemaVersion: 1, categories: [{ id: 'lazer', name: 'Lazer' }], expenses: [] }),
    JSON.stringify({ schemaVersion: 1, categories: [{ id: 'outros', name: 'Outros' }], expenses: [{ id: 'a', amountCents: 1, date: '2026-10-01', categoryId: 'nope', description: '', createdAt: 1 }] })];
  for (const raw of bad) {
    const st = new FakeStorage();
    st.map.set(STORAGE_KEY, raw);
    const r = load(st);
    assert.equal(r.status, 'corrupt', raw);
    assert.deepEqual(r.state, initialState());
    assert.equal(st.map.get(STORAGE_KEY), raw, 'left as is');
  }
});

test('unavailable storage: load and save never throw', () => {
  const st = new FakeStorage();
  st.failGet = true;
  assert.equal(load(st).status, 'unavailable');
  assert.equal(load(null).status, 'unavailable');
  assert.deepEqual(save(null, initialState()), { ok: false, code: 'unavailable' });
  const st2 = new FakeStorage();
  st2.failSet = 'other';
  assert.deepEqual(save(st2, initialState()), { ok: false, code: 'unavailable' });
});

test('quota exceeded is reported as quota', () => {
  const st = new FakeStorage();
  st.failSet = 'quota';
  assert.deepEqual(save(st, initialState()), { ok: false, code: 'quota' });
});

test('AC10: clear removes the key so the next load is first use', () => {
  const st = new FakeStorage();
  save(st, loadSample(initialState(), NOW).state);
  assert.deepEqual(clear(st), { ok: true });
  assert.deepEqual(load(st), { status: 'empty', state: initialState() });
  st.map.set(STORAGE_KEY, '{corrupt');
  clear(st);
  assert.equal(load(st).status, 'empty', 'reset also recovers from corrupt data');
});
