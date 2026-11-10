// Reading preset definitions (the repo) and the active-preset state (the config root).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

class UserError extends Error {}

function paths(opts) {
  const root = path.resolve(opts.root || path.join(os.homedir(), '.claude'));
  const presets = path.resolve(opts.presets || path.join(__dirname, '..', 'presets'));
  const state = path.join(root, 'preset-manager');
  return {
    root,
    presets,
    fragments: path.join(presets, 'fragments'),
    state,
    activeFile: path.join(state, 'active.json'),
    stateFragments: path.join(state, 'fragments'),
    // ^ copies of the repo fragments that CLAUDE.md imports (imports are relative to the global file)
    backups: path.join(state, 'backups'),
    settings: path.join(root, 'settings.json'),
    claudeMd: path.join(root, 'CLAUDE.md'),
    skills: path.join(root, 'skills'),
  };
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new UserError(`${file}: invalid JSON: ${e.message}`);
  }
}

function validatePreset(file, stem, data) {
  const bad = (msg) => new UserError(`${file}: ${msg}`);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw bad('must be a JSON object');
  if (data.name !== stem) throw bad(`"name" must be "${stem}"`);
  if (!Array.isArray(data.skills)) throw bad('"skills" must be an array');
  for (const s of data.skills) {
    if (!s || typeof s.name !== 'string' || typeof s.source !== 'string') {
      throw bad('every skill needs a string "name" and "source"');
    }
    // The name becomes a path under <root>/skills, so it must be a plain folder name.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s.name)) throw bad(`invalid skill name "${s.name}"`);
  }
}

// Returns { <name>: { name, description, skills: [{name, source}], hasFragment } }.
function loadPresets(p) {
  if (!fs.existsSync(p.presets)) throw new UserError(`${p.presets}: preset definitions folder not found`);
  const out = {};
  for (const entry of fs.readdirSync(p.presets).sort()) {
    if (!entry.endsWith('.json')) continue;
    const file = path.join(p.presets, entry);
    const stem = entry.slice(0, -5);
    const data = readJsonFile(file);
    validatePreset(file, stem, data);
    out[stem] = {
      name: stem,
      description: data.description || '',
      skills: data.skills,
      hasFragment: fs.existsSync(path.join(p.fragments, `${stem}.md`)),
    };
  }
  if (!out.default) throw new UserError(`${p.presets}: the "default" preset is missing`);
  return out;
}

function loadActive(p) {
  if (!fs.existsSync(p.activeFile)) return [];
  const data = readJsonFile(p.activeFile);
  if (!data || !Array.isArray(data.active)) throw new UserError(`${p.activeFile}: "active" must be an array`);
  return data.active;
}

function loadSettings(p) {
  if (!fs.existsSync(p.settings)) return {};
  const data = readJsonFile(p.settings);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new UserError(`${p.settings}: must be a JSON object`);
  }
  return data;
}

module.exports = { UserError, paths, readJsonFile, loadPresets, loadActive, loadSettings };
