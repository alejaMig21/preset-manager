// The push guard (.githooks/pre-push) against real git and a local bare remote: no network, nothing real is touched.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOKS = path.join(__dirname, '..', '.githooks');
const OK = '108048421+alejaMig21@users.noreply.github.com';
const UNI = `${['jorge', 'padron'].join('.')}@ug.uchile.cl`; // built at runtime so this file holds no literal

function git(cwd, args, env = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-push-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const remote = path.join(dir, 'remote.git');
  const work = path.join(dir, 'work');
  git(dir, ['init', '-q', '--bare', '-b', 'main', remote]);
  git(dir, ['init', '-q', '-b', 'main', work]);
  for (const kv of [['user.name', 't'], ['user.email', OK], ['core.autocrlf', 'false'], ['core.hooksPath', HOOKS]]) {
    git(work, ['config', ...kv]);
  }
  git(work, ['remote', 'add', 'origin', remote]);
  return { dir, remote, work };
}

function commit(work, file, text, email = OK) {
  fs.mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
  fs.writeFileSync(path.join(work, file), text);
  git(work, ['add', '-f', file]);
  const r = git(work, ['commit', '-q', '-m', 'change'], { GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_EMAIL: email });
  assert.strictEqual(r.code, 0, r.err);
}

const push = (work, ...args) => git(work, ['push', ...args]);

test('a clean main, signed with the noreply address, is pushed, and so is the next one', (t) => {
  const { work } = setup(t);
  commit(work, 'a.txt', 'one\n');
  assert.strictEqual(push(work, 'origin', 'main').code, 0);
  commit(work, 'b.txt', 'two\n');
  assert.strictEqual(push(work, 'origin', 'main').code, 0);
});

test('any ref other than main is blocked, branches and tags alike', (t) => {
  const { work } = setup(t);
  commit(work, 'a.txt', 'one\n');
  const branch = push(work, 'origin', 'HEAD:refs/heads/feat/x');
  assert.notStrictEqual(branch.code, 0);
  assert.match(branch.err, /only main/i);
  git(work, ['tag', 'v1']);
  assert.notStrictEqual(push(work, 'origin', 'v1').code, 0);
  git(work, ['branch', 'feat/y']); // with another local branch, --all would publish it too
  const all = push(work, '--all', 'origin');
  assert.notStrictEqual(all.code, 0);
  assert.match(all.err, /only main/i);
});

test('a commit signed with another email is blocked', (t) => {
  const { work } = setup(t);
  commit(work, 'a.txt', 'one\n', UNI);
  const r = push(work, 'origin', 'main');
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /noreply/i);
});

test('a commit that contains presets.local is blocked', (t) => {
  const { work } = setup(t);
  commit(work, 'presets.local/default.json', '{}\n');
  const r = push(work, 'origin', 'main');
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /presets\.local/);
});

test('added lines with the university email, a private project path or a token are blocked', (t) => {
  for (const text of [`${UNI}\n`, 'node "D:/Projects/AI/dev-tickets-tree/x.js"\n', 'python C:/Users/aleja/h.py\n', `${'ghp_'}${'a'.repeat(20)}\n`]) {
    const { work } = setup(t);
    commit(work, 'notes.txt', text);
    const r = push(work, 'origin', 'main');
    assert.notStrictEqual(r.code, 0, `should block: ${text.trim()}`);
    assert.match(r.err, /personal or secret/i);
  }
});

test('rewriting main on the remote is blocked', (t) => {
  const { work } = setup(t);
  commit(work, 'a.txt', 'one\n');
  commit(work, 'b.txt', 'two\n');
  assert.strictEqual(push(work, 'origin', 'main').code, 0);
  git(work, ['reset', '-q', '--hard', 'HEAD~1']);
  commit(work, 'c.txt', 'three\n');
  const r = push(work, '--force', 'origin', 'main');
  assert.notStrictEqual(r.code, 0);
  assert.match(r.err, /rewrite/i);
});

test('deleting a remote branch is allowed because it publishes nothing', (t) => {
  const { work, remote } = setup(t);
  commit(work, 'a.txt', 'one\n');
  assert.strictEqual(push(work, 'origin', 'main').code, 0);
  git(remote, ['branch', 'feat/old', 'main']);
  assert.strictEqual(push(work, 'origin', '--delete', 'feat/old').code, 0);
});

test('the repository enables the guard through core.hooksPath and ignores nothing it needs', () => {
  const claude = fs.readFileSync(path.join(__dirname, '..', 'CLAUDE.md'), 'utf8');
  assert.match(claude, /core\.hooksPath \.githooks/);
  assert.match(claude, /git push origin main/);
});
