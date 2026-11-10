const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];

test('status lists no active presets and the known presets', (t) => {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  h.writePreset(f, 'engineering', ['tdd']);
  const r = h.run(f, ['status']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Active presets: \(none\)/);
  assert.match(r.out, /Known presets: default, engineering/);
});

test('status prints the active presets in activation order with their date', (t) => {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  h.writePreset(f, 'engineering', ['tdd']);
  h.writePreset(f, 'productivity', ['grilling']);
  h.writeActive(f, ['productivity', 'engineering']);
  const r = h.run(f, ['status']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Active presets: productivity \(since 2026-11-01\), engineering \(since 2026-11-01\)/);
});

test('status fails naming the file when a preset definition is malformed', (t) => {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  fs.writeFileSync(path.join(f.presets, 'broken.json'), '{ not json');
  const r = h.run(f, ['status']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /broken\.json/);
});

test('status fails when the default preset is missing', (t) => {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'engineering', ['tdd']);
  const r = h.run(f, ['status']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /default/);
});

test('status never writes into the fake config folder', (t) => {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  h.run(f, ['status']);
  assert.deepStrictEqual(fs.readdirSync(f.root), ['skills']);
});
