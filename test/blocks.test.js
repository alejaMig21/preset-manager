const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];
const USER_TEXT = '# My rules\r\n\r\nBe brief.\r\nNever guess.\r\n';

function setup(t, claudeMd = USER_TEXT) {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  h.writePreset(f, 'engineering', [{ name: 'tdd', source: 'engineering/tdd' }]);
  h.writePreset(f, 'productivity', [{ name: 'grilling', source: 'productivity/grilling' }]);
  h.writePreset(f, 'plain', [{ name: 'plain-skill', source: 'engineering/plain-skill' }]);
  h.makeSkill(f, 'tdd', 'engineering');
  h.makeSkill(f, 'grilling', 'productivity');
  h.makeSkill(f, 'plain-skill', 'engineering');
  h.writeFragment(f, 'engineering', 'Engineering rules.\n');
  h.writeFragment(f, 'productivity', 'Productivity rules.\n');
  h.writeSettings(f, {});
  if (claudeMd !== null) fs.writeFileSync(path.join(f.root, 'CLAUDE.md'), claudeMd);
  return f;
}

const claudeMd = (f) => fs.readFileSync(path.join(f.root, 'CLAUDE.md'), 'utf8');
const opens = (f) => [...claudeMd(f).matchAll(/<!-- preset:([\w.-]+) -->/g)].map((m) => m[1]);

test('adding a preset with a fragment adds exactly one block that imports its copy', (t) => {
  const f = setup(t);
  const r = h.run(f, ['add', 'engineering', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(opens(f), ['engineering']);
  assert.ok(claudeMd(f).includes('@preset-manager/fragments/engineering.md'));
  assert.strictEqual(
    fs.readFileSync(path.join(f.root, 'preset-manager', 'fragments', 'engineering.md'), 'utf8'),
    'Engineering rules.\n',
  );
});

test('blocks follow activation order and removal takes only that block', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'productivity', '--yes']);
  h.run(f, ['add', 'engineering', '--yes']);
  assert.deepStrictEqual(opens(f), ['productivity', 'engineering']);
  h.run(f, ['remove', 'productivity', '--yes']);
  assert.deepStrictEqual(opens(f), ['engineering']);
});

test('text outside the blocks stays byte-identical, even after a full add and remove', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'engineering', '--yes']);
  assert.ok(claudeMd(f).startsWith(USER_TEXT));
  h.run(f, ['remove', 'engineering', '--yes']);
  assert.strictEqual(claudeMd(f), USER_TEXT);
  assert.strictEqual(fs.existsSync(path.join(f.root, 'preset-manager', 'fragments', 'engineering.md')), false);
});

test('new blocks use the line ending of the file', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'engineering', '--yes']);
  assert.ok(claudeMd(f).includes('<!-- preset:engineering -->\r\n'));
});

test('an unpaired marker makes add refuse and write nothing', (t) => {
  const f = setup(t, '# Rules\n<!-- preset:legacy -->\n@presets/fragments/legacy.md\n');
  const before = claudeMd(f);
  const r = h.run(f, ['add', 'engineering', '--yes']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /preset:legacy/);
  assert.strictEqual(claudeMd(f), before);
  assert.strictEqual(h.isLink(f, 'tdd'), false);
  assert.strictEqual(fs.existsSync(path.join(f.root, 'preset-manager', 'active.json')), false);
});

test('a closing marker without an opening one is refused', (t) => {
  const f = setup(t, '# Rules\n<!-- /preset:stray -->\n');
  const r = h.run(f, ['add', 'engineering']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /preset:stray/);
});

test('a half-written marker is refused', (t) => {
  const f = setup(t, '# Rules\n<!-- preset:broken\n');
  const r = h.run(f, ['add', 'engineering']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /marker/);
});

test('a block change tells the person to restart the session', (t) => {
  const f = setup(t);
  const r = h.run(f, ['add', 'engineering', '--yes']);
  assert.match(r.out, /restart the session/i);
});

test('a skills-only change says the preset is already active', (t) => {
  const f = setup(t);
  const r = h.run(f, ['add', 'plain', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /already active/i);
  assert.doesNotMatch(r.out, /restart the session/i);
  assert.deepStrictEqual(opens(f), []);
  assert.strictEqual(claudeMd(f), USER_TEXT);
});

test('a preset without a fragment does not create CLAUDE.md', (t) => {
  const f = setup(t, null);
  h.run(f, ['add', 'plain', '--yes']);
  assert.strictEqual(fs.existsSync(path.join(f.root, 'CLAUDE.md')), false);
});

test('the total size of the stacked fragments is printed', (t) => {
  const f = setup(t);
  h.writeFragment(f, 'productivity', 'x'.repeat(1000));
  h.run(f, ['add', 'engineering', '--yes']);
  const r = h.run(f, ['add', 'productivity', '--yes']);
  assert.match(r.out, /1019 bytes/); // 19 (engineering) + 1000 (productivity)
});

test('the dry run lists the block it would add', (t) => {
  const f = setup(t);
  const r = h.run(f, ['add', 'engineering']);
  assert.match(r.out, /block\+\s+engineering/);
  assert.strictEqual(claudeMd(f), USER_TEXT);
});

test('a stale block of a preset that is not active is removed on apply', (t) => {
  const stale = '# Rules\n<!-- preset:old -->\n@presets/fragments/old.md\n<!-- /preset:old -->\nTail.\n';
  const f = setup(t, stale);
  const r = h.run(f, ['apply', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(claudeMd(f), '# Rules\nTail.\n');
  assert.match(r.out, /restart the session/i);
});

test('an edited fragment refreshes its copy and asks for a restart', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'engineering', '--yes']);
  h.writeFragment(f, 'engineering', 'Engineering rules, v2.\n');
  const r = h.run(f, ['apply', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /restart the session/i);
  assert.strictEqual(
    fs.readFileSync(path.join(f.root, 'preset-manager', 'fragments', 'engineering.md'), 'utf8'),
    'Engineering rules, v2.\n',
  );
});

test('a fragment that differs from its copy only in line endings is not stale', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'engineering', '--yes']);
  h.writeFragment(f, 'engineering', 'Engineering rules.\r\n'); // what git autocrlf does to the repo file
  const r = h.run(f, ['apply', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /nothing to change/i);
});

test('rollback restores CLAUDE.md and the fragment copies', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'engineering', '--yes']);
  const r = h.run(f, ['rollback', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(claudeMd(f), USER_TEXT);
  assert.strictEqual(fs.existsSync(path.join(f.root, 'preset-manager', 'fragments', 'engineering.md')), false);
  assert.match(r.out, /restart the session/i);
});

test('the default preset fragment, when it exists, is always imported first', (t) => {
  const f = setup(t);
  h.writeFragment(f, 'default', 'Base rules.\n');
  h.run(f, ['add', 'engineering', '--yes']);
  assert.deepStrictEqual(opens(f), ['default', 'engineering']);
});
