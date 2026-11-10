const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];

function setup(t) {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  h.writePreset(f, 'engineering', ['tdd']);
  h.writePreset(f, 'productivity', ['grilling']);
  h.writePreset(f, 'usage', [], ['claude-hud@claude-hud']);
  h.installPlugins(f, ['claude-hud@claude-hud']);
  return f;
}

const lines = (out) => out.replace(/\r?\n$/, '').split(/\r?\n/);

test('list prints one preset per line and marks the active ones with a star', (t) => {
  const f = setup(t);
  h.writeActive(f, ['engineering', 'usage']);
  const r = h.run(f, ['list']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(lines(r.out), ['* default (always on)', '* engineering', '  productivity', '* usage']);
});

test('default is starred as always on even when nothing else is active', (t) => {
  const f = setup(t);
  const r = h.run(f, ['list']);
  assert.deepStrictEqual(lines(r.out), ['* default (always on)', '  engineering', '  productivity', '  usage']);
});

test('list --details shows skills and plugins for each preset', (t) => {
  const f = setup(t);
  h.writeActive(f, ['engineering']);
  const r = h.run(f, ['list', '--details']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /engineering: tdd \[active\]/);
  assert.match(r.out, /usage: \(no skills\) \| plugins: claude-hud@claude-hud/);
});

test('list writes nothing', (t) => {
  const f = setup(t);
  h.run(f, ['list']);
  assert.deepStrictEqual(fs.readdirSync(f.root).sort(), ['plugins', 'skills']);
});
