// AKM-30: real browser + loopback API + disposable synthetic fixture.
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(frontend, '..');
const output = path.resolve(process.env.AKM_ACCEPTANCE_OUTPUT || path.join(frontend, 'node_modules/.cache/akm30'));
const python = process.env.PYTHON || path.join(repo, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const port = (name, fallback) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error(name + ' must be a TCP port between 1024 and 65535');
  return value;
};
// Defaults keep the documented ports; overrides let a shared machine avoid colliding with other services.
const apiPort = port('AKM_ACCEPTANCE_API_PORT', 8765);
const previewPort = port('AKM_ACCEPTANCE_PREVIEW_PORT', 8766);
const emptyPort = port('AKM_ACCEPTANCE_EMPTY_PORT', 8767);
if (new Set([apiPort, previewPort, emptyPort]).size !== 3) throw new Error('Acceptance ports must be distinct');
const channel = process.env.AKM_ACCEPTANCE_BROWSER_CHANNEL || undefined;
await mkdir(output, { recursive: true });
const fixtureRoot = await mkdtemp(path.join(output, 'fixtures-'));
const children = [];
async function freePort(port) {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => probe.close(resolve));
}
const report = { demo_only: true, fixture: 'Synthetic seed shifted by one delta into current window; NASA unchanged',
  cases: [], audits: [], browserErrors: [], externalRequests: [], limitations: [
    'Automated keyboard checks do not certify human screen-reader experience.',
    'datetime-local content is filled by Playwright; internal native date segments are not manually certified.',
    'Blocking browser external requests tests local application operation, not a disconnected operating system.',
  ] };
