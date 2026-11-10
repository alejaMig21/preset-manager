const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];
const NUDGE = {
  id: 'tickets-nudge',
  event: 'PostToolUse',
  matcher: 'Bash',
  command: 'node tt.js nudge',
  note: 'Nudge after a ticket changes.',
};
const OLD_HOOKS = {
  PreToolUse: [{ matcher: 'Write|Edit|Bash', hooks: [{ type: 'command', command: 'echo pre', statusMessage: 'pre' }] }],
  UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'echo prompt' }] }],
};

function setup(t, hooks = OLD_HOOKS) {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  h.writePreset(f, 'default', BASE);
  h.writePreset(f, 'tickets', ['tickets-tree'], [], [NUDGE]);
  h.writePreset(f, 'plain', ['plain-x']);
  h.makeSkill(f, 'tickets-tree');
  h.makeSkill(f, 'plain-x');
  h.writeSettings(f, { hooks: JSON.parse(JSON.stringify(hooks)), enabledPlugins: { a: true } });
  return f;
}

const settings = (f) => h.readSettings(f);
const tag = '[preset tickets: tickets-nudge]';
const def = (f, name) => h.readJson(path.join(f.presets, `${name}.json`));

test('activating a preset adds its hook as its own tagged entry and leaves every other hook alone', (t) => {
  const f = setup(t);
  const dry = h.run(f, ['add', 'tickets']);
  assert.strictEqual(dry.code, 0, dry.err);
  assert.match(dry.out, /hook\+\s+tickets-nudge/);
  assert.deepStrictEqual(settings(f).hooks, OLD_HOOKS);
  const r = h.run(f, ['add', 'tickets', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(settings(f).hooks.PostToolUse, [
    { matcher: 'Bash', hooks: [{ type: 'command', command: 'node tt.js nudge', statusMessage: tag }] },
  ]);
  assert.deepStrictEqual(settings(f).hooks.PreToolUse, OLD_HOOKS.PreToolUse);
  assert.deepStrictEqual(settings(f).hooks.UserPromptSubmit, OLD_HOOKS.UserPromptSubmit);
  assert.deepStrictEqual(settings(f).enabledPlugins, { a: true });
});

test('a hook-only change needs no restart', (t) => {
  const f = setup(t);
  h.writePreset(f, 'tickets', [], [], [NUDGE]);
  const r = h.run(f, ['add', 'tickets', '--yes']);
  assert.match(r.out, /already active/i);
  assert.doesNotMatch(r.out, /restart the session/i);
});

test('removing the preset removes only its hook and the empty entry', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'tickets', '--yes']);
  const r = h.run(f, ['remove', 'tickets', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(settings(f).hooks, OLD_HOOKS);
});

test('a hook with no matcher is added without one', (t) => {
  const f = setup(t);
  h.writePreset(f, 'tickets', ['tickets-tree'], [], [{ id: 'note', event: 'UserPromptSubmit', command: 'echo note' }]);
  h.run(f, ['add', 'tickets', '--yes']);
  const groups = settings(f).hooks.UserPromptSubmit;
  assert.strictEqual(groups.length, 2);
  assert.deepStrictEqual(groups[1], {
    hooks: [{ type: 'command', command: 'echo note', statusMessage: '[preset tickets: note]' }],
  });
});

test('an identical hook that already exists is tagged, not duplicated, and a second apply changes nothing', (t) => {
  const f = setup(t, {
    ...OLD_HOOKS,
    PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node tt.js nudge' }] }],
  });
  const dry = h.run(f, ['add', 'tickets']);
  assert.match(dry.out, /hook~\s+tickets-nudge/);
  assert.doesNotMatch(dry.out, /hook\+/);
  h.run(f, ['add', 'tickets', '--yes']);
  assert.strictEqual(settings(f).hooks.PostToolUse.length, 1);
  assert.strictEqual(settings(f).hooks.PostToolUse[0].hooks[0].statusMessage, tag);
  const again = h.run(f, ['apply', '--yes']);
  assert.match(again.out, /nothing to change/i);
});

test('a managed hook deleted by hand comes back on the next apply', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'tickets', '--yes']);
  const s = settings(f);
  delete s.hooks.PostToolUse;
  h.writeSettings(f, s);
  const r = h.run(f, ['apply']);
  assert.match(r.out, /hook\+\s+tickets-nudge/);
});

