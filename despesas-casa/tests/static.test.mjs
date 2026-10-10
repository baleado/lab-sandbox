// Static checks of index.html, css/ and js/ (AC9, AC11, AC12, AC14, ADR-8).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP_DIR, REPO_ROOT, read } from './helpers.mjs';

const HTML = read('index.html');
const CSS = read('css/styles.css');
const JS_FILES = fs.readdirSync(path.join(APP_DIR, 'js')).filter((f) => f.endsWith('.js'));
const JS = Object.fromEntries(JS_FILES.map((f) => [f, read(`js/${f}`)]));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? [p, ...walk(p)] : [p];
  });
}

test('ADR-3: the expected modules exist', () => {
  for (const f of ['app.js', 'model.js', 'summary.js', 'money.js', 'dates.js', 'storage.js', 'sample-data.js', 'messages.js']) {
    assert.ok(JS_FILES.includes(f), f);
  }
});

test('AC9: CSP meta is strict and no-referrer is set', () => {
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(HTML);
  assert.ok(csp, 'CSP meta present');
  for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
    assert.ok(csp[1].includes(d), d);
  }
  assert.doesNotMatch(csp[1], /unsafe-inline|unsafe-eval|https?:|\*/);
  assert.match(HTML, /<meta name="referrer" content="no-referrer">/);
});

