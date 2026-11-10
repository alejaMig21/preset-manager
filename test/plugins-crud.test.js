const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];
const UNITY = 'unity@unity-agent-plugin';
const ENGRAM = 'engram@engram';
const HUD = 'claude-hud@claude-hud';

function setup(t) {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  h.writePreset(f, 'engineering', [{ name: 'tdd', source: 'engineering/tdd' }]);
  h.makeSkill(f, 'tdd', 'engineering');
  h.makeSkill(f, 'unity-x', 'gamedev');
  h.installPlugins(f, [ENGRAM, UNITY, HUD]);
  return f;
}

const def = (f, name) => h.readJson(path.join(f.presets, `${name}.json`));

test('create --plugins reports first and writes the plugins with --yes', (t) => {
  const f = setup(t);
  const dry = h.run(f, ['create', 'gamedev', '--skills', 'unity-x', '--plugins', UNITY]);
  assert.strictEqual(dry.code, 0, dry.err);
  assert.match(dry.out, /plugins: unity@unity-agent-plugin/);
  assert.strictEqual(fs.existsSync(path.join(f.presets, 'gamedev.json')), false);
  const r = h.run(f, ['create', 'gamedev', '--skills', 'unity-x', '--plugins', UNITY, '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(def(f, 'gamedev').plugins, [UNITY]);
  assert.deepStrictEqual(def(f, 'gamedev').skills, [{ name: 'unity-x', source: 'gamedev/unity-x' }]);
});

test('create refuses a plugin that is unknown or malformed', (t) => {
  const f = setup(t);
  const unknown = h.run(f, ['create', 'x', '--skills', 'unity-x', '--plugins', 'ghost@nowhere', '--yes']);
  assert.notStrictEqual(unknown.code, 0);
  assert.match(unknown.err, /ghost@nowhere/);
  const bad = h.run(f, ['create', 'x', '--skills', 'unity-x', '--plugins', 'no-marketplace', '--yes']);
  assert.notStrictEqual(bad.code, 0);
  assert.match(bad.err, /no-marketplace/);
  assert.strictEqual(fs.existsSync(path.join(f.presets, 'x.json')), false);
});

test('a preset without plugins gets no plugins key', (t) => {
  const f = setup(t);
  h.run(f, ['create', 'plain', '--skills', 'unity-x', '--yes']);
  assert.strictEqual('plugins' in def(f, 'plain'), false);
});

test('update adds and removes plugins and leaves skills and description alone', (t) => {
  const f = setup(t);
  const before = def(f, 'engineering');
  const add = h.run(f, ['update', 'engineering', '--add-plugins', `${UNITY},${ENGRAM}`, '--yes']);
  assert.strictEqual(add.code, 0, add.err);
  assert.deepStrictEqual(def(f, 'engineering').plugins, [UNITY, ENGRAM]);
  assert.deepStrictEqual(def(f, 'engineering').skills, before.skills);
  assert.strictEqual(def(f, 'engineering').description, before.description);
  const drop = h.run(f, ['update', 'engineering', '--remove-plugins', UNITY, '--yes']);
  assert.strictEqual(drop.code, 0, drop.err);
  assert.deepStrictEqual(def(f, 'engineering').plugins, [ENGRAM]);
});

test('update refuses to remove a plugin the preset does not list, and an unknown one to add', (t) => {
  const f = setup(t);
  const missing = h.run(f, ['update', 'engineering', '--remove-plugins', UNITY, '--yes']);
  assert.notStrictEqual(missing.code, 0);
  assert.match(missing.err, /unity@unity-agent-plugin/);
  const unknown = h.run(f, ['update', 'engineering', '--add-plugins', 'ghost@nowhere', '--yes']);
  assert.notStrictEqual(unknown.code, 0);
  assert.match(unknown.err, /ghost@nowhere/);
});

test('a preset may hold only plugins', (t) => {
  const f = setup(t);
  const r = h.run(f, ['create', 'usage', '--plugins', HUD, '--description', 'Usage bar.', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(def(f, 'usage').skills, []);
  assert.deepStrictEqual(def(f, 'usage').plugins, [HUD]);
  assert.match(h.run(f, ['list', '--details']).out, /usage: \(no skills\) \| plugins: claude-hud@claude-hud/);
});

test('a plugin-only preset is added and removed like any other', (t) => {
  const f = setup(t);
  h.writeSettings(f, { enabledPlugins: { [HUD]: false } });
  h.run(f, ['create', 'usage', '--plugins', HUD, '--yes']);
  const add = h.run(f, ['add', 'usage', '--yes']);
  assert.strictEqual(add.code, 0, add.err);
  assert.strictEqual(h.readSettings(f).enabledPlugins[HUD], true);
  assert.match(add.out, /restart the session/i);
  const rem = h.run(f, ['remove', 'usage', '--yes']);
  assert.strictEqual(rem.code, 0, rem.err);
  assert.strictEqual(h.readSettings(f).enabledPlugins[HUD], false);
});

test('a preset with neither skills nor plugins is refused on create and on update', (t) => {
  const f = setup(t);
  const create = h.run(f, ['create', 'empty', '--yes']);
  assert.notStrictEqual(create.code, 0);
  assert.match(create.err, /skill or one plugin|at least one/i);
  h.run(f, ['create', 'usage', '--plugins', HUD, '--yes']);
  const strip = h.run(f, ['update', 'usage', '--remove-plugins', HUD, '--yes']);
  assert.notStrictEqual(strip.code, 0);
  assert.ok(fs.existsSync(path.join(f.presets, 'usage.json')));
  assert.deepStrictEqual(def(f, 'usage').plugins, [HUD]);
});

test('adding and removing the same plugin in one update is refused', (t) => {
  const f = setup(t);
  h.run(f, ['update', 'engineering', '--add-plugins', UNITY, '--yes']); // now listed, so removal alone would be valid
  const r = h.run(f, ['update', 'engineering', '--add-plugins', UNITY, '--remove-plugins', UNITY, '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /both.*unity@unity-agent-plugin/i);
});

test('update without --yes changes nothing', (t) => {
  const f = setup(t);
  const before = fs.readFileSync(path.join(f.presets, 'engineering.json'), 'utf8');
  const r = h.run(f, ['update', 'engineering', '--add-plugins', UNITY]);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /would update/i);
  assert.strictEqual(fs.readFileSync(path.join(f.presets, 'engineering.json'), 'utf8'), before);
});

test('updating the plugins of an active preset says to apply', (t) => {
  const f = setup(t);
  h.writeActive(f, ['engineering']);
  const r = h.run(f, ['update', 'engineering', '--add-plugins', UNITY, '--yes']);
  assert.match(r.out, /preset apply/);
});

test('list shows plugins next to skills', (t) => {
  const f = setup(t);
  h.run(f, ['update', 'engineering', '--add-plugins', UNITY, '--yes']);
  const r = h.run(f, ['list', '--details']);
  assert.match(r.out, /engineering: tdd \| plugins: unity@unity-agent-plugin/);
  assert.match(r.out, /default: find-skills, preset-manager, skill-creator, dev-journal$/m);
});
