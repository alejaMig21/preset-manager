const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];
const HOOK = { id: 'my-nudge', event: 'PostToolUse', matcher: 'Bash', command: 'node C:/Users/me/tool.js', note: 'Mine.' };

function setup(t) {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  h.writePreset(f, 'plain', ['plain-x']);
  h.makeSkill(f, 'plain-x');
  h.makeSkill(f, 'other-x');
  h.writeSettings(f, { hooks: {}, enabledPlugins: {} });
  return f;
}

const read = (file) => fs.readFileSync(file, 'utf8');
const pub = (f, name) => path.join(f.presets, `${name}.json`);
const loc = (f, name) => path.join(f.local, `${name}.json`);

test('a local file adds hooks to the public preset of the same name and apply uses the merge', (t) => {
  const f = setup(t);
  h.writeLocal(f, 'default', { hooks: [HOOK] });
  const dry = h.run(f, ['apply']);
  assert.strictEqual(dry.code, 0, dry.err);
  assert.match(dry.out, /hook\+\s+my-nudge/);
  h.run(f, ['apply', '--yes']);
  assert.strictEqual(h.readSettings(f).hooks.PostToolUse[0].hooks[0].statusMessage, '[preset default: my-nudge]');
  assert.match(h.run(f, ['list', '--details']).out, /default: find-skills.*\| hooks: my-nudge/);
});

