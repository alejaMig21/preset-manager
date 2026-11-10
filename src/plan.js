// Turning "which presets are active" into the actions needed on the skills folder and settings.
const fs = require('node:fs');
const path = require('node:path');
const { UserError } = require('./store');

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

function format(actions) {
  return actions
    .map((a) => `  ${a.kind.padEnd(7)} ${a.name}${a.target ? ` -> ${a.target}` : ''}`)
    .join('\n');
}

module.exports = { skillActions, format };
