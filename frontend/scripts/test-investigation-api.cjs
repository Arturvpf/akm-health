const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'akm-investigation-'));
after(() => {
  for (const file of fs.readdirSync(out)) fs.unlinkSync(path.join(out, file));
  fs.rmdirSync(out);
});
execFileSync(process.execPath, [
  require.resolve('typescript/bin/tsc'), '--target', 'ES2022', '--module', 'CommonJS',
  '--skipLibCheck', '--outDir', out, path.resolve(__dirname, '../src/investigation-api.ts'),
]);
const { readCompatibleMeasurements } = require(path.join(out, 'investigation-api.js'));

const check = { kind: 'co2_ppm', astronaut_id: null, created_at: '2099-11-14T08:00:00.234567Z' };
const reading = (id, recorded_at, overrides = {}) => ({
  id, recorded_at, measured_at: '2099-11-14T07:00:00Z', kind: 'co2_ppm',
  measurement_zone: 'habitat', astronaut_id: null, quality: 'ok', ...overrides,
});
const readings = [
  reading(1, '2099-11-14T08:00:00.234568Z'),
  reading(2, '2099-11-14T08:00:00.234567Z'),
  reading(3, '2099-11-14T08:00:12.999999Z'),
  reading(4, '2099-11-14T08:00:14Z'),
  reading(5, '2099-11-14T08:00:12Z', { measured_at: '2099-11-14T08:00:14Z' }),
  reading(6, '2099-11-14T08:00:12Z', { quality: 'suspect' }),
  reading(7, '2099-11-14T08:00:13.999999Z'),
];

test('uses the API date despite browser clock skew and a one-second HTTP header delay', async t => {
  const date = new Date('2099-11-14T08:00:12Z').toUTCString();
  t.mock.method(global, 'fetch', async () => Response.json(readings, { headers: { Date: date } }));
  const rows = await readCompatibleMeasurements(check, new AbortController().signal);
  assert.deepEqual(rows.map(row => row.id), [7, 3, 1]);
});

test('when the API date is absent, the PATCH is responsible for rejecting future timestamps', async t => {
  t.mock.method(global, 'fetch', async () => Response.json(readings));
  const rows = await readCompatibleMeasurements(check, new AbortController().signal);
  assert.deepEqual(rows.map(row => row.id), [7, 5, 4, 3, 1]);
});