test('a local file with no public counterpart is a private preset', (t) => {
  const f = setup(t);
  h.writeLocal(f, 'private', { skills: [{ name: 'other-x', source: 'top' }] });
  assert.match(h.run(f, ['list']).out, /^ {2}private$/m);
  const r = h.run(f, ['add', 'private', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(h.activeNames(f), ['private']);
});

test('hook define --local writes only the local file and does not warn about the public repository', (t) => {
  const f = setup(t);
  const before = read(pub(f, 'default'));
  const args = ['hook', 'define', '--in', 'default', '--id', 'my-nudge', '--event', 'PostToolUse', '--command', 'node C:/Users/me/tool.js'];
  const r = h.run(f, [...args, '--local', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.doesNotMatch(r.out, /public repository/i);
  assert.strictEqual(read(pub(f, 'default')), before);
  assert.deepStrictEqual(h.readJson(loc(f, 'default')).hooks, [{ id: 'my-nudge', event: 'PostToolUse', command: 'node C:/Users/me/tool.js' }]);
});

test('without --local a command with a local path warns and points at --local', (t) => {
  const f = setup(t);
  const r = h.run(f, ['hook', 'define', '--in', 'plain', '--id', 'p', '--event', 'PostToolUse', '--command', 'python C:/Users/me/x.py']);
  assert.match(r.out, /public repository/i);
  assert.match(r.out, /--local/);
  assert.strictEqual(fs.existsSync(f.local), false);
});

test('hook adopt --local copies a live hook into the local file', (t) => {
  const f = setup(t);
  h.writeSettings(f, { hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'python C:/Users/me/d.py' }] }] } });
  const r = h.run(f, ['hook', 'adopt', '1', '--in', 'plain', '--id', 'detector', '--local', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(h.readJson(loc(f, 'plain')).hooks[0].command, 'python C:/Users/me/d.py');
  assert.strictEqual('hooks' in h.readJson(pub(f, 'plain')), false);
});

test('a hook marked local shows in the inventory as local', (t) => {
  const f = setup(t);
  h.writeLocal(f, 'default', { hooks: [HOOK] });
  h.run(f, ['apply', '--yes']);
  assert.match(h.run(f, ['hooks']).out, /preset default: my-nudge \[local\]/);
});

test('drop removes a hook from whichever file holds it', (t) => {
  const f = setup(t);
  h.writeLocal(f, 'default', { hooks: [HOOK] });
  h.writePreset(f, 'plain', ['plain-x'], [], [{ id: 'pub-hook', event: 'Stop', command: 'echo stop' }]);
  assert.strictEqual(h.run(f, ['hook', 'drop', '--in', 'default', '--id', 'my-nudge', '--yes']).code, 0);
  assert.strictEqual('hooks' in h.readJson(loc(f, 'default')), false);
  assert.strictEqual(h.run(f, ['hook', 'drop', '--in', 'plain', '--id', 'pub-hook', '--yes']).code, 0);
  assert.strictEqual('hooks' in h.readJson(pub(f, 'plain')), false);
  assert.notStrictEqual(h.run(f, ['hook', 'drop', '--in', 'plain', '--id', 'nope', '--yes']).code, 0);
});

test('a hook id used in both the public and the local file is refused', (t) => {
  const f = setup(t);
  h.writePreset(f, 'plain', ['plain-x'], [], [{ ...HOOK, command: 'echo public' }]);
  h.writeLocal(f, 'default', { hooks: [HOOK] });
  const r = h.run(f, ['status']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /my-nudge/);
});

test('update never copies local parts into the public file', (t) => {
  const f = setup(t);
  h.writeLocal(f, 'default', { hooks: [HOOK] });
  const r = h.run(f, ['update', 'default', '--add', 'other-x', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual('hooks' in h.readJson(pub(f, 'default')), false);
  assert.deepStrictEqual(h.readJson(pub(f, 'default')).skills.map((s) => s.name).slice(-1), ['other-x']);
  assert.strictEqual(h.readJson(loc(f, 'default')).hooks.length, 1);
});

test('update edits a private preset in its local file', (t) => {
  const f = setup(t);
  h.writeLocal(f, 'private', { skills: [{ name: 'plain-x', source: 'top' }] });
  const r = h.run(f, ['update', 'private', '--add', 'other-x', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(h.readJson(loc(f, 'private')).skills.map((s) => s.name), ['plain-x', 'other-x']);
  assert.strictEqual(fs.existsSync(pub(f, 'private')), false);
});

test('create --local writes a private preset and refuses a name that exists anywhere', (t) => {
  const f = setup(t);
  const r = h.run(f, ['create', 'private', '--skills', 'other-x', '--local', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(fs.existsSync(loc(f, 'private')));
  assert.strictEqual(fs.existsSync(pub(f, 'private')), false);
  assert.match(h.run(f, ['create', 'private', '--skills', 'other-x', '--yes']).err, /already exists/);
  h.writeLocal(f, 'onlylocal', { skills: [{ name: 'other-x', source: 'top' }] });
  assert.match(h.run(f, ['create', 'onlylocal', '--skills', 'plain-x', '--local', '--yes']).err, /already exists/);
});

test('delete backs up and removes both files of a preset', (t) => {
  const f = setup(t);
  h.writeLocal(f, 'plain', { hooks: [HOOK] });
  const r = h.run(f, ['delete', 'plain', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(fs.existsSync(pub(f, 'plain')), false);
  assert.strictEqual(fs.existsSync(loc(f, 'plain')), false);
  const dir = path.join(f.root, 'preset-manager', 'backups');
  const [saved] = fs.readdirSync(dir).filter((n) => n.endsWith('-deleted-plain'));
  assert.ok(fs.existsSync(path.join(dir, saved, 'plain.json')));
  assert.ok(fs.existsSync(path.join(dir, saved, 'plain.local.json')));
});

test('a local file whose name does not match its filename is refused naming the file', (t) => {
  const f = setup(t);
  fs.mkdirSync(f.local, { recursive: true });
  fs.writeFileSync(loc(f, 'wrong'), JSON.stringify({ name: 'other', skills: [] }));
  const r = h.run(f, ['status']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /wrong\.json/);
});

test('the repository ignores the local folder', () => {
  const ignore = read(path.join(__dirname, '..', '.gitignore'));
  assert.match(ignore, /^presets\.local\/$/m);
});
