# lab-sandbox

Minimal static site used as a test project to validate the AI Lab workflow end to end.

- Project context: `baleado/ai-lab` → `lab/projects/lab-sandbox/context.md`
- Version: see `VERSION`
- Health page: `/health` (`health.html` + `health.js`) shows `OK`, the current Europe/Lisbon date/time and the version from `VERSION`
- Tests (CI-only, Node.js built-in test runner, no dependencies): `node --test tests/health.test.js`
