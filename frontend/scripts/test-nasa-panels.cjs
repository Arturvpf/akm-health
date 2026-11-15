// Server-render the RR-1 radiation and CO2 context panels with synthetic test values (never NASA data).
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
const output = fs.mkdtempSync(path.join(cache, 'akm-nasa-panels-'));
after(() => {
  const resolved = path.resolve(output);
  if (!resolved.startsWith(path.resolve(cache) + path.sep) || !path.basename(resolved).startsWith('akm-nasa-panels-')) {
    throw new Error('Refusing cleanup outside the NASA panel test cache');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
});
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target', 'ES2022',
  '--module', 'CommonJS', '--moduleResolution', 'Node', '--jsx', 'react-jsx', '--esModuleInterop',
  '--skipLibCheck', '--strict', '--outDir', output, path.join(frontend, 'src/NasaReferences.tsx')], { stdio: 'pipe' });
const { RadiationPanel, Co2ContextPanel } = require(path.join(output, 'NasaReferences.js'));

const series = {
  mission_id: 'RR-1', source: 'NASA OSDR Environmental Data Application (EDA)',
  source_url: 'https://visualization.osdr.nasa.gov/eda/', context: 'Synthetic test context.',
  days: [1, 2, 3].map(n => ({ date: `2014-09-${20 + n}`, gcr_mgy_per_day: 0.1 * n, saa_mgy_per_day: 0.05,
    total_mgy_per_day: 0.1 * n + 0.05, accumulated_mgy: n })),
};
const co2 = { mission_id: 'RR-1', source: 'NASA OSDR Environmental Data Application (EDA)',
  source_url: 'https://visualization.osdr.nasa.gov/eda/', context: 'Synthetic test context.',
  period_start: '2014-09-20', period_end: '2014-11-01', sample_count: 3, mean_ppm: 3100, median_ppm: 3100,
  min_ppm: 3000, max_ppm: 3200 };
const render = element => renderToStaticMarkup(element);

test('radiation panel is labeled as historical context, with units per column and cumulative dose in mGy', () => {
  const html = render(React.createElement(RadiationPanel, { series, status: 'imported' }));
  assert.match(html, /ISS cabin radiation during NASA Rodent Research-1 \(2014\) — historical context, not crew dose/);
  assert.match(html, /GCR dose \(mGy\/day\)/);
  assert.match(html, /Accumulated dose \(mGy, cumulative\)/);
  assert.doesNotMatch(html, /Accumulated dose \(mGy\/day\)/);
  assert.match(html, /not doses for the fictional crew/);
  assert.match(html, /Space radiation/);
});

test('missing radiation or CO2 excerpts show an explicit not-imported state without values', () => {
  const radiation = render(React.createElement(RadiationPanel, { series: null, status: 'not_imported' }));
  assert.match(radiation, /has not been imported/);
  assert.doesNotMatch(radiation, /<table|<svg/);
  const context = render(React.createElement(Co2ContextPanel, { context: null, status: 'not_imported' }));
  assert.match(context, /has not been imported/);
  assert.doesNotMatch(context, /<table/);
  assert.match(render(React.createElement(RadiationPanel, { series, status: undefined })), /has not been imported/);
});

test('CO2 context sits beside the fictional habitat reading and is not a safety limit', () => {
  const html = render(React.createElement(Co2ContextPanel, {
    context: co2, status: 'imported', current: { value: 980, measured_at: '2026-11-14T05:00:00Z' } }));
  assert.match(html, /historical context, not a safety limit/);
  assert.match(html, /ODYSSEY-26 habitat, latest reading \(simulated\)/);
  assert.match(html, /<td>980<\/td>/);
  assert.match(html, /does not define an acceptable range/);
  const none = render(React.createElement(Co2ContextPanel, { context: co2, status: 'imported', current: { value: null, measured_at: null } }));
  assert.match(none, /No reading/);
});
