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
  assert.equal(nav.parsePage('#/unknown'), 'home');
  assert.equal(nav.parsePage(''), 'home');
  assert.equal(nav.parsePage('#/home'), 'home');
  assert.equal(nav.parsePage('#/dashboard'), 'dashboard');
  assert.equal(nav.parsePage('#/history/'), 'history');
  for (const [legacy, current] of Object.entries({registrar: 'register', historico: 'history', investigacao: 'investigation',
    comparador: 'scenarios', ambientes: 'environments', corpo: 'body', autocuidado: 'self-care'})) {
    assert.equal(nav.parsePage(`#/${legacy}`), current);
    assert.equal(nav.legacyRedirect(`#/${legacy}/`), `#/${current}`);
  }
  assert.equal(nav.legacyRedirect('#/history'), null);
  assert.equal(nav.parsePage('#/self-care'), 'self-care');
  console.log('AKM-12 navigation checks: PASS (4 destinations, links and fallback)');
} finally {
  fs.rmSync(path.join(out, 'navigation.js'), {force: true});
  fs.rmdirSync(out);
}
