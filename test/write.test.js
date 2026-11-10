const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];
const ORIGINAL_SETTINGS = {
  enabledPlugins: { 'engram@engram': true },
  hooks: { PreToolUse: [] },
  skillOverrides: { 'hand-installed-off': 'off' },
};

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
  h.makeSkill(f, 'hand-installed');
  h.writeSettings(f, ORIGINAL_SETTINGS);
  return f;
}

const settingsText = (f) => fs.readFileSync(path.join(f.root, 'settings.json'), 'utf8');
const backupDirs = (f) => {
  const dir = path.join(f.root, 'preset-manager', 'backups');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => !n.endsWith('.rolled-back')) : [];
};
const target = (f, group, name) => path.join(f.root, 'skills', group, name);

test('without --yes nothing is written, not even a backup', (t) => {
  const f = setup(t);
  const before = settingsText(f);
  const r = h.run(f, ['add', 'engineering']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /--yes/);
  assert.strictEqual(settingsText(f), before);
  assert.strictEqual(h.isLink(f, 'tdd'), false);
  assert.deepStrictEqual(backupDirs(f), []);
});

test('add --yes links the skills, switches the others off and records the active preset', (t) => {
  const f = setup(t);
  const r = h.run(f, ['add', 'engineering', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(h.isLink(f, 'tdd'));
  assert.strictEqual(fs.realpathSync(path.join(f.root, 'skills', 'tdd')), fs.realpathSync(target(f, 'engineering', 'tdd')));
  assert.strictEqual(h.readSettings(f).skillOverrides.grilling, 'off');
  assert.deepStrictEqual(h.activeNames(f), ['engineering']);
});

test('a backup of the original files exists before the write and unmanaged data survives', (t) => {
  const f = setup(t);
  const original = settingsText(f);
  h.run(f, ['add', 'engineering', '--yes']);
  const dirs = backupDirs(f);
  assert.strictEqual(dirs.length, 1);
  const backed = fs.readFileSync(path.join(f.root, 'preset-manager', 'backups', dirs[0], 'settings.json'), 'utf8');
  assert.strictEqual(backed, original);
  const after = h.readSettings(f);
  assert.deepStrictEqual(after.enabledPlugins, ORIGINAL_SETTINGS.enabledPlugins);
  assert.deepStrictEqual(after.hooks, ORIGINAL_SETTINGS.hooks);
  assert.strictEqual(after.skillOverrides['hand-installed-off'], 'off');
  assert.ok(fs.existsSync(path.join(f.root, 'skills', 'hand-installed', 'SKILL.md')));
});

test('remove --yes drops the link but never deletes its source folder', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'engineering', '--yes']);
  const r = h.run(f, ['remove', 'engineering', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(h.isLink(f, 'tdd'), false);
  assert.ok(fs.existsSync(path.join(target(f, 'engineering', 'tdd'), 'SKILL.md')));
  assert.strictEqual(h.readSettings(f).skillOverrides.tdd, 'off');
  assert.deepStrictEqual(h.activeNames(f), []);
});

test('an external source is linked in place and survives removal', (t) => {
  const f = setup(t);
  const src = h.makeExternalSkill(f, 'tickets-tree');
  h.writePreset(f, 'custom', [{ name: 'tickets-tree', source: src }]);
  h.run(f, ['add', 'custom', '--yes']);
  assert.strictEqual(fs.realpathSync(path.join(f.root, 'skills', 'tickets-tree')), fs.realpathSync(src));
  h.run(f, ['remove', 'custom', '--yes']);
  assert.strictEqual(h.isLink(f, 'tickets-tree'), false);
  assert.ok(fs.existsSync(path.join(src, 'SKILL.md')));
});

test('a result that fails validation restores the original files and exits non-zero', (t) => {
  const f = setup(t);
  const original = settingsText(f);
  const r = h.run(f, ['add', 'engineering', '--yes'], { env: { PRESET_MANAGER_FAULT: 'corrupt-settings' } });
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /rolled back/);
  assert.strictEqual(settingsText(f), original);
  assert.strictEqual(h.isLink(f, 'tdd'), false);
  assert.strictEqual(fs.existsSync(path.join(f.root, 'preset-manager', 'active.json')), false);
});

test('when the backup cannot be made nothing is written', (t) => {
  const f = setup(t);
  const original = settingsText(f);
  fs.mkdirSync(path.join(f.root, 'preset-manager'), { recursive: true });
  fs.writeFileSync(path.join(f.root, 'preset-manager', 'backups'), 'a file where the folder should be');
  const r = h.run(f, ['add', 'engineering', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.strictEqual(settingsText(f), original);
  assert.strictEqual(h.isLink(f, 'tdd'), false);
});

test('rollback restores the last backup, undoing links and the active list', (t) => {
  const f = setup(t);
  const original = settingsText(f);
  h.run(f, ['add', 'engineering', '--yes']);
  const dry = h.run(f, ['rollback']);
  assert.strictEqual(dry.code, 0, dry.err);
  assert.ok(h.isLink(f, 'tdd'), 'dry run must change nothing');
  const r = h.run(f, ['rollback', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(settingsText(f), original);
  assert.strictEqual(h.isLink(f, 'tdd'), false);
  assert.strictEqual(fs.existsSync(path.join(f.root, 'preset-manager', 'active.json')), false);
  assert.ok(fs.existsSync(path.join(target(f, 'engineering', 'tdd'), 'SKILL.md')));
});

test('rollback recreates a link that the last change removed', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'engineering', '--yes']);
  h.run(f, ['remove', 'engineering', '--yes']);
  const r = h.run(f, ['rollback', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(h.isLink(f, 'tdd'));
  assert.deepStrictEqual(h.activeNames(f), ['engineering']);
});

test('rollback with no backup says so', (t) => {
  const f = setup(t);
  const r = h.run(f, ['rollback', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /no backup/i);
});

test('applying the same state twice changes no file and makes no new backup', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'engineering', '--yes']);
  const settings = settingsText(f);
  const active = fs.readFileSync(path.join(f.root, 'preset-manager', 'active.json'), 'utf8');
  const backups = backupDirs(f).length;
  const r = h.run(f, ['apply', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /nothing to change/i);
  assert.strictEqual(settingsText(f), settings);
  assert.strictEqual(fs.readFileSync(path.join(f.root, 'preset-manager', 'active.json'), 'utf8'), active);
  assert.strictEqual(backupDirs(f).length, backups);
});

test('a real folder where a link would go is never removed', (t) => {
  const f = setup(t);
  h.makeSkill(f, 'tdd'); // a real, hand-made <root>/skills/tdd, not a link
  const r = h.run(f, ['apply', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(f.root, 'skills', 'tdd', 'SKILL.md')));
});
