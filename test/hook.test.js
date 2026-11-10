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

const bashInput = (command) => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
const nudge = (f, command) => h.run(f, ['hook', 'nudge'], { input: bashInput(command) });
const backupCount = (f) => {
  const dir = path.join(f.root, 'preset-manager', 'backups');
  return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
};

test('after a skills add with unassigned skills the nudge asks the agent to propose a preset', (t) => {
  const f = setup(t);
  h.makeSkill(f, 'react-best-practices');
  const r = nudge(f, 'npx skills add vercel-labs/agent-skills@react-best-practices -g -y');
  assert.strictEqual(r.code, 0, r.err);
  const out = JSON.parse(r.out);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.match(out.hookSpecificOutput.additionalContext, /react-best-practices/);
  assert.match(out.hookSpecificOutput.additionalContext, /propose/i);
});

test('other commands produce no nudge', (t) => {
  const f = setup(t);
  h.makeSkill(f, 'react-best-practices');
  const r = nudge(f, 'ls -la');
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(r.out.trim(), '');
});

test('a skills add with nothing unassigned produces no nudge', (t) => {
  const f = setup(t);
  const r = nudge(f, 'npx skills add some/pkg -g -y');
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(r.out.trim(), '');
});

test('the nudge survives bad input and never writes', (t) => {
  const f = setup(t);
  h.makeSkill(f, 'loose');
  const bad = h.run(f, ['hook', 'nudge'], { input: 'not json' });
  assert.strictEqual(bad.code, 0);
  assert.strictEqual(bad.out.trim(), '');
  nudge(f, 'npx skills add x -g -y');
  assert.deepStrictEqual(fs.readdirSync(f.root), ['skills']);
});

test('install without --yes shows the exact change and writes nothing', (t) => {
  const f = setup(t);
  const r = h.run(f, ['hook', 'install']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /PostToolUse/);
  assert.match(r.out, /hook nudge/);
  assert.strictEqual(fs.existsSync(path.join(f.root, 'settings.json')), false);
});

test('install --yes adds the hook, keeps the other settings and backs up first', (t) => {
  const f = setup(t);
  const existing = { matcher: 'Write', hooks: [{ type: 'command', command: 'echo hi' }] };
  h.writeSettings(f, { enabledPlugins: { a: true }, hooks: { PostToolUse: [existing], PreToolUse: [] } });
  const original = fs.readFileSync(path.join(f.root, 'settings.json'), 'utf8');
  const r = h.run(f, ['hook', 'install', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  const s = h.readSettings(f);
  assert.deepStrictEqual(s.enabledPlugins, { a: true });
  assert.deepStrictEqual(s.hooks.PreToolUse, []);
  assert.deepStrictEqual(s.hooks.PostToolUse[0], existing);
  assert.strictEqual(s.hooks.PostToolUse.length, 2);
  assert.strictEqual(s.hooks.PostToolUse[1].matcher, 'Bash');
  assert.match(s.hooks.PostToolUse[1].hooks[0].command, /preset\.js" hook nudge$/);
  const dir = path.join(f.root, 'preset-manager', 'backups');
  const [backup] = fs.readdirSync(dir);
  assert.strictEqual(fs.readFileSync(path.join(dir, backup, 'settings.json'), 'utf8'), original);
});

test('installing twice does nothing the second time', (t) => {
  const f = setup(t);
  h.run(f, ['hook', 'install', '--yes']);
  const after = fs.readFileSync(path.join(f.root, 'settings.json'), 'utf8');
  const backups = backupCount(f);
  const r = h.run(f, ['hook', 'install', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /already installed/i);
  assert.strictEqual(fs.readFileSync(path.join(f.root, 'settings.json'), 'utf8'), after);
  assert.strictEqual(backupCount(f), backups);
});

test('rollback removes the installed hook', (t) => {
  const f = setup(t);
  h.run(f, ['hook', 'install', '--yes']);
  const r = h.run(f, ['rollback', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(fs.existsSync(path.join(f.root, 'settings.json')), false);
});

test('install fails clearly on an unreadable settings.json and changes nothing', (t) => {
  const f = setup(t);
  fs.writeFileSync(path.join(f.root, 'settings.json'), '{ broken');
  const r = h.run(f, ['hook', 'install', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /settings\.json/);
  assert.strictEqual(fs.readFileSync(path.join(f.root, 'settings.json'), 'utf8'), '{ broken');
});

test('an unknown hook subcommand is refused', (t) => {
  const f = setup(t);
  const r = h.run(f, ['hook', 'explode']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /install|nudge/);
});
