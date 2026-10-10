// Shared test helpers (Issue #3). Node built-ins only.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(APP_DIR, '..');
export const read = (rel) => fs.readFileSync(path.join(APP_DIR, rel), 'utf8');
export const readRoot = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

/** AC: "differences in the kind of space character are ignored". */
export const normSpaces = (s) => s.replace(/[\u0020\u00A0\u202F]/g, ' ');

/** Deterministic id generator. */
export function seqIds(prefix = 'id') {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

/** In-memory Storage fake with switchable failure modes. */
export class FakeStorage {
  constructor() { this.map = new Map(); this.failSet = null; this.failGet = false; }
  getItem(k) { if (this.failGet) throw new Error('SecurityError'); return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    if (this.failSet === 'quota') { const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; throw e; }
    if (this.failSet === 'other') throw new Error('SecurityError');
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
}
