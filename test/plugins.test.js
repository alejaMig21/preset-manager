const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];
const ENGRAM = 'engram@engram';
const UNITY = 'unity@unity-agent-plugin';
const HUD = 'claude-hud@claude-hud';

function setup(t, enabled = { [ENGRAM]: false, [UNITY]: false, [HUD]: false }) {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE, [ENGRAM]);
  h.writePreset(f, 'gamedev', ['unity-x'], [UNITY]);
  h.writePreset(f, 'tools', ['tool-x'], [UNITY]);
  h.writePreset(f, 'plain', ['plain-x']);
  h.installPlugins(f, [ENGRAM, UNITY, HUD, 'other@market']);
  h.writeSettings(f, { enabledPlugins: enabled, hooks: { PreToolUse: [] } });
  return f;
}

const plugins = (f) => h.readSettings(f).enabledPlugins;

test('adding a preset plans and applies its plugins, and the default plugins with it', (t) => {
  const f = setup(t);
  const dry = h.run(f, ['add', 'gamedev']);
  assert.strictEqual(dry.code, 0, dry.err);
  assert.match(dry.out, /plugin\+\s+unity@unity-agent-plugin/);
  assert.match(dry.out, /plugin\+\s+engram@engram/);
  assert.strictEqual(plugins(f)[UNITY], false);
  const r = h.run(f, ['add', 'gamedev', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(plugins(f)[UNITY], true);
  assert.strictEqual(plugins(f)[ENGRAM], true);
  assert.deepStrictEqual(h.readSettings(f).hooks, { PreToolUse: [] });
});

test('a plugin-only change asks for a restart, never "already active"', (t) => {
  const f = setup(t);
  const r = h.run(f, ['add', 'gamedev', '--yes']);
  assert.match(r.out, /restart the session/i);
  assert.doesNotMatch(r.out, /already active/i);
});

test('removing a preset switches its plugin off unless another active preset still asks for it', (t) => {
  const f = setup(t, { [ENGRAM]: true, [UNITY]: true, [HUD]: false });
  h.writeActive(f, ['gamedev', 'tools']);
  const keep = h.run(f, ['remove', 'gamedev', '--yes']);
  assert.strictEqual(keep.code, 0, keep.err);
  assert.doesNotMatch(keep.out, /plugin-/);
  assert.strictEqual(plugins(f)[UNITY], true);
  const gone = h.run(f, ['remove', 'tools', '--yes']);
  assert.match(gone.out, /plugin-\s+unity@unity-agent-plugin/);
  assert.strictEqual(plugins(f)[UNITY], false);
  assert.strictEqual(plugins(f)[ENGRAM], true, 'default plugin stays on');
});

test('a plugin no preset names is never touched', (t) => {
  const f = setup(t, { [ENGRAM]: true, [UNITY]: false, [HUD]: true, 'other@market': true });
  const r = h.run(f, ['add', 'gamedev']);
  assert.doesNotMatch(r.out, /claude-hud|other@market/);
  h.run(f, ['add', 'gamedev', '--yes']);
  h.run(f, ['remove', 'gamedev', '--yes']);
  assert.strictEqual(plugins(f)[HUD], true);
  assert.strictEqual(plugins(f)['other@market'], true);
});

test('a managed plugin that is already off and unwanted is not planned', (t) => {
  const f = setup(t);
  const r = h.run(f, ['apply']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /plugin\+\s+engram@engram/);
  assert.doesNotMatch(r.out, /plugin-/);
});

test('applying the same state twice changes nothing', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'gamedev', '--yes']);
  const before = fs.readFileSync(path.join(f.root, 'settings.json'), 'utf8');
  const r = h.run(f, ['apply', '--yes']);
  assert.match(r.out, /nothing to change/i);
  assert.strictEqual(fs.readFileSync(path.join(f.root, 'settings.json'), 'utf8'), before);
});

test('rollback restores the plugin switches and asks for a restart', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'gamedev', '--yes']);
  const r = h.run(f, ['rollback', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(plugins(f)[UNITY], false);
  assert.strictEqual(plugins(f)[ENGRAM], false);
  assert.match(r.out, /restart the session/i);
});

test('a preset asking for a plugin that is not installed is refused naming it', (t) => {
  const f = setup(t);
  h.writePreset(f, 'ghost', ['ghost-x'], ['ghost@nowhere']);
  const r = h.run(f, ['add', 'ghost', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /ghost@nowhere/);
  assert.deepStrictEqual(h.readSettings(f).enabledPlugins, { [ENGRAM]: false, [UNITY]: false, [HUD]: false });
});

test('a plugin that only lingers in enabledPlugins but is not installed is refused', (t) => {
  const f = setup(t, { [ENGRAM]: false, [UNITY]: false, [HUD]: false, 'removed@market': false });
  h.writePreset(f, 'old', ['old-x'], ['removed@market']);
  const r = h.run(f, ['add', 'old', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /removed@market/);
  assert.strictEqual(plugins(f)['removed@market'], false);
});

test('an unreadable installed_plugins.json is reported by name, not as a crash', (t) => {
  const f = setup(t);
  fs.writeFileSync(path.join(f.root, 'plugins', 'installed_plugins.json'), '{ nope');
  const r = h.run(f, ['status']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /installed_plugins\.json/);
  assert.doesNotMatch(r.err, /SyntaxError|at Object/);
});

test('with no installed_plugins.json the plugins in settings are trusted', (t) => {
  const f = setup(t);
  fs.rmSync(path.join(f.root, 'plugins'), { recursive: true });
  const r = h.run(f, ['add', 'gamedev']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /plugin\+\s+unity@unity-agent-plugin/);
});

test('a malformed plugin id in a definition is refused naming the file', (t) => {
  const f = setup(t);
  h.writePreset(f, 'sloppy', ['x'], ['no-marketplace']);
  const r = h.run(f, ['status']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /sloppy\.json/);
});

test('status lists the plugins that have no preset', (t) => {
  const f = setup(t, { [ENGRAM]: true, [UNITY]: false, [HUD]: true });
  const r = h.run(f, ['status']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Plugins without preset: .*claude-hud@claude-hud/);
  assert.match(r.out, /Plugins without preset: .*other@market/);
  assert.doesNotMatch(r.out, /Plugins without preset: .*unity/);
});

test('a preset without plugins keeps working as before', (t) => {
  const f = setup(t);
  const r = h.run(f, ['add', 'plain', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /already active|restart/i);
});
