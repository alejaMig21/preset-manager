const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];
const top = (name) => ({ name, source: 'top' });
const grp = (group, name) => ({ name, source: `${group}/${name}` });

const ENG = [grp('engineering', 'tdd'), grp('engineering', 'code-review'), grp('engineering', 'to-spec'), grp('engineering', 'implement')];
const PROD = [grp('productivity', 'grilling'), grp('productivity', 'teach'), grp('productivity', 'handoff')];

const FRAGMENT = [
  '# Preset engineering_productivity: session workflow',
  '',
  '| Stage | Skill | Trigger |',
  '|---|---|---|',
  '| 1 Start | engram `mem_context` | first message of every session |',
  '| 4 Build | tdd | any behaviour built or fixed |',
  '| 2 Intake | grilling | user says grill |',
  '| 8 Teach | teach | user wants to learn |',
  '| Always | find-skills, preset-manager, ponytail, caveman | every reply |',
  '',
  '## Stage rules',
  '',
  '2. Intake: ask what is missing; inside grilling use its round format.',
  '4. Build: confirm seams once per feature before the first test (tdd).',
  '6. Ship: run code-review in a fresh context.',
  '10. Next step: end every reply with "Cómo seguir:" naming /implement or /handoff.',
  '',
].join('\n');

function oldPreset(name, skills, extra = {}) {
  return {
    name,
    description: `${name} description`,
    status: 'defined',
    base: true,
    skills_on: [...BASE.map(top), ...skills],
    skills_off: ['x', 'y'],
    plugins_on: ['engram@engram'],
    plugins_off: ['claude-hud@claude-hud'],
    fragments: ['fragments/base.md'],
    notes: [],
    ...extra,
  };
}

// The live setup as it is today: old-format presets in <root>/presets.
function setupOld(t, { active = 'engineering_productivity' } = {}) {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  const dir = path.join(f.root, 'presets');
  fs.mkdirSync(path.join(dir, 'fragments'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'backups'));
  const put = (name, data) => fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2));
  put('core', oldPreset('core', [top('mockup-to-prototype')]));
  put('engineering', oldPreset('engineering', ENG));
  put('productivity', oldPreset('productivity', PROD));
  put('engineering_productivity', oldPreset('engineering_productivity', [...ENG, ...PROD], {
    fragments: ['fragments/base.md', 'fragments/engineering_productivity.md'],
  }));
  put('gamedev', oldPreset('gamedev', [grp('gamedev', 'unity-x')]));
  put('matt-pocock-custom', oldPreset('matt-pocock-custom', [grp('matt-pocock-custom', 'tickets-tree')], { additive: true }));
  put('settings.backup-before-presets', { enabledPlugins: {} }); // not a preset
  fs.writeFileSync(path.join(dir, 'active.json'), JSON.stringify({ active, since: '2026-11-08' }));
  fs.writeFileSync(path.join(dir, 'README.md'), '# old readme');
  fs.writeFileSync(path.join(dir, 'fragments', 'base.md'), 'How the mechanism works.\n');
  fs.writeFileSync(path.join(dir, 'fragments', 'engineering_productivity.md'), FRAGMENT);
  fs.writeFileSync(path.join(dir, 'backups', 'big.bak'), 'old backup');
  return f;
}

const def = (f, name) => h.readJson(path.join(f.presets, `${name}.json`));
const skillNames = (f, name) => def(f, name).skills.map((s) => s.name);
const defExists = (f, name) => fs.existsSync(path.join(f.presets, `${name}.json`));
const frag = (f, name) => path.join(f.presets, 'fragments', `${name}.md`);
const oldFiles = (f) => {
  const dir = path.join(f.root, 'presets');
  return fs.readdirSync(dir).filter((n) => n !== 'backups' && n !== 'fragments').map((n) => [n, fs.readFileSync(path.join(dir, n), 'utf8')]);
};

test('the dry run shows the result and writes nothing', (t) => {
  const f = setupOld(t);
  const r = h.run(f, ['convert']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /prototyping/);
  assert.match(r.out, /engineering_productivity/);
  assert.deepStrictEqual(fs.readdirSync(f.presets), ['fragments']);
  assert.deepStrictEqual(fs.readdirSync(path.join(f.presets, 'fragments')), []);
  assert.strictEqual(fs.existsSync(path.join(f.root, 'preset-manager')), false);
});