test('AC9: no external URLs, network APIs or leading-slash URLs anywhere in the app', () => {
  const sources = { 'index.html': HTML, 'css/styles.css': CSS, ...Object.fromEntries(Object.entries(JS).map(([f, s]) => [`js/${f}`, s])) };
  for (const [name, src] of Object.entries(sources)) {
    assert.doesNotMatch(src, /https?:\/\//, `${name}: no http(s) URL`);
    assert.doesNotMatch(src, /(src|href|action)\s*=\s*["']?\/{1,2}/, `${name}: no leading-slash or protocol-relative URL`);
    assert.doesNotMatch(src, /url\(\s*["']?(\/|https?:)/, `${name}: no external CSS url()`);
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|@import|@font-face/, `${name}: no network API`);
  }
  for (const [f, src] of Object.entries(JS)) {
    for (const m of src.matchAll(/^import\s.+from\s+'([^']+)'/gm)) assert.match(m[1], /^\.\/[\w-]+\.js$/, `${f}: local relative import`);
  }
  assert.match(HTML, /<link rel="stylesheet" href="css\/styles\.css">/);
  assert.match(HTML, /<script type="module" src="js\/app\.js"><\/script>/);
});

test('ADR-8: no HTML sinks, eval, inline scripts, inline styles or inline handlers', () => {
  for (const [f, src] of Object.entries(JS)) {
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function|setAttribute\(\s*['"]on/, f);
    if (f !== 'app.js') assert.doesNotMatch(src, /\blocalStorage\s*[.[]|\bdocument\.\w|\bwindow\.\w/, `${f}: only app.js touches DOM/window`);
  }
  assert.doesNotMatch(HTML, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline script');
  assert.doesNotMatch(HTML, /\sstyle\s*=/, 'no inline style attribute');
  assert.doesNotMatch(HTML, /\son[a-z]+\s*=/, 'no inline event handler');
  assert.doesNotMatch(HTML, /<form(?![^>]*novalidate)/, 'every form is novalidate (handled in JS)');
  assert.doesNotMatch(HTML, /method="dialog"/);
});

test('AC12: lang, landmarks and headings', () => {
  assert.match(HTML, /<html lang="pt-PT">/);
  assert.equal((HTML.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(HTML, /<h1>Despesas da casa<\/h1>/);
  for (const h of ['Resumo mensal', 'Despesas', 'Categorias e dados']) assert.match(HTML, new RegExp(`<h2[^>]*>${h}</h2>`));
  for (const l of ['<header', '<nav class="month-nav" aria-label="Mês"', '<main id="conteudo"', '<aside class="banner banner-notice" aria-label="Aviso sobre os dados"', '<footer']) {
    assert.ok(HTML.includes(l), l);
  }
  assert.match(HTML, /<a class="skip-link" href="#conteudo">Saltar para o conteúdo principal<\/a>/);
});

test('AC12: every input and select in index.html has a <label for>', () => {
  const ids = [...HTML.matchAll(/<(input|select|textarea)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[2]);
  assert.ok(ids.length >= 6);
  for (const id of ids) assert.match(HTML, new RegExp(`<label for="${id}">`), id);
  assert.equal([...HTML.matchAll(/<(input|select|textarea)\b/g)].length, ids.length, 'every control has an id');
});

test('AC12: no positive tabindex; live regions exist; dialogs are labelled', () => {
  assert.doesNotMatch(HTML + Object.values(JS).join('\n'), /tabindex="?[1-9]/);
  assert.match(HTML, /<p id="status" class="status-line" role="status" aria-live="polite"><\/p>/);
  assert.match(HTML, /<dialog class="dialog dialog-form" id="dlg-despesa" aria-labelledby="dlg-despesa-title">/);
  assert.match(HTML, /<dialog class="dialog" id="dlg-confirmar" aria-labelledby="dlg-confirmar-title" aria-describedby="dlg-confirmar-body">/);
  assert.doesNotMatch(Object.values(JS).join('\n'), /window\.confirm|\bconfirm\(|\balert\(/, 'no native confirm/alert (pt-PT buttons)');
});

test('AC2/AC12: amount is a text input with decimal keyboard; description max 100', () => {
  assert.match(HTML, /<input type="text" id="f-valor" inputmode="decimal"/);
  assert.match(HTML, /<input type="date" id="f-data"/);
  assert.match(HTML, /<input type="text" id="f-descricao" maxlength="100"/);
  assert.doesNotMatch(HTML, /type="number"/);
});

test('AC11: viewport meta allows zoom; no fixed widths above 320 px in CSS', () => {
  assert.match(HTML, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.doesNotMatch(HTML, /user-scalable|maximum-scale/);
  for (const m of CSS.matchAll(/(?<![-\w])(width|min-width)\s*:\s*(\d+)px/g)) {
    assert.ok(Number(m[2]) <= 320, `fixed ${m[1]}: ${m[2]}px`);
  }
  assert.match(CSS, /--target-min:\s*44px/);
  assert.match(CSS, /@media \(min-width: 40em\)/);
  assert.match(CSS, /@media \(min-width: 64em\)/);
  assert.match(CSS, /prefers-reduced-motion: reduce/);
  assert.match(CSS, /forced-colors: active/);
  assert.match(CSS, /:focus-visible\s*\{\s*outline: var\(--focus-ring\)/);
});

test('Design §3: colour tokens use the designed hex values; system fonts only', () => {
  const tokens = {
    '--color-bg': '#F6F7F9', '--color-surface': '#FFFFFF', '--color-surface-sunken': '#EEF1F5', '--color-text': '#1A1F2B',
    '--color-text-muted': '#4A5361', '--color-border-strong': '#6B7280', '--color-divider': '#D9DDE3', '--color-primary': '#1F4E9C',
    '--color-primary-hover': '#173D7A', '--color-primary-active': '#112E5C', '--color-primary-soft': '#E7EEF8', '--color-focus': '#1F4E9C',
    '--color-danger': '#B3261E', '--color-danger-hover': '#8C1D18', '--color-danger-soft': '#FCEDEC', '--color-success': '#1D6B3A',
    '--color-success-soft': '#E6F4EA', '--color-warning-text': '#6B4200', '--color-warning-soft': '#FFF3D6',
    '--color-disabled-bg': '#E4E7EB', '--color-disabled-text': '#5F6673',
    '--cat-habitacao': '#1F4E9C', '--cat-alimentacao': '#2E7D32', '--cat-transportes': '#B45309', '--cat-contas-da-casa': '#6D28D9',
    '--cat-saude': '#C2185B', '--cat-educacao': '#00796B', '--cat-lazer': '#7A5230', '--cat-outros': '#55606E',
  };
  for (const [k, v] of Object.entries(tokens)) assert.match(CSS, new RegExp(`${k}:\\s*${v};`, 'i'), k);
  const root = CSS.slice(CSS.indexOf(':root'), CSS.indexOf('}', CSS.indexOf(':root')));
  const outside = CSS.replace(root, '');
  assert.doesNotMatch(outside, /#[0-9a-f]{3,8}\b/i, 'hex colours only inside :root tokens');
  assert.match(CSS, /--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif;/);
});

test('AC14/ADR-2: no package.json, node_modules, or _/. names under despesas-casa/', () => {
  assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'package.json')));
  assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'node_modules')));
  assert.ok(!fs.existsSync(path.join(APP_DIR, 'package.json')));
  for (const p of walk(APP_DIR)) assert.doesNotMatch(path.basename(p), /^[_.]/, path.relative(REPO_ROOT, p));
});

test('page weight stays small (S5: < 100 KB uncompressed, app files only)', () => {
  const files = ['index.html', 'css/styles.css', ...JS_FILES.map((f) => `js/${f}`)];
  const bytes = files.reduce((n, f) => n + fs.statSync(path.join(APP_DIR, f)).size, 0);
  assert.ok(bytes < 100 * 1024, `${bytes} bytes`);
});
