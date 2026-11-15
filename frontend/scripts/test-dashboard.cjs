// API/state tests and real React server rendering, without a browser or mock production data.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test, after } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const frontend = path.resolve(__dirname, '..');
const cache = path.join(frontend, 'node_modules', '.cache');
fs.mkdirSync(cache, { recursive: true });
const output = fs.mkdtempSync(path.join(cache, 'akm-dashboard-'));
after(() => {
  const resolved = path.resolve(output);
  if (!resolved.startsWith(path.resolve(cache) + path.sep) || !path.basename(resolved).startsWith('akm-dashboard-')) {
    throw new Error('Refusing cleanup outside the dashboard test cache');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
});
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target', 'ES2022',
  '--module', 'CommonJS', '--moduleResolution', 'Node', '--jsx', 'react-jsx', '--esModuleInterop',
  '--skipLibCheck', '--strict', '--outDir', output, path.join(frontend, 'src/Dashboard.tsx')], { stdio: 'pipe' });
const { parseDashboard, fetchDashboard, nasaReferenceUrl } = require(path.join(output, 'api.js'));
const { createDashboardController, INITIAL_DASHBOARD_STATE } = require(path.join(output, 'dashboard-state.js'));
const { DashboardView } = require(path.join(output, 'Dashboard.js'));

const stamp = '2026-11-14T08:00:00Z';
function snapshot() {
  return {
    mission: { name: 'Missão de teste', day: 184, destination: 'mars_surface', gravity_g_reference: 0.378,
      context_source_url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/', demo_only: true },
    astronauts: [{ id: 'A1', name: 'Aurora', status: 'attention', latest_metrics: {
      sleep_hours: { value: 5.4, unit: 'h', measured_at: stamp, source: 'synthetic' },
      heart_rate_bpm: { value: 72, unit: 'bpm', measured_at: stamp, source: 'manual' },
    } }],
    environment: { co2_ppm: 980, cabin_temp_c: 0, measured_at: stamp, measurement_zone: 'habitat', latest_metrics: {
      co2_ppm: { value: 980, unit: 'ppm', measured_at: '2026-11-14T05:00:00Z', source: 'synthetic' },
      cabin_temp_c: { value: 0, unit: 'C', measured_at: stamp, source: 'manual' },
    } },
    alerts: [{ id: 7, level: 'attention', label: 'Achado registrado', explanation: 'Explicação retornada pelo servidor.' }],
    pending_followups: [{ id: 9, investigation_id: 7, astronaut_id: null, kind: 'co2_ppm',
      reason: 'Conferir nova leitura.', status: 'pending', due_at: null, created_at: stamp,
      completed_at: null, measurement_id: null }],
    last_investigation_at: stamp, has_unanalyzed_measurements: true,
  };
}
function render(data, extra = {}) {
  return renderToStaticMarkup(React.createElement(DashboardView, {
    state: { data, phase: 'ready', error: null, receivedAt: stamp, ...extra }, onRefresh() {},
  }));
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('API client uses only GET dashboard and validates the received body', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => snapshot() };
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await fetchDashboard(signal), snapshot());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/dashboard');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.signal, signal);
  assert.equal(calls[0].options.cache, 'no-store');
});

test('HTTP failure and malformed JSON never create fallback data', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  await assert.rejects(fetchDashboard(new AbortController().signal), /Não foi possível/);
  globalThis.fetch = async () => ({ ok: true, json: async () => { throw new Error('HTML proxy response'); } });
  await assert.rejects(fetchDashboard(new AbortController().signal), /resposta inválida/);
});

test('network errors are explained without exposing browser implementation text', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(fetchDashboard(new AbortController().signal), /conectar ao servidor da missão/);
});

