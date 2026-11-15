/* Deterministic outbox test using a minimal IndexedDB transaction model. The real-browser test remains mandatory. */
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'akm-offline-'));
const buckets = new Map();
function tick(fn) { setTimeout(fn, 0); }
function database() {
  return {
    objectStoreNames: { contains(name) { return buckets.has(name); } },
    createObjectStore(name) { buckets.set(name, new Map()); },
    transaction(name) {
      const tx = {
        objectStore() {
          const bucket = buckets.get(name);
          function request(fn) {
            const req = { onsuccess: null, result: undefined };
            tick(() => {
              req.result = fn();
              if (req.onsuccess) req.onsuccess();
              tick(() => { if (tx.oncomplete) tx.oncomplete(); });
            });
            return req;
          }
          return {
            add(value) { return request(() => { assert(!bucket.has(value.id)); bucket.set(value.id, value); return value.id; }); },
            put(value) { return request(() => { const key = value.id ?? value.key; bucket.set(key, value); return key; }); },
            delete(key) { return request(() => bucket.delete(key)); },
            get(key) { return request(() => bucket.get(key)); },
            getAll() { return request(() => [...bucket.values()]); },
          };
        }, close() {},
      };
      return tx;
    }, close() {},
  };
}
const db = database();
globalThis.indexedDB = {
  open() {
    const request = { result: db, onsuccess: null, onupgradeneeded: null };
    tick(() => { if (request.onupgradeneeded) request.onupgradeneeded(); if (request.onsuccess) request.onsuccess(); });
    return request;
  },
};
globalThis.window = { dispatchEvent() {} };
globalThis.Event = class { constructor(name) { this.type = name; } };

(async () => {
  try {
    cp.execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target', 'ES2022', '--module', 'CommonJS',
      '--skipLibCheck', '--outDir', out, path.resolve(__dirname, '../src/offline-store.ts')], { stdio: 'pipe' });
    const store = require(path.join(out, 'offline-store.js'));
    const payload = { kind: 'co2_ppm', unit: 'ppm', value: 950, measured_at: '2026-11-14T10:00:00Z', source: 'synthetic' };
    const first = await store.enqueueMeasurement(payload);
    assert.equal((await store.listOutbox())[0].id, first.id);
    globalThis.fetch = async () => { throw new Error('Connection dropped'); };
    let result = await store.synchronizeOutbox();
    assert.equal(result.pending, 1);
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.equal(body.operation_id, first.id);
      return { status: 200, json: async () => ({ operation_id: body.operation_id, reused: true,
        measurement: { id: 7, ...payload, astronaut_id: null, measurement_zone: 'habitat', quality: 'ok', recorded_at: '2026-11-14T10:01:00Z' } }) };
    };
    result = await store.synchronizeOutbox();
    assert.equal(result.pending, 0);
    assert.equal(result.confirmed[first.id].id, 7);
    assert.equal(calls, 1);
    assert.deepEqual(await store.listOutbox(), []);
    await store.rememberSnapshot('dashboard', { demo: true });
    assert.deepEqual(await store.cachedRead('dashboard', async () => { throw new Error('offline'); }), { demo: true });
    const second = await store.enqueueMeasurement(payload);
    globalThis.fetch = async () => ({ status: 409 });
    result = await store.synchronizeOutbox();
    assert.equal(result.conflicts, 1);
    assert.equal((await store.listOutbox())[0].id, second.id);
    assert.equal((await store.listOutbox())[0].status, 'conflict');
    // A live 422 for a new registration is returned to the form and never left as a phantom offline item.
    await store.removeOutbox(second.id);
    globalThis.fetch = async () => ({ status: 422, json: async () => ({ detail: [{ loc: ['body', 'measurement', 'value'], msg: 'out of range' }] }) });
    const live = await store.storeThenSync(payload);
    assert.equal(live.receipt, null);
    assert.equal(live.rejection.status, 422);
    assert.equal(live.rejection.body.detail[0].loc.at(-1), 'value');
    assert.deepEqual(await store.listOutbox(), []);
    console.log('AKM-33 in-memory IndexedDB outbox tests: PASS');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
