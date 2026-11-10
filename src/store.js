// Reading preset definitions (the repo) and the active-preset state (the config root).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

class UserError extends Error {}

// A preset or skill name is a plain folder/file name, never a path.
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PLUGIN = /^[A-Za-z0-9][\w.-]*@[A-Za-z0-9][\w.-]*$/; // "name@marketplace", as in enabledPlugins
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const EVENT = /^[A-Z][A-Za-z]+$/; // a hook event such as PostToolUse (PascalCase, so never an Object.prototype name)
const definitionText = (name, description, skills, plugins = [], hooks = []) =>
  `${JSON.stringify(
    { name, description, skills, ...(plugins.length ? { plugins } : {}), ...(hooks.length ? { hooks } : {}) },
    null,
    2,
  )}\n`;

// A hook definition needs an id, an event and a command; matcher and note are optional text.
function checkHook(h) {
  if (!h || typeof h !== 'object') return 'every hook must be an object';
  if (typeof h.id !== 'string' || !NAME.test(h.id)) return `invalid hook id "${h && h.id}"`;
  if (typeof h.event !== 'string' || !EVENT.test(h.event)) return `hook "${h.id}": invalid event "${h.event}"`;
  if (typeof h.command !== 'string' || !h.command.trim()) return `hook "${h.id}": a non-empty "command" is required`;
  for (const k of ['matcher', 'note']) {
    if (h[k] !== undefined && typeof h[k] !== 'string') return `hook "${h.id}": "${k}" must be text`;
  }
  return '';
}

function paths(opts) {
  const root = path.resolve(opts.root || path.join(os.homedir(), '.claude'));
  const presets = path.resolve(opts.presets || path.join(__dirname, '..', 'presets'));
  const state = path.join(root, 'preset-manager');
  return {
    root,
    presets,
    fragments: path.join(presets, 'fragments'),
    local: path.join(path.dirname(presets), 'presets.local'), // personal definitions, git-ignored
    state,
    from: path.resolve(opts.from || path.join(root, 'presets')), // the old format, read by convert
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
    if (!NAME.test(s.name)) throw bad(`invalid skill name "${s.name}"`);
  }
  if (data.plugins !== undefined && (!Array.isArray(data.plugins) || data.plugins.some((x) => typeof x !== 'string' || !PLUGIN.test(x)))) {
    throw bad('"plugins" must be a list of "name@marketplace" ids');
  }
  if (data.hooks !== undefined) {
    if (!Array.isArray(data.hooks)) throw bad('"hooks" must be a list');
    for (const hk of data.hooks) {
      const problem = checkHook(hk);
      if (problem) throw bad(problem);
    }
  }
}

// The definitions of one folder, as { <name>: { description, skills, plugins, hooks } }.
function readDir(dir) {
  const out = {};
  for (const entry of fs.readdirSync(dir).sort()) {
    if (!entry.endsWith('.json')) continue;
    const file = path.join(dir, entry);
    const stem = entry.slice(0, -5);
    const data = readJsonFile(file);
    validatePreset(file, stem, data);
    out[stem] = { description: data.description || '', skills: data.skills, plugins: data.plugins || [], hooks: data.hooks || [] };
  }
  return out;
}

// Returns { <name>: { name, description, skills, plugins, hooks, hasFragment, src } }. Public definitions come from
// the repo, local ones from the git-ignored folder: a local file adds to the public preset of the same name, and
// `src` keeps what each file holds on its own so a write never copies one into the other.
function loadPresets(p) {
  if (!fs.existsSync(p.presets)) throw new UserError(`${p.presets}: preset definitions folder not found`);
  const pub = readDir(p.presets);
  const loc = fs.existsSync(p.local) ? readDir(p.local) : {};
  const out = {};
  for (const name of [...new Set([...Object.keys(pub), ...Object.keys(loc)])].sort()) {
    const a = pub[name];
    const b = loc[name];
    out[name] = {
      name,
      description: (a && a.description) || (b && b.description) || '',
      skills: [...(a ? a.skills : []), ...(b ? b.skills : [])].filter(
        (s, i, all) => all.findIndex((x) => x.name === s.name && x.source === s.source) === i,
      ),
      plugins: [...new Set([...(a ? a.plugins : []), ...(b ? b.plugins : [])])],
      hooks: [...(a ? a.hooks : []), ...(b ? b.hooks.map((hk) => ({ ...hk, local: true })) : [])],
      hasFragment: Boolean(a) && fs.existsSync(path.join(p.fragments, `${name}.md`)),
      src: { public: a || null, local: b || null },
    };
  }
  const owner = {};
  const shape = {};
  for (const x of Object.values(out)) {
    for (const hk of x.hooks) {
      if (owner[hk.id]) throw new UserError(`${p.presets}: hook id "${hk.id}" is used by both "${owner[hk.id]}" and "${x.name}"`);
      owner[hk.id] = x.name;
      // The same event, matcher and command under two ids would be re-tagged back and forth by every apply.
      const key = [hk.event, hk.matcher ?? '', hk.command].join('\u0000');
      if (shape[key]) throw new UserError(`${p.presets}: hook "${hk.id}" repeats the event, matcher and command of hook "${shape[key]}"`);
      shape[key] = hk.id;
    }
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

module.exports = { UserError, NAME, PLUGIN, EVENT, checkHook, stamp, definitionText, paths, readJsonFile, loadPresets, loadActive, loadSettings };
