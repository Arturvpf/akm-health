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
const output = fs.mkdtempSync(path.join(cache, 'akm-registration-'));
after(() => {
  if (!path.resolve(output).startsWith(path.resolve(cache) + path.sep) || !path.basename(output).startsWith('akm-registration-')) throw new Error('Invalid cleanup target');
  fs.rmSync(output, { recursive: true, force: true });
});
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target', 'ES2022', '--module', 'CommonJS', '--moduleResolution', 'Node', '--jsx', 'react-jsx', '--esModuleInterop', '--skipLibCheck', '--strict', '--outDir', output, path.join(frontend, 'src/MeasurementForm.tsx')], { stdio: 'pipe' });
const { validateDraft, measurementTime, EMPTY_DRAFT, FORM_METRICS, draftAfterSubmission } = require(path.join(output, 'measurement-form.js'));
const { saveMeasurement, parseMeasurement, createRegistrationController, INITIAL_REGISTRATION, RegistrationError } = require(path.join(output, 'measurement-api.js'));
const { MeasurementFormView } = require(path.join(output, 'MeasurementForm.js'));
const draft = (extra = {}) => ({ ...EMPTY_DRAFT, astronaut: 'A1', value: '5,2', localTime: '2026-11-14T11:00', offset: '-03:00', ...extra });
const payload = () => validateDraft(draft(), ['A1']).payload;
const receipt = () => ({ ...payload(), id: 42, measurement_zone: 'astronaut', recorded_at: '2026-11-15T00:00:00Z' });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const context = { phase: 'ready', error: null, receivedAt: null, data: { mission: { name: 'TEST-26' }, astronauts: [{ id: 'A1', name: 'Test' }] } };
const render = (extra = {}) => renderToStaticMarkup(React.createElement(MeasurementFormView, { context, registration: INITIAL_REGISTRATION, draft: draft(), errors: {}, onChange() {}, onSubmit() {}, onRefresh() {}, onUnlock() {}, onNew() {}, ...extra }));
test('all five metrics produce canonical target, unit, provenance and UTC payload', () => {
  for (const [kind, metric] of Object.entries(FORM_METRICS)) {
    const result = validateDraft(draft({ kind, value: kind === 'mood_score' ? '3' : kind === 'heart_rate_bpm' ? '70' : '0.5' }), ['A1']);
    assert.deepEqual(result.errors, {});
    assert.equal(result.payload.unit, metric.unit);
    assert.equal(result.payload.astronaut_id, metric.zone === 'habitat' ? null : 'A1');
    assert.equal(result.payload.measured_at, '2026-11-14T14:00:00.000Z');
    assert.equal(result.payload.source, 'manual');
    assert.ok(!('measurement_zone' in result.payload));
    assert.ok(!('recorded_at' in result.payload));
  }
  assert.equal(payload().value, 5.2);
});
test('technical ranges reject missing and nonfinite data, preserve true zeros and negative temperature', () => {
  for (const value of ['', ' ', 'NaN', 'Infinity', '1e999', '1,000.5', '0x10', '--1']) assert.ok(validateDraft(draft({ value }), ['A1']).errors.value, value);
  for (const [kind, value] of [['sleep_hours','-1'],['sleep_hours','24.1'],['heart_rate_bpm','0'],['heart_rate_bpm','19'],['heart_rate_bpm','251'],['co2_ppm','40001'],['cabin_temp_c','-21'],['cabin_temp_c','61'],['mood_score','3.5'],['mood_score','6'],['co2_ppm','-1']]) assert.ok(validateDraft(draft({kind,value}), ['A1']).errors.value);
  for (const [kind,value] of [['sleep_hours','0'],['sleep_hours','24'],['co2_ppm','0'],['cabin_temp_c','-20'],['heart_rate_bpm','250'],['heart_rate_bpm','20'],['co2_ppm','40000'],['cabin_temp_c','60']]) assert.ok(validateDraft(draft({kind,value}), ['A1']).payload);
  assert.ok(validateDraft(draft({astronaut:'missing'}), ['A1']).errors.astronaut);
  assert.ok(validateDraft(draft({kind:'co2_ppm'}), []).payload);
});
test('timestamps validate calendar, timezone and year bounds without local-time inference', () => {
  assert.equal(measurementTime('2026-02-30T08:00', '+00:00'), null);
  assert.equal(measurementTime('2026-11-14T24:00', '+00:00'), null);
  for (const offset of ['', 'Z', '-3:00', '+24:00', '+00:60']) assert.equal(measurementTime('2026-11-14T08:00',offset), null);
  assert.equal(measurementTime('2024-02-29T23:30', '-03:00'), '2024-03-01T02:30:00.000Z');
});
test('save uses one POST and returns only validated matching confirmation', async t => {
  let calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({url,options}); return { status:201, json:async()=>receipt() }; });
  assert.deepEqual(await saveMeasurement(payload(), new AbortController().signal), receipt());
  assert.equal(calls.length,1); assert.equal(calls[0].url,'/api/measurements'); assert.equal(calls[0].options.method,'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body),payload());
});
test('422 identifies rejected field and 404 demands profile refresh; neither is a success', async t => {
  t.mock.method(globalThis, 'fetch',async()=>({status:422,json:async()=>({detail:[{loc:['body','value'],msg:'bad'}]})}));
  await assert.rejects(saveMeasurement(payload(), new AbortController().signal),e=>e instanceof RegistrationError && !e.uncertain && !!e.fields.value);
  globalThis.fetch=async()=>({status:404});
  await assert.rejects(saveMeasurement(payload(), new AbortController().signal),e=>e.missingAstronaut && !e.uncertain);
});
test('network, unexpected status, bad JSON and mismatched receipt all require history verification', async t => {
  t.mock.method(globalThis, 'fetch',async()=>{throw new Error('network');});
  for (const response of [null, {status:500}, {status:200}, {status:201,json:async()=>{throw new Error('bad JSON');}}, {status:201,json:async()=>({...receipt(),value:100})}, {status:201,json:async()=>({...receipt(),source:'NASA'})}]) {
    globalThis.fetch=async()=>{if(!response)throw new Error('network'); return response;};
    await assert.rejects(saveMeasurement(payload(),new AbortController().signal),e=>e.uncertain && /History/.test(e.message));
  }
  assert.throws(()=>parseMeasurement({...receipt(),measurement_zone:'habitat'}));
});
test('single flight and saved state prevent duplicate submissions until explicit new record', async () => {
  const pending=deferred(); let calls=0;
  const c=createRegistrationController(async()=>{calls++;return pending.promise;});
  const first=c.submit(payload()); await c.submit(payload()); assert.equal(calls,1);
  pending.resolve(receipt()); await first; assert.equal(c.getState().phase,'saved');
  await c.submit(payload()); assert.equal(calls,1); c.reset(); await c.submit(payload()); assert.equal(calls,2);c.dispose();
});
test('timeout remains uncertain when a late response arrives and cannot resubmit before explicit unlock', async () => {
  const pending=deferred();let calls=0;
  const c=createRegistrationController(async()=>{calls++;return pending.promise;},5);
  await c.submit(payload());assert.equal(c.getState().phase,'uncertain');
  pending.resolve(receipt());await Promise.resolve();assert.equal(c.getState().receipt,null);
  await c.submit(payload());assert.equal(calls,1);c.dispose();
});
test('unmount ignores an eventual confirmation and aborts the active transport', async () => {
  const pending=deferred();let signal;const c=createRegistrationController(async(_p,s)=>{signal=s;return pending.promise;});
  let updates=0;c.subscribe(()=>updates++);const job=c.submit(payload());c.dispose();assert.equal(signal.aborted,true);pending.resolve(receipt());await job;assert.equal(updates,1);
});
test('validation rejection preserves retry capability without automatic retry', async () => {
  let calls=0;const c=createRegistrationController(async()=>{calls++;throw new RegistrationError('Review',false,{value:'Invalid'});});
  await c.submit(payload());assert.equal(c.getState().phase,'error');assert.equal(calls,1);await c.submit(payload());assert.equal(calls,2);c.dispose();
});
test('render labels, inline errors, instructions, provenance and explicit timezone are accessible', () => {
  const html=render({errors:{value:'Enter a value'}});
  for(const text of ['measurement-value','aria-invalid="true"','error-value','measurement-instructions','UTC offset','MED-SLEEP','Manual demo entry','Valid for analysis','TEST-26','Test · A1']) assert.ok(html.includes(text),text);
  assert.ok(!html.includes('value="NASA"'));
  const mood=render({draft:draft({kind:'mood_score',value:'3'})});for(const label of ['Very poor','Poor','Neutral','Good','Very good']) assert.ok(mood.includes(label));
  const habitat=render({draft:draft({kind:'co2_ppm'})});assert.ok(!habitat.includes('id="measurement-astronaut"'));assert.ok(habitat.includes('Habitat · cabin air'));
});
test('empty crew permits habitat and blocks personal; loading and failure retain draft', () => {
  const empty={...context,data:{...context.data,astronauts:[]}};
  assert.ok(render({context:empty}).includes('No crew profiles are available'));
  assert.match(render({context:empty}),/type="submit" disabled/);
  assert.doesNotMatch(render({context:empty,draft:draft({kind:'co2_ppm'})}),/type="submit" disabled/);
  for(const phase of ['loading','error']){const html=render({context:{...context,phase,error:'Failed'}});assert.ok(html.includes('value="5,2"'));assert.match(html,/fieldset disabled/);}
});
test('uncertain UI locks fields with explicit history check, confirmed receipt separates recorded time and analysis', () => {
  const uncertain=render({registration:{...INITIAL_REGISTRATION,phase:'uncertain',error:'Check the history'}});
  assert.match(uncertain,/fieldset disabled/);assert.ok(uncertain.includes('the reading is missing'));assert.ok(uncertain.includes('target="_blank"'));
  const saved=render({registration:{...INITIAL_REGISTRATION,phase:'saved',receipt:receipt()}});
  for(const text of ['#42','2026-11-14T14:00:00.000Z','2026-11-15T00:00:00Z','Measurement saved.','Review saved readings in History','Register another measurement'])assert.ok(saved.includes(text),text);
  assert.ok(!saved.includes('<form'));
});

