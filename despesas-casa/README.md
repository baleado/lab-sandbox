# despesas-casa: household expense prototype

Static, browser-only prototype for recording household expenses (Issue [#3](https://github.com/baleado/lab-sandbox/issues/3)). UI in European Portuguese (pt-PT).

> **Prototype.** Data is kept only in this browser's `localStorage` (key `despesas-casa:v1`) on this device and is never sent to any server. Do not use it for real financial data. Clearing site data deletes everything. The sample data is invented.

- Served at `https://baleado.github.io/lab-sandbox/despesas-casa/` once deployed (deployment target pending confirmation, ADR-9 in #3).
- Vanilla HTML/CSS/JavaScript ES modules. No build, no dependencies, no `package.json`.
- Amounts are integer cents; dates are `YYYY-MM-DD` strings, so the device time zone never moves an expense to another month.
- Strict CSP (`default-src 'self'; connect-src 'none'`): the page can only load its own files.

## Layout

| Path | Role |
|---|---|
| `index.html`, `css/styles.css` | Single page and design tokens (Azulejo (Designer) spec in #3) |
| `js/app.js` | DOM wiring only (the only module that touches the DOM) |
| `js/model.js`, `js/summary.js` | Pure state transitions, validation, monthly list and totals |
| `js/money.js`, `js/dates.js` | Cents parsing/formatting, ISO date helpers |
| `js/storage.js` | `localStorage` load/save behind an injected `Storage` |
| `js/sample-data.js`, `js/messages.js` | Synthetic sample data, every pt-PT string |
| `tests/*.test.mjs` | Node built-in test runner, no dependencies |

## Run locally

ES modules do not load from `file://`, so use any static server, for example:

```sh
python3 -m http.server 8000   # from the repository root
# open http://localhost:8000/despesas-casa/
```

## Tests

CI (`.github/workflows/despesas-casa-tests.yml`) runs on Node 24 under `TZ=UTC`, `TZ=America/New_York` and `TZ=Pacific/Kiritimati`:

```sh
TZ=UTC node --test "despesas-casa/tests/*.test.mjs"            # Node 21+ expands the glob
TZ=America/New_York node --test despesas-casa/tests/*.test.mjs  # Node 20: let the shell expand it
```

Layout, keyboard and screen-reader behaviour are checked manually against the UI acceptance checks in the Designer handoff on #3.