test('invalid response fields are rejected instead of inventing a status or observation', () => {
  for (const mutate of [
    data => { data.astronauts[0].status = 'healthy'; },
    data => { data.astronauts[0].latest_metrics.sleep_hours.value = NaN; },
    data => { data.astronauts[0].latest_metrics.sleep_hours.source = 'NASA'; },
    data => { data.astronauts[0].latest_metrics.sleep_hours.unit = 'ppm'; },
    data => { data.has_unanalyzed_measurements = 'false'; },
    data => { data.pending_followups[0].kind = 'toString'; },
    data => { data.pending_followups[0].status = 'completed'; },
    data => { data.last_investigation_at = '2026-11-14T08:00:00'; },
    data => { data.environment = null; },
  ]) {
    const data = snapshot(); mutate(data);
    assert.throws(() => parseDashboard(data), /inválidos/);
  }
  assert.throws(() => parseDashboard(null), /inválidos/);
});

test('render uses API names, values, origins, independent timestamps, pending reason and freshness', () => {
  const html = render(parseDashboard(snapshot()));
  for (const text of ['Missão de teste', 'Aurora', '5,4', '72', '0', 'Dado simulado', 'Registro manual',
    'Conferir nova leitura.', 'Achado registrado', 'Explicação retornada pelo servidor.',
    'Novas medições disponíveis', '2026-11-14T05:00:00Z', '2026-11-14T08:00:00Z',
    'NASA references', 'Mission destination · Mars surface', 'NASA planetary fact sheet']) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(html.includes('0 °C'));
  assert.ok(html.includes('Bem-estar emocional'));
  assert.ok(html.includes('Sem registro'));
  assert.ok(html.includes('Padrão experimental a verificar'));
  assert.ok(!html.includes('Orion'));
});

test('before a persisted investigation no motor assessment or alert is presented', () => {
  const data = snapshot();
  data.last_investigation_at = null;
  const html = render(data);
  assert.ok(html.includes('Nenhuma investigação executada'));
  assert.ok(html.includes('Não avaliado pelo motor'));
  assert.ok(!html.includes('Achado registrado'));
  assert.ok(!html.includes('Explicação retornada pelo servidor.'));
});

test('empty storage and absent observations remain explicit; old API metadata is not invented', () => {
  const data = snapshot();
  data.astronauts = []; data.alerts = []; data.pending_followups = [];
  data.environment = { co2_ppm: null, cabin_temp_c: null, measured_at: null, measurement_zone: 'habitat' };
  data.last_investigation_at = null; data.has_unanalyzed_measurements = false;
  const html = render(parseDashboard(data));
  assert.ok(html.includes('Não há tripulantes cadastrados'));
  assert.ok(html.includes('Nenhuma verificação pendente'));
  assert.ok(html.includes('Sem registro'));
  assert.ok(!html.includes('Novas medições disponíveis'));
  data.environment.co2_ppm = 0;
  const legacy = render(parseDashboard(data));
  assert.ok(legacy.includes('0 ppm'));
  assert.ok(legacy.includes('Origem não informada'));
  assert.ok(legacy.includes('Horário individual não informado'));
});

test('reserved critical status is never converted into a synthetic live red alarm', () => {
  const data = snapshot(); data.astronauts[0].status = 'critical'; data.alerts = [];
  const html = render(parseDashboard(data));
  assert.ok(html.includes('Estado reservado de protocolo informado pela API'));
  assert.equal((html.match(/ds-badge-protocol/g) ?? []).length, 1); // Legend only.
});

test('NASA reference links require HTTPS and an actual NASA hostname', () => {
  for (const value of ['javascript:alert(1)', 'http://nasa.gov/', 'https://nasa.gov.evil.example/', 'https://user:pass@nasa.gov/']) {
    assert.equal(nasaReferenceUrl(value), null);
  }
  assert.equal(nasaReferenceUrl('https://www.nasa.gov/hrp/'), 'https://www.nasa.gov/hrp/');
  const data = snapshot(); data.mission.context_source_url = 'javascript:alert(1)';
  const html = render(data);
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('The planetary fact sheet link is unavailable.'));
});

