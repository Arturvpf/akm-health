// Invoke the project's TypeScript compiler through Node on every platform.
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const repo = path.resolve(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'akm-nav-'));
try {
  cp.execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'),
    '--target', 'ES2022', '--module', 'CommonJS',
    '--skipLibCheck', '--outDir', out,
    path.join(repo, 'src/navigation.ts'),
  ], {stdio: 'pipe'});
  const nav = require(path.join(out, 'navigation.js'));
  assert.equal(nav.NAVIGATION.length, 4);
  for (const item of nav.NAVIGATION) {
    assert.equal(nav.parsePage(nav.pageHref(item.id)), item.id);
  }
  assert.equal(nav.parsePage('#/unknown'), 'dashboard');
  assert.equal(nav.parsePage(''), 'dashboard');
  assert.equal(nav.parsePage('#/historico/'), 'historico');
  console.log('AKM-12 navigation checks: PASS (4 destinations, links and fallback)');
} finally {
  fs.rmSync(path.join(out, 'navigation.js'), {force: true});
  fs.rmdirSync(out);
}