let browser;
let server;
let page;
function start(port, empty = false) {
  const child = spawn(python, ['scripts/serve_acceptance_fixture.py', '--port', String(port), '--database', path.join(fixtureRoot, String(port) + '.db'), ...(empty ? ['--empty'] : [])],
    { cwd: repo, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', x => { log += x; });
  child.stderr.on('data', x => { log += x; });
  child.on('error', error => { log += error.message; });
  children.push({ child, port, log: () => log });
  return child;
}
async function ready(url, child) {
  for (let n = 0; n < 120; n++) {
    if (child.exitCode !== null) throw new Error('Fixture exited before ready: ' + child.exitCode);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Fixture readiness timeout: ' + url);
}
function passed(name) { report.cases.push(name); console.log('PASS', name); }
async function audit(name) {
  await page.addScriptTag({ path: path.join(frontend, 'node_modules/axe-core/axe.min.js') });
  const result = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    const summarize = item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({
      target: node.target, html: node.html, summary: node.failureSummary,
    })) });
    return { violations: result.violations.map(summarize), incomplete: result.incomplete.map(summarize), passes: result.passes.length };
  });
  report.audits.push({ name, ...result });
  assert.deepEqual(result.violations, [], 'axe violations in ' + name);
  assert.deepEqual(result.incomplete.filter(item => item.id !== 'color-contrast'), [],
    'Unresolved semantic accessibility review in ' + name);
}
async function go(route) {
  await page.goto('http://127.0.0.1:' + previewPort + '/#/' + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const headings = { dashboard: 'Mission dashboard', registrar: 'Register a measurement', historico: 'Measurement history', investigacao: 'Investigation and follow-up' };
  await page.getByRole('heading', { level: 1, name: headings[route], exact: true }).waitFor({ state: 'attached' });
}
async function record(kind, value, quality = 'ok') {
  await go('registrar');
  const another = page.getByRole('button', { name: 'Register another measurement', exact: true });
  if (await another.count()) await another.click();
  await page.locator('#measurement-kind:enabled').waitFor();
  const personal = await page.locator('#measurement-astronaut').count();
  await page.locator('#measurement-kind').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('id'), personal ? 'measurement-astronaut' : 'measurement-value');
  if (personal) {
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'measurement-value');
  }
  await page.locator('#measurement-kind').selectOption(kind);
  if (kind !== 'co2_ppm' && kind !== 'cabin_temp_c') await page.locator('#measurement-astronaut').selectOption('A1');
  await page.locator('#measurement-value').fill(value);
  await page.locator('#measurement-localTime').fill(new Date(Date.now() - 1000).toISOString().slice(0, 19));
  await page.locator('#measurement-offset').fill('+00:00');
  await page.locator('#measurement-source').selectOption('synthetic');
  await page.locator('#measurement-quality').selectOption(quality);
  await page.locator('#measurement-quality').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').innerText(), 'Save measurement');
  // AKM-33: the form stores the reading in the local outbox, then delivers it with a stable operation ID.
  const response = page.waitForResponse(r => r.url().endsWith('/api/sync/measurements') && r.request().method() === 'POST');
  await page.keyboard.press('Enter');
  const saved = await response;
  assert.equal(saved.status(), 201);
  const { operation_id: operation, measurement: receipt } = await saved.json();
  assert.equal(JSON.parse(saved.request().postData()).operation_id, operation);
  await page.getByRole('heading', { name: 'Measurement #' + receipt.id + ' confirmed', exact: true }).waitFor();
  return receipt;
}
async function investigate(replay = false) {
  const response = page.waitForResponse(r => r.url().endsWith('/api/investigations/run'));
  await page.getByRole('button', { name: replay ? 'Reanalyze this scope' : 'Run investigation', exact: true }).click();
  const r = await response;
  assert.equal(r.status(), 200);
  return r.json();
}
try {
  await Promise.all([apiPort, previewPort, emptyPort].map(freePort));
  const seeded = start(apiPort);
  const empty = start(emptyPort, true);
  await Promise.all([ready('http://127.0.0.1:' + apiPort + '/api/health', seeded), ready('http://127.0.0.1:' + emptyPort + '/api/health', empty)]);
  server = await preview({ root: frontend, configFile: path.join(frontend, 'vite.config.ts'),
    preview: { host: '127.0.0.1', port: previewPort, strictPort: true, proxy: { '/api': 'http://127.0.0.1:' + apiPort } } });
  browser = await chromium.launch({ headless: true, channel, timeout: 60000, args: ['--no-proxy-server', '--disable-gpu'] });
  report.browser = browser.version();
  report.ports = { api: apiPort, preview: previewPort, empty: emptyPort };
  report.channel = channel || 'playwright-chromium';
  // The AKM-33 shell service worker would hide page requests from Playwright's routing/response events,
  // including the external-request block below. Block it so every request stays observable.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    report.externalRequests.push(route.request().url());
    return route.abort();
  });
  page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => report.browserErrors.push(error.message));
  let investigationWrites = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/investigations/run')) investigationWrites++;
  });
  await go('dashboard');
  await page.getByRole('button', { name: 'Refresh data', exact: true }).waitFor();
  assert.equal(investigationWrites, 0);
  await page.getByRole('link', { name: 'Skip to content', exact: true }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'), 'main-content');
  passed('T14 skip link and GET navigation do not run rules');

  const sleep = await record('sleep_hours', '5.2');
  await audit('registration receipt');
  await page.screenshot({ path: path.join(output, 'receipt.png'), fullPage: true });
  await go('historico');
  await go('registrar');
  await page.locator('#measurement-kind:enabled').waitFor();
  // A confirmed reading must not come back as a prefilled draft that could be submitted twice.
  assert.equal(await page.locator('#measurement-value').inputValue(), '');
  assert.equal(await page.locator('#measurement-localTime').inputValue(), '');
  assert.equal(await page.locator('#measurement-kind').inputValue(), 'sleep_hours');
  passed('T03/T13 confirmed reading is not kept as a resubmittable draft');
  await go('historico');
  await page.locator('time[datetime="' + sleep.measured_at + '"]').first().waitFor();
  passed('T13 keyboard registration → real receipt → persisted History');

  // T03/T04 via the AKM-33 outbox path: a live server rejection must reach the form as a correctable
  // error, never as a queued/offline message, and must not stay in the outbox. The request body is
  // rewritten in transit (labeled mutation) so the real API produces the 422/404.
  for (const [label, mutate, field] of [
    ['422 out-of-domain value (model-level rule, no field location)', body => { body.measurement.value = -5; }, null],
    ['422 invalid quality (field-level)', body => { body.measurement.quality = 'not-a-quality'; }, '#measurement-quality'],
    ['404 unknown profile', body => { body.measurement.astronaut_id = 'ZZ-UNKNOWN'; }, null],
  ]) {
    await go('registrar');
    const again = page.getByRole('button', { name: 'Register another measurement', exact: true });
    if (await again.count()) await again.click();
    await page.locator('#measurement-kind:enabled').waitFor();
    await page.locator('#measurement-kind').selectOption('sleep_hours');
    await page.locator('#measurement-astronaut').selectOption('A1');
    await page.locator('#measurement-value').fill('6');
    await page.locator('#measurement-localTime').fill(new Date(Date.now() - 1000).toISOString().slice(0, 19));
    await page.locator('#measurement-offset').fill('+00:00');
    await page.route('**/api/sync/measurements', route => {
      const body = JSON.parse(route.request().postData());
      mutate(body);
      return route.continue({ postData: JSON.stringify(body) });
    });
    const rejected = page.waitForResponse(r => r.url().endsWith('/api/sync/measurements') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save measurement', exact: true }).click();
    const status = (await rejected).status();
    await page.unroute('**/api/sync/measurements');
    assert.equal(status, label.startsWith('422') ? 422 : 404, label);
    await page.getByRole('alert').filter({ hasText: /./ }).first().waitFor();
    const text = await page.locator('body').innerText();
    assert.ok(!text.includes('stored on this device'), label + ' shown as queued');
    assert.ok(!text.includes('kept on this device'), label + ' shown as queued');
    assert.ok(!text.includes('Connection error'), label + ' labeled as a connection problem');
    assert.ok(text.includes('0 pending · 0 conflict(s)'), label + ' left in outbox');
    assert.equal(await page.getByRole('heading', { name: /^Measurement #\d+ confirmed$/ }).count(), 0);
    if (field) assert.equal(await page.locator(field).getAttribute('aria-invalid'), 'true', label);
    await audit('registration live rejection ' + label);
  }
  const afterRejections = await (await fetch('http://127.0.0.1:' + apiPort + '/api/measurements')).json();
  assert.ok(!afterRejections.some(x => x.value === -5 || x.astronaut_id === 'ZZ-UNKNOWN' || x.quality === 'not-a-quality'));
  passed('T03/T04 outbox path: live 422/404 rejections show correctable errors, nothing queued or written');

  await go('investigacao');
  const first = await investigate();
  assert.equal(first.status, 'attention');
  assert.ok(first.hypotheses.every(x => x.certainty === 'unconfirmed'));
  assert.equal(first.next_check.kind, 'co2_ppm');
  const replay = await investigate(true);
  assert.equal(replay.reused, true);
  assert.equal(replay.id, first.id);
  assert.equal(investigationWrites, 2);
  passed('T07 explicit collective finding and reuse in UI');

  const suspect = await record('co2_ppm', '2200', 'suspect');
  const recheck = await record('co2_ppm', '850');
  assert.equal(investigationWrites, 2);
  await go('historico');
  await page.getByRole('combobox', { name: 'Measurement target', exact: true }).selectOption('habitat');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.locator('time[datetime="' + suspect.measured_at + '"]').first().waitFor();
  assert.ok((await page.locator('body').innerText()).includes('Suspect'));

  await go('investigacao');
  await page.getByRole('button', { name: 'Select check #' + first.followup_id, exact: true }).click();
  const measurements = page.getByRole('combobox', { name: 'Measurement to link', exact: true });
  await measurements.waitFor();
  assert.equal(await measurements.locator('option[value="' + suspect.id + '"]').count(), 0);
  await measurements.selectOption(String(recheck.id));
  const completionResponse = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith('/api/followups/' + first.followup_id));
  await page.getByRole('button', { name: 'Link measurement and complete', exact: true }).click();
  const completion = await completionResponse;
  assert.equal(completion.status(), 200);
  assert.equal((await completion.json()).measurement_id, recheck.id);
  await page.getByRole('region', { name: 'Selected completion' }).waitFor().catch(async () => {
    await page.getByText('Reanalyze the same scope to evaluate the new reading.', { exact: true }).waitFor();
  });
  const updated = await investigate(true);
  assert.notEqual(updated.input_fingerprint, first.input_fingerprint);
  await audit('investigation result and completed check');
  await page.screenshot({ path: path.join(output, 'investigation.png'), fullPage: true });
  passed('T08–T10/T13 suspect exclusion → compatible link → explicit reanalysis');

  const nasa = await (await fetch('http://127.0.0.1:' + apiPort + '/api/nasa/references')).json();
  assert.equal(nasa.historical_series.length, 864);
  const mission = await (await fetch('http://127.0.0.1:' + apiPort + '/api/measurements')).json();
  assert.ok(mission.every(x => ['manual', 'synthetic'].includes(x.source)));
  for (const route of ['dashboard', 'registrar', 'historico', 'investigacao']) {
    await go(route);
    if (route === 'registrar') await page.locator('#measurement-kind:enabled').waitFor();
    if (route === 'historico') await page.getByRole('button', { name: 'Apply filters', exact: true }).waitFor();
    if (route === 'dashboard' || route === 'investigacao') await page.getByRole('combobox', { name: 'Historical indicator', exact: true }).waitFor();
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' overflow at ' + width);
      await audit(route + ' ' + width);
      await page.screenshot({ path: path.join(output, route + '-' + width + '.png'), fullPage: true });
    }
  }
  assert.equal(investigationWrites, 3);
  passed('T12/T14/T15 NASA separation; all routes at 320/1280 with external network blocked');

  // Exploratory P1/P2 pages ship in the same build; hold them to the same automated bar.
  const exploratory = { comparador: 'Hypothetical scenario comparator', ambientes: 'Mission environments',
    corpo: 'Interactive body map', autocuidado: 'Self-care journey' };
  for (const [route, heading] of Object.entries(exploratory)) {
    await page.goto('http://127.0.0.1:' + previewPort + '/#/' + route, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: heading, exact: true }).waitFor({ state: 'attached' });
    await page.waitForLoadState('networkidle');
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' overflow at ' + width);
      await audit(route + ' ' + width);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(investigationWrites, 3);
  passed('T14/T15 exploratory pages at 320/1280 with external network blocked');

  await go('dashboard');
  await page.getByRole('combobox', { name: 'Historical indicator', exact: true }).waitFor();
  await page.route('**/api/nasa/references', route => route.fulfill({ status: 503, body: '{}' }));
  await page.reload();
  await page.getByText('NASA references could not be loaded.', { exact: true }).waitFor();
  await page.unroute('**/api/nasa/references');
  await page.locator('.nasa-references').getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('combobox', { name: 'Historical indicator', exact: true }).waitFor();
  passed('T14 NASA catalog error and explicit retry');

  // Real empty API database, through the same frontend. No invented fixture responses.
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    url.port = String(emptyPort);
    const response = await route.fetch({ url: url.href });
    await route.fulfill({ response });
  });
  await go('dashboard');
  await page.reload(); // The selected API fixture changed while the hash route stayed the same.
  await page.getByText('No crew profiles are available.', { exact: true }).waitFor();
  await audit('empty dashboard');
  await go('registrar');
  await page.locator('#measurement-kind:enabled').waitFor();
  // The selected metric is kept between visits (AKM-33 draft); choose a personal metric explicitly.
  await page.locator('#measurement-kind').selectOption('sleep_hours');
  assert.equal(await page.getByRole('button', { name: 'Save measurement', exact: true }).isDisabled(), true);
  await page.locator('#measurement-kind').selectOption('co2_ppm');
  assert.equal(await page.getByRole('button', { name: 'Save measurement', exact: true }).isEnabled(), true);
  passed('T06/T14 real empty storage, no invented crew, habitat remains available');
  await page.unroute('**/api/**');

  await go('dashboard');
  await page.getByRole('button', { name: 'Refresh data', exact: true }).waitFor();
  await page.route('**/api/dashboard', route => route.fulfill({ status: 503, body: '{}' }));
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click();
  // AKM-33: a failed refresh falls back to the copy saved on this device, labeled as such (never "updated").
  await page.getByText('Could not get current data from the mission server.', { exact: false }).waitFor();
  await page.getByText('Showing cached copy (may be out of date)', { exact: false }).waitFor();
  const stale = await page.locator('body').innerText();
  assert.ok(stale.includes('Aurora'));
  assert.ok(stale.includes('Saved on this device'));
  assert.ok(!stale.includes('Last confirmed refresh'));
  assert.equal(await page.getByText('Dashboard updated.', { exact: true }).count(), 0);
  await audit('dashboard failed refresh shows labeled device copy');
  await page.screenshot({ path: path.join(output, 'dashboard-stale-copy.png'), fullPage: true });
  await page.unroute('**/api/dashboard');
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click();
  await page.getByText('Dashboard updated.', { exact: true }).waitFor({ state: 'attached' });
  assert.ok((await page.locator('body').innerText()).includes('Last confirmed refresh'));
  passed('T14 refresh error keeps data, labels the device copy as stale and recovers');
  assert.deepEqual(report.browserErrors, []);
  report.success = true;
} catch (error) {
  report.success = false;
  report.error = error.stack;
  if (page) {
    report.renderState = await page.evaluate(() => { const h = document.querySelector('h1'); return { ready: document.readyState, visibility: document.visibilityState, heading: h?.textContent, bounds: h?.getBoundingClientRect().toJSON(), style: h ? getComputedStyle(h).visibility : null }; }).catch(() => null);
    await writeFile(path.join(output, 'failure-body.txt'), await page.locator('body').innerText().catch(() => 'unavailable'));
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true, timeout: 10000 }).catch(() => {});
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
  for (const fixture of children) {
    if (process.platform === 'win32' && fixture.child.pid) {
      await new Promise(resolve => execFile('taskkill.exe', ['/PID', String(fixture.child.pid), '/T', '/F'],
        { windowsHide: true }, resolve));
    } else {
      fixture.child.kill();
      if (fixture.child.exitCode === null) await new Promise(resolve => fixture.child.once('exit', resolve));
    }
    await writeFile(path.join(output, 'fixture-' + fixture.port + '.log'), fixture.log());
  }
  if (path.dirname(fixtureRoot) !== output || !path.basename(fixtureRoot).startsWith('fixtures-')) {
    throw new Error('Unsafe fixture cleanup target');
  }
  await rm(fixtureRoot, { recursive: true, force: true });
}