test('refresh keeps confirmed data through loading and failure, then allows recovery', async () => {
  const next = deferred(); let call = 0;
  const controller = createDashboardController(async () => {
    ++call;
    if (call === 2) return next.promise;
    const data = snapshot();
    if (call === 3) data.mission.name = 'Consulta recuperada';
    return data;
  });
  await controller.refresh();
  const confirmed = controller.getState();
  const pending = controller.refresh();
  assert.equal(controller.getState().phase, 'loading');
  assert.equal(controller.getState().data, confirmed.data);
  next.reject(new Error('Falha de teste'));
  await pending;
  assert.equal(controller.getState().phase, 'error');
  assert.equal(controller.getState().data, confirmed.data);
  assert.equal(controller.getState().receivedAt, confirmed.receivedAt);
  const html = render(confirmed.data, controller.getState());
  assert.ok(html.includes('role="alert"'));
  assert.ok(html.includes('última consulta confirmada'));
  assert.ok(html.includes('Tentar novamente'));
  await controller.refresh();
  assert.equal(controller.getState().phase, 'ready');
  assert.equal(controller.getState().error, null);
  assert.equal(controller.getState().data.mission.name, 'Consulta recuperada');
  controller.dispose();
});

test('initial loading/error has no mock astronauts or invented measurements', async () => {
  assert.ok(render(null, INITIAL_DASHBOARD_STATE).includes('Consultando os dados'));
  const controller = createDashboardController(async () => { throw new Error('Sem servidor'); });
  await controller.refresh();
  const html = render(null, controller.getState());
  assert.ok(html.includes('Sem servidor'));
  assert.ok(!html.includes('Aurora'));
  assert.equal(controller.getState().data, null);
  controller.dispose();
});

test('a late previous response cannot overwrite the newest successful refresh', async () => {
  const first = deferred(), second = deferred(); let call = 0; const signals = [];
  const controller = createDashboardController(signal => {
    signals.push(signal); return ++call === 1 ? first.promise : second.promise;
  });
  const old = controller.refresh(); const newest = controller.refresh();
  assert.equal(signals[0].aborted, true);
  const latest = snapshot(); latest.mission.name = 'Mais recente';
  second.resolve(latest); await newest;
  first.resolve(snapshot()); await old;
  assert.equal(controller.getState().data.mission.name, 'Mais recente');
  controller.dispose();
});

test('failure of an older request cannot replace a newer successful result', async () => {
  const first = deferred(), second = deferred(); let call = 0;
  const controller = createDashboardController(() => ++call === 1 ? first.promise : second.promise);
  const old = controller.refresh(); const newest = controller.refresh();
  second.resolve(snapshot()); await newest;
  first.reject(new Error('Erro atrasado')); await old;
  assert.equal(controller.getState().phase, 'ready');
  assert.equal(controller.getState().error, null);
  controller.dispose();
});

test('disposing aborts the request and prevents updates after navigation away', async () => {
  const response = deferred(); let signal; let updates = 0;
  const controller = createDashboardController(value => { signal = value; return response.promise; });
  controller.subscribe(() => ++updates);
  const pending = controller.refresh();
  controller.dispose(); const atDispose = updates;
  assert.equal(signal.aborted, true);
  response.resolve(snapshot()); await pending;
  assert.equal(updates, atDispose);
  await controller.refresh();
  assert.equal(updates, atDispose);
});

test('a transport that ignores abort still times out without making up a response', async () => {
  let signal;
  const controller = createDashboardController(value => { signal = value; return new Promise(() => {}); }, 10);
  await controller.refresh();
  assert.equal(signal.aborted, true);
  assert.equal(controller.getState().phase, 'error');
  assert.match(controller.getState().error, /tempo de espera/);
  assert.equal(controller.getState().data, null);
  controller.dispose();
});
