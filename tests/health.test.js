'use strict';
// Tests for the /health page (Issue #1). Node built-ins only; run with:
//   node --test tests/health.test.js
// CI runs this file under TZ=UTC and TZ=America/New_York.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const HTML = read('health.html');
const JS = read('health.js');
const WORKFLOW = read('.github/workflows/health-check.yml');
const health = require(path.join(ROOT, 'health.js'));

// AC1 helper: true when <body> has an element whose whole text is exactly "OK",
// as static markup (script contents and comments are ignored).
function hasStaticOK(html) {
  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const body = cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  if (!body) return false;
  return />\s*OK\s*</.test(body[1]);
}

function fakeDoc() {
  const els = {
    status: { textContent: 'OK' },
    'lisbon-time': { textContent: '–' },
    version: { textContent: 'loading…' },
  };
  return { els, getElementById: (id) => els[id] || null };
}

function okResponse(body) {
  return { ok: true, status: 200, text: async () => body };
}

function recordingFetch(response) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (response instanceof Error) throw response;
    return response;
  };
  fn.calls = calls;
  return fn;
}

const DST_VECTORS = [
  ['2026-01-15T12:00:00Z', '2026-01-15 12:00:00 Europe/Lisbon (UTC+00:00)'],
  ['2026-07-15T12:00:00Z', '2026-07-15 13:00:00 Europe/Lisbon (UTC+01:00)'],
  ['2026-03-29T00:59:59Z', '2026-03-29 00:59:59 Europe/Lisbon (UTC+00:00)'],
  ['2026-03-29T01:00:00Z', '2026-03-29 02:00:00 Europe/Lisbon (UTC+01:00)'],
  ['2026-10-25T00:59:59Z', '2026-10-25 01:59:59 Europe/Lisbon (UTC+01:00)'],
  ['2026-10-25T01:00:00Z', '2026-10-25 01:00:00 Europe/Lisbon (UTC+00:00)'],
];

// ---------- AC1: static "OK" ----------
test('AC1: health.html body contains exact static "OK"', () => {
  assert.equal(hasStaticOK(HTML), true);
  assert.match(HTML, /<p id="status">OK<\/p>/);
});

test('AC1: health.js never writes "OK" or touches #status', () => {
  assert.doesNotMatch(JS, /OK/);
  assert.doesNotMatch(JS, /status/);
});

// ---------- AC2: served at /health ----------
test('AC2: health.html sits at the repo root and loads health.js relatively', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'health.html')));
  assert.ok(fs.existsSync(path.join(ROOT, 'health.js')));
  assert.match(HTML, /<script src="health\.js" defer><\/script>/);
  assert.doesNotMatch(HTML, /(src|href)="\//, 'no leading-slash URLs');
  assert.ok(fs.existsSync(path.join(ROOT, 'index.html')), 'home page still present');
});

// ---------- AC3: current Lisbon time ----------
const FORMAT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} Europe\/Lisbon \(UTC[+-]\d{2}:\d{2}\)$/;

test('AC3: formatLisbon(now) has the required format', () => {
  assert.match(health.formatLisbon(new Date()), FORMAT_RE);
});

test('AC3: formatLisbon(now) is within 60 s of the real Lisbon time', () => {
  const now = new Date();
  const shown = health.formatLisbon(now);
  const m = shown.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) Europe\/Lisbon \(UTC([+-])(\d{2}):(\d{2})\)$/);
  assert.ok(m, shown);
  const offsetMs = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9])) * 60000;
  const shownInstant = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - offsetMs;
  assert.ok(Math.abs(shownInstant - now.getTime()) < 60000, `drift too large: ${shown}`);
});

test('AC3: output does not depend on the process time zone', () => {
  // The same vectors are asserted exactly in AC4; CI runs this file under two TZ values.
  for (const [iso, expected] of DST_VECTORS) {
    assert.equal(health.formatLisbon(new Date(iso)), expected, `TZ=${process.env.TZ}`);
  }
});

test('AC3: init writes formatLisbon(now) to #lisbon-time', async () => {
  const doc = fakeDoc();
  const now = new Date('2026-10-10T11:49:03Z');
  await health.init(doc, now, recordingFetch(okResponse('9.9.9\n')));
  assert.equal(doc.els['lisbon-time'].textContent, '2026-10-10 12:49:03 Europe/Lisbon (UTC+01:00)');
  assert.equal(doc.els.status.textContent, 'OK', '#status left untouched');
});

test('AC3: no hard-coded timestamp in health.html or health.js', () => {
  const ts = /\d{4}-\d{2}-\d{2}/;
  assert.doesNotMatch(HTML, ts);
  assert.doesNotMatch(JS, ts);
});

// ---------- AC4: DST correctness ----------
for (const [iso, expected] of DST_VECTORS) {
  test(`AC4: ${iso} -> ${expected}`, () => {
    assert.equal(health.formatLisbon(new Date(iso)), expected);
  });
}

// ---------- AC5: version from VERSION ----------
test('AC5: VERSION exists and holds a non-empty semver', () => {
  const v = read('VERSION').trim();
  assert.match(v, /^\d+\.\d+\.\d+$/);
});

test('AC5: loadVersion fetches "VERSION" with no-store and trims the body', async () => {
  const f = recordingFetch(okResponse('0.1.0\n'));
  assert.equal(await health.loadVersion(f), '0.1.0');
  assert.deepEqual(f.calls, [{ url: 'VERSION', opts: { cache: 'no-store' } }]);
});