test('hooks that no preset names are never planned', (t) => {
  const f = setup(t);
  const r = h.run(f, ['apply']);
  assert.doesNotMatch(r.out, /hook[+~-]/);
});

test('rollback restores the hooks', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'tickets', '--yes']);
  const r = h.run(f, ['rollback', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(settings(f).hooks, OLD_HOOKS);
});

test('a hook id used by two presets is refused naming it', (t) => {
  const f = setup(t);
  h.writePreset(f, 'other', ['plain-x'], [], [{ ...NUDGE, command: 'echo other' }]);
  const r = h.run(f, ['status']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /tickets-nudge/);
});

test('a malformed hook definition is refused naming the file', (t) => {
  const f = setup(t);
  h.writePreset(f, 'bad', ['plain-x'], [], [{ id: 'x', event: 'Post Tool', command: 'echo' }]);
  const r = h.run(f, ['status']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /bad\.json/);
  h.writePreset(f, 'bad', ['plain-x'], [], [{ id: 'x', event: 'PostToolUse' }]);
  assert.match(h.run(f, ['status']).err, /bad\.json/);
});

test('the inventory shows owners, unmanaged hooks and hooks defined but not installed', (t) => {
  const f = setup(t);
  const before = h.run(f, ['hooks']);
  assert.strictEqual(before.code, 0, before.err);
  assert.match(before.out, /1\. PreToolUse\s+Write\|Edit\|Bash\s+unmanaged/);
  assert.match(before.out, /2\. UserPromptSubmit\s+\(no matcher\)\s+unmanaged/);
  assert.match(before.out, /defined but not installed.*tickets-nudge.*tickets/is);
  h.run(f, ['add', 'tickets', '--yes']);
  const after = h.run(f, ['hooks']);
  assert.match(after.out, /3\. PostToolUse\s+Bash\s+preset tickets: tickets-nudge/);
  assert.match(after.out, /Nudge after a ticket changes\./);
  assert.doesNotMatch(after.out, /defined but not installed/i);
});

test('status counts the unmanaged hooks', (t) => {
  const f = setup(t);
  assert.match(h.run(f, ['status']).out, /Unmanaged hooks: 2/);
});