test('real API accepts frontend payloads, receipts render, history updates and no investigation runs on save', () => {
  const payloads = Object.keys(FORM_METRICS).map((kind,index) => validateDraft(draft({kind,value:kind === 'mood_score' ? '3' : kind === 'heart_rate_bpm' ? '70' : kind === 'cabin_temp_c' ? '-2' : '0.5', source:index % 2 ? 'synthetic':'manual',quality:kind === 'cabin_temp_c' ? 'suspect':'ok'}),['A1']).payload);
  const python = process.env.PYTHON || path.join(frontend,'..','.venv',process.platform === 'win32' ? 'Scripts/python.exe':'bin/python');
  const source = [
    'import json, os, sys, tempfile',
    'from pathlib import Path',
    'sys.path.insert(0, sys.argv[1])',
    'from fastapi.testclient import TestClient',
    'from sqlalchemy import text',
    'from app.main import app',
    'from app.seed import seed',
    'payloads = json.load(sys.stdin)',
    'with tempfile.TemporaryDirectory(prefix="akm14-contract-") as temporary:',
    '    os.environ["AKM_DB_PATH"] = str(Path(temporary) / "test.db")',
    '    with TestClient(app) as client:',
    '        seed(app.state.engine)',
    '        result = client.post("/api/investigations/run", json={"scope":"crew"})',
    '        assert result.status_code == 200, result.text',
    '        def counts():',
    '            with app.state.engine.connect() as conn:',
    '                return [conn.execute(text("SELECT count(*) FROM " + table)).scalar() for table in ("investigations", "followups")]',
    '        before = counts()',
    '        receipts = []',
    '        for payload in payloads:',
    '            response = client.post("/api/measurements", json=payload)',
    '            assert response.status_code == 201, response.text',
    '            receipt = response.json()',
    '            history = client.get("/api/measurements", params={"kind":payload["kind"]}).json()',
    '            assert receipt in history',
    '            receipts.append(receipt)',
    '        dashboard = client.get("/api/dashboard").json()',
    '        assert dashboard["has_unanalyzed_measurements"] is True',
    '        assert counts() == before',
    '        print(json.dumps({"receipts":receipts,"dashboard":dashboard},ensure_ascii=True))',
  ].join('\n');
  const result = JSON.parse(execFileSync(python,['-c',source,path.join(frontend,'..','backend')],{input:JSON.stringify(payloads),encoding:'utf8',stdio:['pipe','pipe','pipe']}));
  assert.equal(result.receipts.length,5);
  for(let index=0;index<result.receipts.length;index++) {
    const saved=parseMeasurement(result.receipts[index]);assert.equal(saved.kind,payloads[index].kind);
    const html=render({registration:{...INITIAL_REGISTRATION,phase:'saved',receipt:saved}});
    assert.ok(html.includes('Measurement #'+saved.id+' confirmed'));assert.ok(html.includes(saved.measured_at));assert.ok(html.includes(saved.recorded_at));
  }
});

