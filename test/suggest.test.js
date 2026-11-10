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
  return f;
}

// The block of output that belongs to one skill: from its name line to the next skill or the end.
const section = (out, name) => {
  const lines = out.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`${name}\n`) || l === name);
  assert.ok(start >= 0, `no section for ${name} in:\n${out}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l && !l.startsWith(' '));
  return rest.slice(0, end < 0 ? rest.length : end).join('\n');
};

test('a skill from the same group folder points at the presets that already use that folder', (t) => {
  const f = setup(t);
  h.writePreset(f, 'design_ui', [{ name: 'ui-kit', source: 'design/ui-kit' }]);
  h.makeSkill(f, 'ui-kit', 'design');
  h.makeSkill(f, 'new-thing', 'design');
  const r = h.run(f, ['suggest']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(section(r.out, 'new-thing'), /same folder.*design_ui/i);
});

test('a skill sharing a name start with a preset skill points at that preset', (t) => {
  const f = setup(t);
  h.writePreset(f, 'productivity', [{ name: 'grill-me', source: 'top' }]);
  h.makeSkill(f, 'grill-me');
  h.makeSkill(f, 'grill-lite');
  const r = h.run(f, ['suggest']);
  assert.match(section(r.out, 'grill-lite'), /same name start.*productivity/i);
});

test('a similar description is reported with a score and the unrelated one is not', (t) => {
  const f = setup(t);
  h.writePreset(f, 'engineering', [
    { name: 'pr', source: 'top' },
    { name: 'tdd', source: 'top' },
  ]);
  h.makeSkill(f, 'pr', null, 'Write pull request bodies for review, covering motivation and testing notes.');
  h.makeSkill(f, 'tdd', null, 'Test driven development with red green refactor loops and integration tests.');
  h.makeSkill(f, 'branch-pr', null, 'Create pull request bodies for review with issue checks, motivation and testing notes.');
  const r = h.run(f, ['suggest']);
  const s = section(r.out, 'branch-pr');
  assert.match(s, /similar to.*\bpr\b.*engineering.*\d\.\d\d/i);
  assert.doesNotMatch(s, /\btdd\b/);
});

test('a block-style description is read too', (t) => {
  const f = setup(t);
  h.writePreset(f, 'engineering', [{ name: 'pr', source: 'top' }]);
  h.makeSkill(f, 'pr', null, 'Write pull request bodies for review, covering motivation and testing notes.');
  const dir = h.makeSkill(f, 'branch-pr');
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    '---\nname: branch-pr\ndescription: >\n  Create pull request bodies for review\n  with motivation and testing notes.\ntrigger: x\n---\n',
  );
  const r = h.run(f, ['suggest']);
  assert.match(section(r.out, 'branch-pr'), /similar to.*\bpr\b/i);
});

test('a "beats" statement in a fragment marks the skill as covered, including the slash shorthand', (t) => {
  const f = setup(t);
  h.writePreset(f, 'engineering', [
    { name: 'to-spec', source: 'top' },
    { name: 'pr', source: 'top' },
  ]);
  h.makeSkill(f, 'to-spec');
  h.makeSkill(f, 'pr');
  h.makeSkill(f, 'sdd-propose');
  h.makeSkill(f, 'sdd-spec');
  h.makeSkill(f, 'branch-pr');
  h.writeFragment(f, 'engineering', '## Overrides\n\n- Overlaps resolved: to-spec beats sdd-propose/spec; pr beats branch-pr.\n');
  const r = h.run(f, ['suggest']);
  assert.match(section(r.out, 'sdd-spec'), /covered by.*to-spec/i);
  assert.match(section(r.out, 'sdd-propose'), /covered by.*to-spec/i);
  assert.match(section(r.out, 'branch-pr'), /covered by.*\bpr\b/i);
});

test('a plain mention in a fragment is reported with its line', (t) => {
  const f = setup(t);
  h.writePreset(f, 'engineering', [{ name: 'tdd', source: 'top' }]);
  h.makeSkill(f, 'tdd');
  h.makeSkill(f, 'handoff');
  h.writeFragment(f, 'engineering', 'Propose retro and handoff; never run them unasked.\n');
  const r = h.run(f, ['suggest']);
  assert.match(section(r.out, 'handoff'), /mentioned in.*engineering.*never run them unasked/i);
});

test('a skill with no evidence says so', (t) => {
  const f = setup(t);
  h.makeSkill(f, 'lonely', null, 'Zebra crossing xylophone quartz.');
  const r = h.run(f, ['suggest']);
  assert.match(section(r.out, 'lonely'), /no evidence/i);
});

test('naming skills limits the report and an unknown name is refused', (t) => {
  const f = setup(t);
  h.makeSkill(f, 'one');
  h.makeSkill(f, 'two');
  const r = h.run(f, ['suggest', 'one']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /^one$/m);
  assert.doesNotMatch(r.out, /^two$/m);
  const bad = h.run(f, ['suggest', 'nope']);
  assert.notStrictEqual(bad.code, 0);
  assert.match(bad.err, /nope/);
});

test('with nothing unassigned it says so', (t) => {
  const f = setup(t);
  const r = h.run(f, ['suggest']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /No unassigned skills/);
});

test('suggest writes nothing', (t) => {
  const f = setup(t);
  h.makeSkill(f, 'one');
  h.run(f, ['suggest']);
  assert.deepStrictEqual(fs.readdirSync(f.root), ['skills']);
  assert.deepStrictEqual(fs.readdirSync(path.join(f.root, 'skills')), ['one']);
});
