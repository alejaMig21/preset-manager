// Turning "which presets are active" into the actions needed on the skills folder and settings.
const fs = require('node:fs');
const path = require('node:path');
const { UserError } = require('./store');
const claudemd = require('./claudemd');

function targetOf(p, source) {
  if (source === 'top') return null; // a real folder already in <root>/skills
  return path.isAbsolute(source) ? source : path.join(p.skills, ...source.split('/'));
}

function linkState(file) {
  try {
    return { exists: true, link: fs.lstatSync(file).isSymbolicLink() };
  } catch {
    return { exists: false, link: false };
  }
}

function pointsAt(link, target) {
  try {
    return fs.realpathSync(link) === fs.realpathSync(target);
  } catch {
    return false;
  }
}

// Every skill any preset names, with its single source. Two sources for one name is an error.
function managedSkills(presets) {
  const byName = {};
  for (const preset of Object.values(presets)) {
    for (const s of preset.skills) {
      const prev = byName[s.name];
      if (prev && prev.source !== s.source) {
        throw new UserError(
          `skill "${s.name}" has conflicting sources: "${prev.source}" (${prev.preset}) vs "${s.source}" (${preset.name})`,
        );
      }
      byName[s.name] = { source: s.source, preset: preset.name };
    }
  }
  return byName;
}

// Skill actions: link, unlink, on (drop an "off" override), off (add one). Only managed skills.
function skillActions(p, presets, activeNames, settings) {
  const overrides = settings.skillOverrides || {};
  const wanted = new Set();
  for (const name of ['default', ...activeNames]) for (const s of presets[name].skills) wanted.add(s.name);
  const actions = [];
  for (const [name, { source }] of Object.entries(managedSkills(presets)).sort()) {
    const link = path.join(p.skills, name);
    const state = linkState(link);
    if (wanted.has(name)) {
      const target = targetOf(p, source);
      if (target) {
        if (!fs.existsSync(target)) throw new UserError(`skill "${name}": source not found: ${target}`);
        if (!state.exists) actions.push({ kind: 'link', name, target });
        else if (state.link && !pointsAt(link, target)) {
          actions.push({ kind: 'unlink', name }, { kind: 'link', name, target });
        }
      }
      if (overrides[name] === 'off') actions.push({ kind: 'on', name });
    } else {
      if (overrides[name] !== 'off') actions.push({ kind: 'off', name });
      if (state.link) actions.push({ kind: 'unlink', name });
    }
  }
  return actions;
}

// Names whose fragment is imported: default first, then the active presets, only those with a fragment.
function desiredBlocks(presets, activeNames) {
  return [...new Set(['default', ...activeNames])].filter((n) => presets[n].hasFragment);
}

function sameFile(a, b) {
  try {
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

// CLAUDE.md actions: block- (remove), block+ (add or rewrite), text (fragment copy is out of date).
function blockActions(p, presets, activeNames) {
  const desired = desiredBlocks(presets, activeNames);
  const text = fs.existsSync(p.claudeMd) ? fs.readFileSync(p.claudeMd, 'utf8') : '';
  const { add, remove } = claudemd.diff(text, desired, p.claudeMd);
  const actions = [
    ...remove.map((name) => ({ kind: 'block-', name })),
    ...add.map((name) => ({ kind: 'block+', name })),
  ];
  for (const name of desired) {
    const stale = !sameFile(path.join(p.fragments, `${name}.md`), path.join(p.stateFragments, `${name}.md`));
    if (!add.includes(name) && stale) actions.push({ kind: 'text', name });
  }
  return actions;
}

function fragmentBytes(p, presets, activeNames) {
  return desiredBlocks(presets, activeNames).reduce(
    (sum, name) => sum + fs.statSync(path.join(p.fragments, `${name}.md`)).size,
    0,
  );
}

// Plugins Claude Code knows about: the installed ones plus any already named in enabledPlugins.
function knownPlugins(p, settings) {
  const known = new Set(Object.keys(settings.enabledPlugins || {}));
  const file = path.join(p.root, 'plugins', 'installed_plugins.json');
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const id of Object.keys(data.plugins || data)) known.add(id);
  }
  return known;
}

// Plugin actions: plugin+ (turn on), plugin- (turn off). Only managed plugins; the rest are left alone.
function pluginActions(p, presets, activeNames, settings) {
  const enabled = settings.enabledPlugins || {};
  const managed = new Set(Object.values(presets).flatMap((x) => x.plugins));
  const wanted = new Set(['default', ...activeNames].flatMap((n) => presets[n].plugins));
  const known = knownPlugins(p, settings);
  const actions = [];
  for (const id of [...managed].sort()) {
    if (wanted.has(id)) {
      if (!known.has(id)) throw new UserError(`plugin "${id}" is not installed (a preset you are applying names it)`);
      if (enabled[id] !== true) actions.push({ kind: 'plugin+', name: id });
    } else if (enabled[id] === true) {
      actions.push({ kind: 'plugin-', name: id });
    }
  }
  return actions;
}

// Known plugins that no preset names.
function unmanagedPlugins(p, presets, settings) {
  const managed = new Set(Object.values(presets).flatMap((x) => x.plugins));
  return [...knownPlugins(p, settings)].filter((id) => !managed.has(id)).sort();
}

function format(actions) {
  return actions
    .map((a) => `  ${a.kind.padEnd(7)} ${a.name}${a.target ? ` -> ${a.target}` : ''}`)
    .join('\n');
}

module.exports = { skillActions, blockActions, pluginActions, unmanagedPlugins, desiredBlocks, fragmentBytes, format };
