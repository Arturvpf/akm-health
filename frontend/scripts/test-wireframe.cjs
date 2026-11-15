// Exercise the actual inline prototype script through its registered UI events.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../public/akm-10-wireframe.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function prototype() {
  const elements = new Map();
  let now = Date.parse('2026-11-15T08:00:00Z');
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: '', handlers: {}, contains: () => false, setAttribute() {}, focus() {},
      addEventListener(event, handler) { this.handlers[event] = handler; },
    });
    return elements.get(selector);
  }
  vm.runInNewContext(script, {
    Date: Clock, window: { scrollTo() {} },
    document: { activeElement: null, querySelector: element, getElementById: id => element('#' + id) },
  });
  const main = element('#main-content');
  return {
    get content() { return main.innerHTML; },
    click(action, investigation) {
      main.handlers.click({ target: { closest: () => ({ dataset: { action, investigation } }) } });
    },
    change(id, value) { main.handlers.change({ target: { id, value } }); },
    navigate(page) {
      element('#navigation').handlers.click({ target: { closest: () => ({ dataset: { nav: page } }) } });
    },
    mode(value) { element('#demo-mode').handlers.change({ target: { value } }); },
    saveRecheck() {
      now += 1000;
      main.handlers.submit({ target: { id: 'measurement-form' }, preventDefault() {} });
    },
  };
}

function pendingCount(app) {
  app.navigate('dashboard');
  const count = app.content.match(/Verificações pendentes<\/div><div class="v">(\d+)<\/div>/);
  assert.ok(count, 'Dashboard must expose its pending count');
  return Number(count[1]);
}

test('collective pending check stays visible after selecting a normal individual', () => {
  const app = prototype();
  app.click('run-analysis');
  app.change('scope', 'individual');
  app.change('invest-subject', 'A4');
  app.click('run-analysis');
  assert.equal(pendingCount(app), 1);
  assert.match(app.content, /CO₂ da cabine/);
  assert.doesNotMatch(app.content, /Sem solicitações pendentes/);
  app.click('open-followup', 'crew');
  assert.match(app.content, /value="crew" selected/);
  assert.match(app.content, /Solicitação: CO₂ da cabine/);
});

test('dashboard counts each scope once and opens its exact individual subject', () => {
  const app = prototype();
  app.click('run-analysis');
  app.change('scope', 'individual');
  app.click('run-analysis');
  app.change('invest-subject', 'A2');
  app.click('run-analysis');
  assert.equal(pendingCount(app), 3);
  app.click('open-followup', 'A1');
  assert.match(app.content, /value="individual" selected/);
  assert.match(app.content, /value="A1" selected/);
  assert.match(app.content, /Solicitação: Horas de sono/);
  assert.equal(pendingCount(app), 3);
  app.click('open-followup', 'A2');
  assert.match(app.content, /value="A2" selected/);
  assert.equal(pendingCount(app), 3);
});

test('completion removes only its check and simulated failure preserves the remainder', () => {
  const app = prototype();
  app.click('run-analysis');
  app.change('scope', 'individual');
  app.click('run-analysis');
  assert.equal(pendingCount(app), 2);
  app.click('open-followup', 'crew');
  app.click('create-recheck');
  app.saveRecheck();
  app.click('to-investigate');
  app.mode('offline');
  app.click('complete-followup');
  assert.equal(pendingCount(app), 2);
  app.mode('base');
  app.click('open-followup', 'crew');
  app.click('complete-followup');
  assert.equal(pendingCount(app), 1);
  assert.doesNotMatch(app.content, /data-investigation="crew"/);
  assert.match(app.content, /data-investigation="A1"/);
  app.click('open-followup', 'A1');
  assert.match(app.content, /Solicitação: Horas de sono/);
});

test('changing the data scenario clears the pending summary', () => {
  const app = prototype();
  app.click('run-analysis');
  assert.equal(pendingCount(app), 1);
  app.mode('empty');
  assert.equal(pendingCount(app), 0);
  assert.match(app.content, /Sem solicitações pendentes/);
});
