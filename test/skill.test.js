// Drift guard for the thin skill: what it tells the agent to run must exist in the CLI.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const SKILL = path.join(__dirname, '..', 'skills', 'preset-manager', 'SKILL.md');
const text = () => fs.readFileSync(SKILL, 'utf8');

test('the skill has a name and a trigger description', () => {
  const front = /^---\r?\nname: preset-manager\r?\ndescription: (.+)\r?\n---/.exec(text());
  assert.ok(front, 'frontmatter with name and description');
  assert.match(front[1], /preset/i);
});

test('every command the skill names exists in the CLI', (t) => {
  const f = h.fake();
  t.after(() => h.cleanup(f));
  const listing = h.run(f, []).err; // an unknown command lists the real ones
  const real = /Commands: (.+)$/m.exec(listing)[1].split(', ');
  const used = [...text().matchAll(/`preset ([a-z]+)/g)].map((m) => m[1]);
  assert.ok(used.length >= 8, `skill names too few commands: ${used}`);
  for (const cmd of used) assert.ok(real.includes(cmd), `skill names unknown command "${cmd}"`);
});

test('the CLI path in the skill points at a real file', () => {
  const m = /CLI: `node ([^`]+)`/.exec(text());
  assert.ok(m, 'a "CLI: `node <path>`" line');
  assert.ok(fs.existsSync(m[1]), `${m[1]} does not exist`);
});

test('the skill states the dry-run rule, the proposal rule and the restart notice', () => {
  const t = text();
  assert.match(t, /--yes/);
  assert.match(t, /dry run/i);
  assert.match(t, /proposal/i);
  assert.match(t, /restart/i);
  assert.match(t, /GLOSSARY\.md/);
  // every proposal carries a verdict per skill, built on `preset suggest` evidence
  assert.match(t, /`preset suggest/);
  assert.match(t, /verdict/i);
  assert.match(t, /\bcovered\b/i);
  // the list is shown exactly as printed, without explaining the star
  assert.match(t, /`preset list`.*as printed|as printed.*`preset list`/is);
  assert.match(t, /Do not explain the star/);
  // plugins belong to presets now
  assert.match(t, /--plugins/);
  assert.match(t, /--add-plugins/);
  assert.match(t, /name@marketplace/);
});