test('adopt copies a numbered unmanaged hook into a preset and leaves settings.json unchanged', (t) => {
  const f = setup(t);
  const before = fs.readFileSync(path.join(f.root, 'settings.json'), 'utf8');
  const dry = h.run(f, ['hook', 'adopt', '2', '--in', 'tickets', '--id', 'prompt-note', '--note', 'Adds a note.']);
  assert.strictEqual(dry.code, 0, dry.err);
  assert.strictEqual(def(f, 'tickets').hooks.length, 1);
  const r = h.run(f, ['hook', 'adopt', '2', '--in', 'tickets', '--id', 'prompt-note', '--note', 'Adds a note.', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(def(f, 'tickets').hooks[1], {
    id: 'prompt-note',
    event: 'UserPromptSubmit',
    command: 'echo prompt',
    note: 'Adds a note.',
  });
  assert.strictEqual(fs.readFileSync(path.join(f.root, 'settings.json'), 'utf8'), before);
  assert.doesNotMatch(h.run(f, ['apply']).out, /hook~/, 'an inactive preset tags nothing');
  h.writeActive(f, ['tickets']);
  assert.match(h.run(f, ['apply']).out, /hook~\s+prompt-note/);
});

test('adopt refuses a number out of range, a managed hook and an unknown preset', (t) => {
  const f = setup(t);
  assert.notStrictEqual(h.run(f, ['hook', 'adopt', '9', '--in', 'tickets', '--id', 'x', '--yes']).code, 0);
  h.run(f, ['add', 'tickets', '--yes']);
  const managed = h.run(f, ['hook', 'adopt', '3', '--in', 'plain', '--id', 'x', '--yes']);
  assert.notStrictEqual(managed.code, 0);
  assert.match(managed.err, /already managed/i);
  assert.notStrictEqual(h.run(f, ['hook', 'adopt', '1', '--in', 'nope', '--id', 'x', '--yes']).code, 0);
});

test('define writes a hook into a preset and refuses bad input', (t) => {
  const f = setup(t);
  const args = ['hook', 'define', '--in', 'plain', '--id', 'p-hook', '--event', 'PostToolUse', '--matcher', 'Bash', '--command', 'echo hi', '--note', 'n'];
  assert.strictEqual(h.run(f, args).code, 0);
  assert.strictEqual('hooks' in def(f, 'plain'), false);
  const r = h.run(f, [...args, '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(def(f, 'plain').hooks, [{ id: 'p-hook', event: 'PostToolUse', matcher: 'Bash', command: 'echo hi', note: 'n' }]);
  assert.match(h.run(f, [...args, '--yes']).err, /p-hook/);
  assert.notStrictEqual(h.run(f, ['hook', 'define', '--in', 'nope', '--id', 'z', '--event', 'PostToolUse', '--command', 'x', '--yes']).code, 0);
  assert.notStrictEqual(h.run(f, ['hook', 'define', '--in', 'plain', '--id', 'z', '--event', 'PostToolUse', '--yes']).code, 0);
});

test('drop removes a hook from a preset and refuses an unknown id', (t) => {
  const f = setup(t);
  const r = h.run(f, ['hook', 'drop', '--in', 'tickets', '--id', 'tickets-nudge', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual('hooks' in def(f, 'tickets'), false);
  assert.match(h.run(f, ['hook', 'drop', '--in', 'tickets', '--id', 'tickets-nudge', '--yes']).err, /tickets-nudge/);
});

test('updating skills or plugins keeps the hooks of a preset', (t) => {
  const f = setup(t);
  const r = h.run(f, ['update', 'tickets', '--add', 'plain-x', '--yes']);
  assert.strictEqual(r.code, 0, r.err);
  assert.deepStrictEqual(def(f, 'tickets').hooks, [NUDGE]);
});

test('a hook dropped from its preset is removed from settings.json by the next apply', (t) => {
  const f = setup(t);
  h.run(f, ['add', 'tickets', '--yes']);
  h.run(f, ['hook', 'drop', '--in', 'tickets', '--id', 'tickets-nudge', '--yes']);
  const dry = h.run(f, ['apply']);
  assert.match(dry.out, /hook-\s+tickets-nudge/);
  h.run(f, ['apply', '--yes']);
  assert.deepStrictEqual(settings(f).hooks, OLD_HOOKS);
});

test('removing a managed hook never deletes unmanaged entries of the same event', (t) => {
  const f = setup(t, { ...OLD_HOOKS, Stop: [{ hooks: [] }] });
  h.writePreset(f, 'tickets', ['tickets-tree'], [], [{ id: 'stop-note', event: 'Stop', command: 'echo stop' }]);
  h.run(f, ['add', 'tickets', '--yes']);
  assert.strictEqual(settings(f).hooks.Stop.length, 2);
  h.run(f, ['remove', 'tickets', '--yes']);
  assert.deepStrictEqual(settings(f).hooks.Stop, [{ hooks: [] }]);
  assert.deepStrictEqual(settings(f).hooks.PreToolUse, OLD_HOOKS.PreToolUse);
});

test('only the tagged one of two identical commands in a group is removed', (t) => {
  const f = setup(t, {
    ...OLD_HOOKS,
    PostToolUse: [
      {
        matcher: 'Bash',
        hooks: [
          { type: 'command', command: 'node tt.js nudge' },
          { type: 'command', command: 'node tt.js nudge', statusMessage: tag },
        ],
      },
    ],
  });
  const dry = h.run(f, ['apply']);
  assert.match(dry.out, /hook-\s+tickets-nudge/);
  h.run(f, ['apply', '--yes']);
  assert.deepStrictEqual(settings(f).hooks.PostToolUse, [
    { matcher: 'Bash', hooks: [{ type: 'command', command: 'node tt.js nudge' }] },
  ]);
});

test('a hook that already has its own statusMessage is never retagged or removed', (t) => {
  const own = { matcher: 'Bash', hooks: [{ type: 'command', command: 'node tt.js nudge', statusMessage: 'mine' }] };
  const f = setup(t, { ...OLD_HOOKS, PostToolUse: [own] });
  const dry = h.run(f, ['add', 'tickets']);
  assert.doesNotMatch(dry.out, /hook[+~]/);
  h.run(f, ['add', 'tickets', '--yes']);
  h.run(f, ['remove', 'tickets', '--yes']);
  assert.deepStrictEqual(settings(f).hooks.PostToolUse, [own]);
  assert.match(h.run(f, ['hooks']).out, /preset tickets: tickets-nudge \(untagged\)/);
});

test('an event name that is not a plain PascalCase word is refused, a typo is warned about', (t) => {
  const f = setup(t);
  const bad = h.run(f, ['hook', 'define', '--in', 'plain', '--id', 'k', '--event', 'constructor', '--command', 'echo', '--yes']);
  assert.notStrictEqual(bad.code, 0);
  const typo = h.run(f, ['hook', 'define', '--in', 'plain', '--id', 'k', '--event', 'PostToolUSe', '--command', 'echo', '--yes']);
  assert.strictEqual(typo.code, 0, typo.err);
  assert.match(typo.out, /not a known hook event/i);
});

test('the same event, matcher and command under two ids is refused', (t) => {
  const f = setup(t);
  h.writePreset(f, 'other', ['plain-x'], [], [{ ...NUDGE, id: 'second-id' }]);
  const r = h.run(f, ['status']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /second-id.*tickets-nudge|tickets-nudge.*second-id/);
});

test('the dry run shows the whole command and warns about local paths and secrets', (t) => {
  const f = setup(t);
  const long = `python C:/Users/someone/hooks/run.py ${'x'.repeat(200)}`;
  const dry = h.run(f, ['hook', 'define', '--in', 'plain', '--id', 'p', '--event', 'PostToolUse', '--command', long]);
  assert.ok(dry.out.includes(long), 'the full command is shown');
  assert.match(dry.out, /local path.*public repository/i);
  const secret = h.run(f, ['hook', 'define', '--in', 'plain', '--id', 'q', '--event', 'PostToolUse', '--command', 'curl -H "Authorization: token abc"']);
  assert.match(secret.out, /secret/i);
  const clean = h.run(f, ['hook', 'define', '--in', 'plain', '--id', 'r', '--event', 'PostToolUse', '--command', 'echo hi']);
  assert.doesNotMatch(clean.out, /warning/i);
});

test('an empty matcher is shown as no matcher', (t) => {
  const f = setup(t, { UserPromptSubmit: [{ matcher: '', hooks: [{ type: 'command', command: 'echo a' }] }] });
  assert.match(h.run(f, ['hooks']).out, /1\. UserPromptSubmit\s+\(no matcher\)\s+unmanaged/);
});

test('list --details shows each preset hooks', (t) => {
  const f = setup(t);
  assert.match(h.run(f, ['list', '--details']).out, /tickets: tickets-tree \| hooks: tickets-nudge/);
});
