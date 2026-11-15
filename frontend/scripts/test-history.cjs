const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'akm-history-'));
after(() => {
  for (const file of fs.readdirSync(out)) fs.unlinkSync(path.join(out, file));
  fs.rmdirSync(out);
});
execFileSync(process.execPath, [
  require.resolve('typescript/bin/tsc'), '--target', 'ES2022', '--module', 'CommonJS',
  '--skipLibCheck', '--outDir', out, path.resolve(__dirname, '../src/history-data.ts'),
]);
const { dayStart, readHistory, summarizeSeries } = require(path.join(out, 'history-data.js'));

const filteredSleep = { astronautId: 'A1', kind: 'sleep_hours', start: '2026-11-12', end: '2026-11-19' };
const sample = (id, measured_at, value, quality = 'ok') => ({ id, measured_at, value, quality });

test('missing UTC days, suspect interruptions, zero and multiple observations on the same day', () => {
  const rows = [
    sample(1, '2026-11-13T07:00:00Z', 0),
    sample(2, '2026-11-13T10:00:00Z', 5),
    sample(3, '2026-11-14T07:00:00Z', 9, 'suspect'),
    sample(4, '2026-11-14T08:00:00Z', 5.6),
    sample(5, '2026-11-16T07:00:00Z', 5.8),
    sample(6, '2026-11-16T07:00:00Z', 6),
  ];
  const series = summarizeSeries(rows, filteredSleep);
  assert.equal(series.start, Date.parse('2026-11-12T00:00:00Z'));
  assert.equal(series.end, Date.parse('2026-11-19T23:59:59.999Z'));
  assert.equal(series.minimum, 0);
  assert.equal(series.maximum, 9);
  assert.equal(series.missingDays, 5);
  assert.deepEqual(series.gaps.map(gap => [dayStart(gap.firstDay), dayStart(gap.lastDay)]), [
    ['2026-11-12', '2026-11-12'], ['2026-11-15', '2026-11-15'], ['2026-11-17', '2026-11-19'],
  ].map(range => range.map(date => Date.parse(`${date}T00:00:00Z`))));
  assert.deepEqual(series.segments.map(segment => segment.map(point => point.id)), [[1, 2], [4], [5, 6]]);
  assert.deepEqual(series.suspect.map(point => point.id), [3]);
});

test('one suspect observation defines the implicit extent but contributes no valid point', () => {
  const row = sample(1, '2026-11-14T23:59:59.999999Z', 2200, 'suspect');
  const series = summarizeSeries([row], { astronautId: null, kind: 'co2_ppm', start: '', end: '' });
  assert.equal(series.start, Date.parse(row.measured_at));
  assert.equal(series.end, series.start);
  assert.equal(series.missingDays, 0);
  assert.deepEqual(series.segments, []);
  assert.equal(series.suspect.length, 1);
});

test('reads every page in API order, includes the complete UTC bounds and preserves the signal', async t => {
  const signal = new AbortController().signal;
  const calls = [];
  t.mock.method(global, 'fetch', async (url, options) => {
    const request = new URL(url, 'http://localhost');
    calls.push(request.searchParams);
    assert.equal(request.pathname, '/api/measurements');
    assert.equal(options.signal, signal);
    const offset = Number(request.searchParams.get('offset'));
    return Response.json(Array.from({ length: offset < 200 ? 100 : 1 }, (_, index) => ({ id: offset + index + 1 })));
  });
  const rows = await readHistory(filteredSleep, signal);
  assert.equal(rows.length, 201);
  assert.deepEqual(rows.map(row => row.id), Array.from({ length: 201 }, (_, i) => i + 1));
  assert.deepEqual(calls.map(query => query.get('offset')), ['0', '100', '200']);
  for (const query of calls) {
    assert.equal(query.get('from'), '2026-11-12T00:00:00Z');
    assert.equal(query.get('to'), '2026-11-19T23:59:59.999999Z');
    assert.equal(query.get('astronaut_id'), 'A1');
    assert.equal(query.get('kind'), 'sleep_hours');
    assert.equal(query.get('limit'), '100');
  }
});

test('habitat query omits astronaut_id and blank dates, while failures reject partial data', async t => {
  let count = 0;
  t.mock.method(global, 'fetch', async url => {
    const { searchParams } = new URL(url, 'http://localhost');
    assert.equal(searchParams.get('kind'), 'cabin_temp_c');
    for (const key of ['astronaut_id', 'from', 'to']) assert.equal(searchParams.has(key), false);
    count++;
    return count === 1 ? Response.json(Array(100).fill({ id: 1 })) : new Response('', { status: 503 });
  });
  await assert.rejects(
    readHistory({ astronautId: null, kind: 'cabin_temp_c', start: '', end: '' }, new AbortController().signal),
    /HTTP 503/,
  );
  assert.equal(count, 2);
});