test('convert writes default, prototyping and additive presets and drops the retired ones', (t) => {
  const f = setupOld(t);
  const r = h.run(f, ['convert', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(skillNames(f, 'default'), BASE);
  assert.deepStrictEqual(skillNames(f, 'prototyping'), ['mockup-to-prototype']);
  assert.deepStrictEqual(skillNames(f, 'engineering'), ['tdd', 'code-review', 'to-spec', 'implement']);
  assert.deepStrictEqual(skillNames(f, 'productivity'), ['grilling', 'teach', 'handoff']);
  assert.deepStrictEqual(skillNames(f, 'gamedev'), ['unity-x']);
  assert.deepStrictEqual(def(f, 'matt-pocock-custom').skills, [{ name: 'tickets-tree', source: 'matt-pocock-custom/tickets-tree' }]);
  assert.strictEqual(def(f, 'engineering').description, 'engineering description');
  for (const gone of ['core', 'engineering_productivity', 'settings.backup-before-presets', 'active']) {
    assert.strictEqual(defExists(f, gone), false, gone);
  }
  assert.deepStrictEqual(Object.keys(def(f, 'engineering')).sort(), ['description', 'name', 'skills']);
});

test('the converted presets are readable by the rest of the tool', (t) => {
  const f = setupOld(t);
  h.run(f, ['convert', '--yes']);
  const r = h.run(f, ['list']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /prototyping: mockup-to-prototype/);
});

test('the old files stay untouched and a backup copy is made first', (t) => {
  const f = setupOld(t);
  const before = oldFiles(f);
  h.run(f, ['convert', '--yes']);
  assert.deepStrictEqual(oldFiles(f), before);
  const dir = path.join(f.root, 'preset-manager', 'backups');
  const [backup] = fs.readdirSync(dir);
  const saved = path.join(dir, backup, 'old-presets');
  assert.ok(fs.existsSync(path.join(saved, 'engineering_productivity.json')));
  assert.ok(fs.existsSync(path.join(saved, 'fragments', 'engineering_productivity.md')));
  assert.strictEqual(fs.existsSync(path.join(saved, 'backups')), false);
});

test('the old stage-table text is split so each preset carries its own rules', (t) => {
  const f = setupOld(t);
  h.run(f, ['convert', '--yes']);
  const eng = fs.readFileSync(frag(f, 'engineering'), 'utf8');
  const prod = fs.readFileSync(frag(f, 'productivity'), 'utf8');
  assert.match(eng, /\| 4 Build \| tdd/);
  assert.doesNotMatch(eng, /grilling/);
  assert.match(prod, /\| 2 Intake \| grilling/);
  assert.doesNotMatch(prod, /\btdd\b/);
  for (const text of [eng, prod]) {
    assert.match(text, /\| Stage \| Skill \| Trigger \|/); // structure goes to both
    assert.match(text, /Cómo seguir/); // the mixed "next step" rule goes to both
  }
  const kept = new Set([...eng.split('\n'), ...prod.split('\n')]);
  for (const line of FRAGMENT.split('\n').filter((l) => l.trim())) {
    assert.ok(kept.has(line), `lost: ${line}`);
  }
});

test('the old mechanism document is not carried over and other presets get no fragment', (t) => {
  const f = setupOld(t);
  h.run(f, ['convert', '--yes']);
  assert.deepStrictEqual(fs.readdirSync(path.join(f.presets, 'fragments')).sort(), ['engineering.md', 'productivity.md']);
});

test('the active preset becomes the equivalent stacked list with its date', (t) => {
  const f = setupOld(t);
  h.run(f, ['convert', '--yes']);
  const state = h.readJson(path.join(f.root, 'preset-manager', 'active.json'));
  assert.deepStrictEqual(state.active, [
    { name: 'engineering', since: '2026-11-08' },
    { name: 'productivity', since: '2026-11-08' },
  ]);
});

test('an old active core becomes an empty list, default being always on', (t) => {
  const f = setupOld(t, { active: 'core' });
  h.run(f, ['convert', '--yes']);
  assert.deepStrictEqual(h.activeNames(f), []);
});

test('an old active ordinary preset stays active by name', (t) => {
  const f = setupOld(t, { active: 'gamedev' });
  h.run(f, ['convert', '--yes']);
  assert.deepStrictEqual(h.activeNames(f), ['gamedev']);
});

test('a second run refuses and says it already ran', (t) => {
  const f = setupOld(t);
  h.run(f, ['convert', '--yes']);
  const r = h.run(f, ['convert', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /already/i);
});

test('convert refuses to overwrite an existing definition', (t) => {
  const f = setupOld(t);
  h.writePreset(f, 'engineering', ['hand-made']);
  const before = fs.readFileSync(path.join(f.presets, 'engineering.json'), 'utf8');
  const r = h.run(f, ['convert', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /engineering\.json/);
  assert.strictEqual(fs.readFileSync(path.join(f.presets, 'engineering.json'), 'utf8'), before);
  assert.strictEqual(defExists(f, 'default'), false);
});

test('a malformed old preset fails naming the file and writes nothing', (t) => {
  const f = setupOld(t);
  fs.writeFileSync(path.join(f.root, 'presets', 'broken.json'), '{ nope');
  const r = h.run(f, ['convert', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /broken\.json/);
  assert.strictEqual(defExists(f, 'default'), false);
});

test('a setup without the old fragment still converts', (t) => {
  const f = setupOld(t);
  fs.rmSync(path.join(f.root, 'presets', 'fragments', 'engineering_productivity.md'));
  const r = h.run(f, ['convert', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(fs.readdirSync(path.join(f.presets, 'fragments')), []);
});

test('a missing old folder is reported', (t) => {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  const r = h.run(f, ['convert']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /presets/);
});

test('after converting, apply reproduces the old working setup in the fake root', (t) => {
  const f = setupOld(t);
  for (const s of ENG) h.makeSkill(f, s.name, 'engineering');
  for (const s of PROD) h.makeSkill(f, s.name, 'productivity');
  h.makeSkill(f, 'unity-x', 'gamedev');
  h.makeSkill(f, 'tickets-tree', 'matt-pocock-custom');
  h.run(f, ['convert', '--yes']);
  const r = h.run(f, ['apply', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  for (const n of ['tdd', 'code-review', 'grilling', 'teach']) assert.ok(h.isLink(f, n), n);
  assert.strictEqual(h.isLink(f, 'unity-x'), false);
  const md = fs.readFileSync(path.join(f.root, 'CLAUDE.md'), 'utf8');
  assert.match(md, /<!-- preset:engineering -->/);
  assert.match(md, /<!-- preset:productivity -->/);
  assert.match(r.out, /restart the session/i);
});