test('AC5: loadVersion returns the real VERSION file content', async () => {
  const real = read('VERSION');
  assert.equal(await health.loadVersion(recordingFetch(okResponse(real))), real.trim());
  assert.equal(await health.loadVersion(recordingFetch(okResponse('0.1.1\n'))), '0.1.1');
});

test('AC5: version is not hard-coded in health.html or health.js', () => {
  const v = read('VERSION').trim();
  assert.ok(!HTML.includes(v));
  assert.ok(!JS.includes(v));
});

test('AC5: init writes the loaded version to #version', async () => {
  const doc = fakeDoc();
  await health.init(doc, new Date(), recordingFetch(okResponse(read('VERSION'))));
  assert.equal(doc.els.version.textContent, read('VERSION').trim());
});

// ---------- AC6: VERSION unavailable ----------
const FAILURES = [
  ['404 response', { ok: false, status: 404, text: async () => 'Not Found' }],
  ['network error', new Error('network down')],
  ['empty body', okResponse('')],
  ['whitespace-only body', okResponse('  \n\t ')],
];

for (const [name, response] of FAILURES) {
  test(`AC6: loadVersion resolves "unknown" on ${name}`, async () => {
    assert.equal(await health.loadVersion(recordingFetch(response)), 'unknown');
  });
}

test('AC6: loadVersion resolves "unknown" if fetch throws synchronously', async () => {
  const f = () => { throw new TypeError('fetch unavailable'); };
  assert.equal(await health.loadVersion(f), 'unknown');
});

test('AC6: parseVersion handles null/undefined/empty', () => {
  assert.equal(health.parseVersion(null), 'unknown');
  assert.equal(health.parseVersion(undefined), 'unknown');
  assert.equal(health.parseVersion(''), 'unknown');
  assert.equal(health.parseVersion(' 0.1.0 \n'), '0.1.0');
});

test('AC6: init with failing fetch still sets time, version "unknown", never throws', async () => {
  const doc = fakeDoc();
  await assert.doesNotReject(health.init(doc, new Date(), recordingFetch(new Error('offline'))));
  assert.equal(doc.els.version.textContent, 'unknown');
  assert.match(doc.els['lisbon-time'].textContent, FORMAT_RE);
  assert.equal(doc.els.status.textContent, 'OK');
});

test('AC6: init with an invalid date shows "unavailable" and does not throw', async () => {
  const doc = fakeDoc();
  await assert.doesNotReject(health.init(doc, new Date(NaN), recordingFetch(okResponse('0.1.0'))));
  assert.equal(doc.els['lisbon-time'].textContent, 'unavailable');
});

// ---------- AC7: CI check and negative evidence ----------
test('AC7 (negative check): hasStaticOK fails when "OK" is removed', () => {
  const withoutOK = HTML.replace('>OK<', '><');
  assert.notEqual(withoutOK, HTML, 'mutation applied');
  assert.equal(hasStaticOK(withoutOK), false);
});

test('AC7 (negative check): "OK" only inside <script> or a comment does not count', () => {
  const base = HTML.replace('>OK<', '><');
  assert.equal(hasStaticOK(base.replace('</main>', '<script>var s = "<b>OK</b>";</script></main>')), false);
  assert.equal(hasStaticOK(base.replace('</main>', '<!-- <p>OK</p> --></main>')), false);
  assert.equal(hasStaticOK(base.replace('<p id="status"></p>', '<p id="status">ok</p>')), false, 'case-sensitive');
});

test('AC7: workflow triggers, least privilege, no secrets, free runner', () => {
  assert.match(WORKFLOW, /^\s{2}pull_request:\s*\n\s{4}branches: \[main\]/m);
  assert.match(WORKFLOW, /^\s{2}push:\s*\n\s{4}branches: \[main\]/m);
  assert.doesNotMatch(WORKFLOW, /pull_request_target/);
  assert.match(WORKFLOW, /^permissions:\s*\n\s{2}contents: read\s*$/m);
  assert.doesNotMatch(WORKFLOW, /secrets\./);
  assert.match(WORKFLOW, /runs-on: ubuntu-latest/);
  assert.match(WORKFLOW, /persist-credentials: false/);
  for (const m of WORKFLOW.matchAll(/uses:\s*(\S+)/g)) {
    assert.match(m[1], /^actions\/[\w-]+@[0-9a-f]{40}$/, `action pinned by SHA: ${m[1]}`);
  }
});

// ---------- AC8: project constraints ----------
test('AC8: no external URLs in health.html or health.js', () => {
  for (const src of [HTML, JS]) {
    assert.doesNotMatch(src, /https?:\/\//);
    assert.doesNotMatch(src, /(src|href)\s*=\s*["']?\/\//);
  }
});

test('AC8: the only fetch target is the same-origin VERSION file', async () => {
  const targets = [...JS.matchAll(/fetch\w*\(\s*([^,)]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(targets, ["'VERSION'"]);
  const f = recordingFetch(okResponse('0.1.0'));
  await health.init(fakeDoc(), new Date(), f);
  assert.deepEqual(f.calls.map((c) => c.url), ['VERSION']);
});

test('AC8: vanilla JS only (no innerHTML, eval, imports, inline script)', () => {
  assert.doesNotMatch(JS, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|\bimport\b|require\(/);
  assert.doesNotMatch(HTML, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline script');
  assert.doesNotMatch(HTML, /\son\w+=/, 'no inline event handlers');
});

test('AC8: no build step or npm dependencies', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'package.json')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'node_modules')));
});
