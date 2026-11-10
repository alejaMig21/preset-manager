const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];

function setup(t) {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  h.writePreset(f, 'engineering', [{ name: 'tdd', source: 'engineering/tdd' }]);
  h.makeSkill(f, 'tdd', 'engineering');
  return f;
}

test('orphans lists installed skills that no preset names, groups included', (t) => {
  const f = setup(t);
  h.makeSkill(f, 'grilling', 'productivity'); // in a group, never linked
  h.makeSkill(f, 'hand-installed'); // real top-level folder
  h.makeSkill(f, 'dev-journal'); // managed by default
  const r = h.run(f, ['orphans']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /grilling/);
  assert.match(r.out, /hand-installed/);
  assert.doesNotMatch(r.out, /dev-journal/);
  assert.doesNotMatch(r.out, /\btdd\b/);
});

test('a skill linked from outside the config folder counts as installed', (t) => {
  const f = setup(t);
  h.linkSkill(f, 'tickets-tree', h.makeExternalSkill(f, 'tickets-tree'));
  const r = h.run(f, ['orphans']);
  assert.match(r.out, /tickets-tree/);
});

test('orphans says so when every installed skill has a preset', (t) => {
  const f = setup(t);
  const r = h.run(f, ['orphans']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /No unassigned skills/);
});

test('status always shows the unassigned skills', (t) => {
  const f = setup(t);
  assert.match(h.run(f, ['status']).out, /Unassigned skills: \(none\)/);
  h.makeSkill(f, 'hand-installed');
  assert.match(h.run(f, ['status']).out, /Unassigned skills: hand-installed/);
});

test('status reports a junction whose source folder was removed', (t) => {
  const f = setup(t);
  const src = h.makeExternalSkill(f, 'tickets-tree');
  h.linkSkill(f, 'tickets-tree', src);
  assert.match(h.run(f, ['status']).out, /Broken junctions: \(none\)/);
  fs.rmSync(src, { recursive: true });
  const r = h.run(f, ['status']);
  assert.match(r.out, /Broken junctions: tickets-tree/);
});

test('orphans and status write nothing', (t) => {
  const f = setup(t);
  h.makeSkill(f, 'hand-installed');
  h.run(f, ['orphans']);
  h.run(f, ['status']);
  assert.deepStrictEqual(fs.readdirSync(f.root), ['skills']);
  assert.ok(fs.existsSync(path.join(f.root, 'skills', 'hand-installed', 'SKILL.md')));
});