test('a submitted reading never survives as a reusable draft; only the metric is kept', () => {
  const submitted = draft({ kind: 'co2_ppm', astronaut: '', value: '850', source: 'synthetic', quality: 'suspect' });
  const next = draftAfterSubmission(submitted);
  assert.deepEqual(next, { ...EMPTY_DRAFT, kind: 'co2_ppm' });
  assert.equal(next.value, '');
  assert.equal(next.localTime, '');
  assert.equal(validateDraft(next, ['A1']).payload, null);
});

test('a server validation rejection is not labeled as a connection problem', () => {
  const html = render({ registration: { ...INITIAL_REGISTRATION, phase: 'error', error: 'Review the highlighted field and try again.', fields: { quality: 'Check the quality.' } }, errors: { quality: 'Check the quality.' } });
  assert.ok(html.includes('Review the highlighted field and try again.'));
  assert.ok(!html.includes('Connection error'));
});
test('an observation time in the future is rejected, a few minutes of drift is allowed', () => {
  const at = ms => new Date(Date.now() + ms).toISOString().slice(0, 16);
  assert.ok(validateDraft(draft({ localTime: at(3 * 3600_000), offset: '+00:00' }), ['A1']).errors.localTime);
  assert.deepEqual(validateDraft(draft({ localTime: at(2 * 60_000), offset: '+00:00' }), ['A1']).errors, {});
});
