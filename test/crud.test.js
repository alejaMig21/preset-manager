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
  h.makeSkill(f, 'code-review', 'engineering');
  h.makeSkill(f, 'grilling', 'productivity');
  h.makeSkill(f, 'hand-installed');
  return f;
}

const defFile = (f, name) => path.join(f.presets, `${name}.json`);
const skillsOf = (f, name) => h.readJson(defFile(f, name)).skills;

test('create without --yes only reports', (t) => {
  const f = setup(t);
  const r = h.run(f, ['create', 'review', '--skills', 'code-review']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /would create/i);
  assert.strictEqual(fs.existsSync(defFile(f, 'review')), false);
});

test('create --yes writes a definition with each skill source resolved', (t) => {
  const f = setup(t);
  const r = h.run(f, ['create', 'mixed', '--skills', 'code-review,hand-installed', '--description', 'A mix', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  const def = h.readJson(defFile(f, 'mixed'));
  assert.strictEqual(def.description, 'A mix');
  assert.deepStrictEqual(def.skills, [
    { name: 'code-review', source: 'engineering/code-review' },
    { name: 'hand-installed', source: 'top' },
  ]);
  assert.match(h.run(f, ['status']).out, /Known presets: .*mixed/);
});

test('create accepts name=source for a skill outside the config folder', (t) => {
  const f = setup(t);
  const src = h.makeExternalSkill(f, 'tickets-tree');
  const r = h.run(f, ['create', 'custom', '--skills', `tickets-tree=${src}`, '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(skillsOf(f, 'custom'), [{ name: 'tickets-tree', source: src }]);
});

test('create refuses an existing name, an unknown skill, no skills and a bad name', (t) => {
  const f = setup(t);
  const dup = h.run(f, ['create', 'engineering', '--skills', 'code-review', '--yes']);
  assert.notStrictEqual(dup.code, 0);
  assert.match(dup.err, /already exists/);
  const unknown = h.run(f, ['create', 'x', '--skills', 'does-not-exist', '--yes']);
  assert.notStrictEqual(unknown.code, 0);
  assert.match(unknown.err, /does-not-exist/);
  const empty = h.run(f, ['create', 'x', '--yes']);
  assert.notStrictEqual(empty.code, 0);
  const bad = h.run(f, ['create', '../x', '--skills', 'code-review', '--yes']);
  assert.notStrictEqual(bad.code, 0);
  assert.strictEqual(fs.existsSync(path.join(f.dir, 'x.json')), false);
});

test('update adds and removes skills and list shows the result', (t) => {
  const f = setup(t);
  const r = h.run(f, ['update', 'engineering', '--add', 'code-review,grilling', '--remove', 'tdd', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(skillsOf(f, 'engineering').map((s) => s.name), ['code-review', 'grilling']);
  assert.match(h.run(f, ['list']).out, /engineering: code-review, grilling/);
});

test('update without --yes changes nothing and removing a non-member is refused', (t) => {
  const f = setup(t);
  const before = fs.readFileSync(defFile(f, 'engineering'), 'utf8');
  h.run(f, ['update', 'engineering', '--add', 'grilling']);
  assert.strictEqual(fs.readFileSync(defFile(f, 'engineering'), 'utf8'), before);
  const r = h.run(f, ['update', 'engineering', '--remove', 'grilling', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /grilling/);
});

test('update of an active preset says to apply it', (t) => {
  const f = setup(t);
  h.writeActive(f, ['engineering']);
  const r = h.run(f, ['update', 'engineering', '--add', 'grilling', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /preset apply/);
});

test('delete of an inactive preset removes its definition and fragment', (t) => {
  const f = setup(t);
  h.writeFragment(f, 'engineering', 'Rules.\n');
  const dry = h.run(f, ['delete', 'engineering']);
  assert.strictEqual(dry.code, 0, dry.err);
  assert.ok(fs.existsSync(defFile(f, 'engineering')));
  const r = h.run(f, ['delete', 'engineering', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(fs.existsSync(defFile(f, 'engineering')), false);
  assert.strictEqual(fs.existsSync(path.join(f.presets, 'fragments', 'engineering.md')), false);
});

test('delete of an active preset deactivates it first and says so', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'engineering', '--yes']);
  assert.ok(h.isLink(f, 'tdd'));
  const r = h.run(f, ['delete', 'engineering', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /deactivated/i);
  assert.deepStrictEqual(h.activeNames(f), []);
  assert.strictEqual(h.isLink(f, 'tdd'), false);
  assert.strictEqual(fs.existsSync(defFile(f, 'engineering')), false);
  assert.match(r.out, /tdd/); // skills only that preset named are now unassigned
});

test('delete keeps a copy of the definition and fragment it removes', (t) => {
  const f = setup(t);
  h.writeFragment(f, 'engineering', 'My rules.\n');
  h.run(f, ['delete', 'engineering', '--yes']);
  const dir = path.join(f.root, 'preset-manager', 'backups');
  const [saved] = fs.readdirSync(dir).filter((n) => n.endsWith('-deleted-engineering'));
  assert.ok(saved, 'a -deleted-engineering folder');
  assert.strictEqual(h.readJson(path.join(dir, saved, 'engineering.json')).name, 'engineering');
  assert.strictEqual(fs.readFileSync(path.join(dir, saved, 'engineering.md'), 'utf8'), 'My rules.\n');
});

test('update names the skills it leaves unassigned', (t) => {
  const f = setup(t);
  const r = h.run(f, ['update', 'engineering', '--add', 'code-review', '--remove', 'tdd', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Now unassigned.*tdd/);
});

test('default can never be deleted', (t) => {
  const f = setup(t);
  const r = h.run(f, ['delete', 'default', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.ok(fs.existsSync(defFile(f, 'default')));
});

test('list shows every preset with its skills', (t) => {
  const f = setup(t);
  const r = h.run(f, ['list']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /default: find-skills, preset-manager, skill-creator, dev-journal/);
  assert.match(r.out, /engineering: tdd/);
});
