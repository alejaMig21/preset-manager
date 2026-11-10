// The single test seam: run the real CLI against a fresh fake config root.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'preset.js');

function fake() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-test-'));
  const f = {
    dir,
    root: path.join(dir, 'claude'),
    presets: path.join(dir, 'presets'),
    external: path.join(dir, 'external'),
  };
  fs.mkdirSync(path.join(f.root, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(f.presets, 'fragments'), { recursive: true });
  fs.mkdirSync(f.external, { recursive: true });
  return f;
}

function run(f, args, input) {
  const r = spawnSync(process.execPath, [BIN, ...args, '--root', f.root, '--presets', f.presets], {
    encoding: 'utf8',
    input,
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function writePreset(f, name, skills) {
  const list = skills.map((s) => (typeof s === 'string' ? { name: s, source: 'top' } : s));
  fs.writeFileSync(
    path.join(f.presets, `${name}.json`),
    JSON.stringify({ name, description: `${name} preset`, skills: list }, null, 2),
  );
}

function writeFragment(f, name, text) {
  fs.writeFileSync(path.join(f.presets, 'fragments', `${name}.md`), text);
}

// A real skill folder: <root>/skills/<group>/<name>, or <root>/skills/<name> when group is null.
function makeSkill(f, name, group = null) {
  const dir = group ? path.join(f.root, 'skills', group, name) : path.join(f.root, 'skills', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n`);
  return dir;
}

function makeExternalSkill(f, name) {
  const dir = path.join(f.external, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n`);
  return dir;
}

// Pre-existing junction <root>/skills/<name> -> target, as the old system left them.
function linkSkill(f, name, target) {
  fs.symlinkSync(target, path.join(f.root, 'skills', name), 'junction');
}

function isLink(f, name) {
  try {
    return fs.lstatSync(path.join(f.root, 'skills', name)).isSymbolicLink();
  } catch {
    return false;
  }
}

function writeActive(f, names) {
  const dir = path.join(f.root, 'preset-manager');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'active.json'),
    JSON.stringify({ active: names.map((name) => ({ name, since: '2026-11-01' })) }),
  );
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readSettings(f) {
  return readJson(path.join(f.root, 'settings.json'));
}

function writeSettings(f, obj) {
  fs.writeFileSync(path.join(f.root, 'settings.json'), JSON.stringify(obj, null, 2));
}

function activeNames(f) {
  return readJson(path.join(f.root, 'preset-manager', 'active.json')).active.map((a) => a.name);
}

function cleanup(f) {
  // Remove links first so a recursive delete can never follow one into a real folder.
  const skills = path.join(f.root, 'skills');
  for (const e of fs.readdirSync(skills, { withFileTypes: true })) {
    const p = path.join(skills, e.name);
    if (fs.lstatSync(p).isSymbolicLink()) fs.rmdirSync(p);
  }
  fs.rmSync(f.dir, { recursive: true, force: true });
}

module.exports = {
  fake, run, writePreset, writeFragment, makeSkill, makeExternalSkill, linkSkill, isLink, writeActive,
  readJson, readSettings, writeSettings, activeNames, cleanup,
};
