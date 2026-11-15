// Pure logic tests for AKM-34/35, independent of browser and clinical engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'akm-p2-test-'));
try {
  cp.execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target', 'ES2022', '--module', 'CommonJS', '--skipLibCheck', '--outDir', output,
    path.resolve(__dirname, '../src/environment-data.ts'), path.resolve(__dirname, '../src/scenario-data.ts')]);
  const { ENVIRONMENTS, environmentById } = require(path.join(output, 'environment-data.js'));
  const { compareMetric, SAMPLE_PROFILES } = require(path.join(output, 'scenario-data.js'));
  assert.equal(ENVIRONMENTS.length, 4);
  assert.equal(environmentById('invalid').id, 'mars_surface');
  assert.ok(environmentById('mars_surface').gravityRatio < environmentById('earth_analog').gravityRatio);
  assert.equal(environmentById('iss_microgravity').gravityRatio, null); // Never pretend orbital gravity=0
  assert.equal(SAMPLE_PROFILES.find(p => p.id === 'A3').metrics.mood_score, undefined);
  assert.equal(compareMetric('sleep_hours', 5.4, 6.4).difference, 1);
  assert.equal(compareMetric('mood_score', null, 3).difference, null);
  assert.equal(compareMetric('co2_ppm', 980, -1).difference, null);
  assert.equal(compareMetric('mood_score', 3, 3.5).difference, null);
  assert.ok(ENVIRONMENTS.every(e => e.sources.every(s => s.url.startsWith('https://'))));
  console.log('AKM-34/35 pure logic tests: PASS');
} finally { fs.rmSync(output, { recursive: true, force: true }); }
