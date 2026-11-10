const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];

// default + engineering (group skills) + productivity (group skills), nothing active yet.
function setup(t) {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  h.writePreset(f, 'engineering', [
    { name: 'tdd', source: 'engineering/tdd' },
    { name: 'code-review', source: 'engineering/code-review' },
  ]);
  h.writePreset(f, 'productivity', [{ name: 'grilling', source: 'productivity/grilling' }]);
  h.makeSkill(f, 'tdd', 'engineering');
  h.makeSkill(f, 'code-review', 'engineering');
  h.makeSkill(f, 'grilling', 'productivity');
  return f;
}

test('add plans the preset skills on and turns off managed skills nobody asks for', (t) => {
  const f = setup(t);
  const r = h.run(f, ['add', 'engineering']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /link\s+tdd/);
  assert.match(r.out, /link\s+code-review/);
  assert.match(r.out, /off\s+grilling/);
  assert.doesNotMatch(r.out, /link\s+grilling/);
});

test('add never touches an unassigned skill', (t) => {
  const f = setup(t);
  h.makeSkill(f, 'hand-installed');
  const r = h.run(f, ['add', 'engineering']);
  assert.strictEqual(r.code, 0, r.err);
  assert.doesNotMatch(r.out, /hand-installed/);
});

test('remove keeps skills that another active preset still asks for', (t) => {
  const f = setup(t);
  h.writePreset(f, 'extra', [{ name: 'tdd', source: 'engineering/tdd' }]);
  h.linkSkill(f, 'tdd', path.join(f.root, 'skills', 'engineering', 'tdd'));
  h.linkSkill(f, 'code-review', path.join(f.root, 'skills', 'engineering', 'code-review'));
  h.writeActive(f, ['engineering', 'extra']);
  const r = h.run(f, ['remove', 'engineering']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /unlink\s+code-review/);
  assert.match(r.out, /off\s+code-review/);
  assert.doesNotMatch(r.out, /off\s+tdd/);
  assert.doesNotMatch(r.out, /unlink\s+tdd/);
});

test('default skills are planned on even though default is not in the active list', (t) => {
  const f = setup(t);
  h.writeSettings(f, { skillOverrides: { 'dev-journal': 'off' } });
  const r = h.run(f, ['add', 'engineering']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /on\s+dev-journal/);
});

test('a skill whose source is outside the config folder is linked in place', (t) => {
  const f = setup(t);
  const src = h.makeExternalSkill(f, 'tickets-tree');
  h.writePreset(f, 'custom', [{ name: 'tickets-tree', source: src }]);
  const r = h.run(f, ['add', 'custom']);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(r.out.includes(`link    tickets-tree -> ${src}`), r.out);
});

test('add and remove only plan: the fake config folder is untouched', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'engineering']);
  h.run(f, ['remove', 'engineering']);
  assert.deepStrictEqual(fs.readdirSync(f.root), ['skills']);
  assert.deepStrictEqual(fs.readdirSync(path.join(f.root, 'skills')).sort(), ['engineering', 'productivity']);
});

test('add of an active preset and remove of an inactive one plan nothing', (t) => {
  const f = setup(t);
  h.writeActive(f, ['engineering']);
  const add = h.run(f, ['add', 'engineering']);
  assert.strictEqual(add.code, 0, add.err);
  assert.match(add.out, /already active/);
  assert.doesNotMatch(add.out, /\blink\b/);
  const rem = h.run(f, ['remove', 'productivity']);
  assert.strictEqual(rem.code, 0, rem.err);
  assert.match(rem.out, /not active/);
});

test('add of an unknown preset fails naming it', (t) => {
  const f = setup(t);
  const r = h.run(f, ['add', 'nope']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /nope/);
});

test('a preset naming a skill with a path-like name is refused', (t) => {
  const f = setup(t);
  h.writePreset(f, 'evil', [{ name: '../escape', source: 'top' }]);
  const r = h.run(f, ['status']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /evil\.json/);
});

test('a missing source folder fails naming the skill', (t) => {
  const f = setup(t);
  h.writePreset(f, 'ghost', [{ name: 'ghost-skill', source: 'engineering/ghost-skill' }]);
  const r = h.run(f, ['add', 'ghost']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /ghost-skill/);
});

test('two presets giving the same skill different sources are refused', (t) => {
  const f = setup(t);
  h.writePreset(f, 'dup', [{ name: 'tdd', source: 'elsewhere/tdd' }]);
  const r = h.run(f, ['add', 'engineering']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /tdd/);
});
