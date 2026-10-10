// AC13: the CI workflow is least-privilege, SHA-pinned and runs 3 time zones (ADR-7).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRoot } from './helpers.mjs';

const WF = readRoot('.github/workflows/despesas-casa-tests.yml');

test('AC13: triggers on pull_request and push to main; never pull_request_target', () => {
  assert.match(WF, /^\s{2}pull_request:\s*\n\s{4}branches: \[main\]/m);
  assert.match(WF, /^\s{2}push:\s*\n\s{4}branches: \[main\]/m);
  assert.doesNotMatch(WF, /pull_request_target|workflow_run/);
});

test('AC13: contents: read only, no secrets, free GitHub-hosted runner', () => {
  assert.match(WF, /^permissions:\s*\n\s{2}contents: read\s*$/m);
  assert.equal((WF.match(/:\s*write\b/g) || []).length, 0);
  assert.doesNotMatch(WF, /secrets\.|GITHUB_TOKEN|github\.token/);
  assert.match(WF, /runs-on: ubuntu-latest/);
  assert.match(WF, /persist-credentials: false/);
  assert.match(WF, /node-version: '24'/);
});

test('AC13: actions pinned to the same full SHAs as health-check.yml', () => {
  const uses = [...WF.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.deepEqual(uses, [
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1',
  ]);
  const health = readRoot('.github/workflows/health-check.yml');
  for (const u of uses) assert.ok(health.includes(u), `same pin as health-check: ${u}`);
});

test('AC13: runs the despesas-casa tests under UTC, America/New_York and Pacific/Kiritimati', () => {
  for (const tz of ['UTC', 'America/New_York', 'Pacific/Kiritimati']) {
    assert.match(WF, new RegExp(`run: node --test "despesas-casa/tests/\\*\\.test\\.mjs"\\s*\\n\\s*env:\\s*\\n\\s*TZ: ${tz.replace('/', '\\/')}\\s*$`, 'm'), tz);
  }
  assert.doesNotMatch(WF, /npm |npx |yarn |pnpm /, 'no package installs');
});
