// What is installed under <root>/skills: top-level skills, links, and skills inside groups.
const fs = require('node:fs');
const path = require('node:path');
const { UserError } = require('./store');

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const isLink = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
const hasSkill = (dir) => fs.existsSync(path.join(dir, 'SKILL.md'));

// Returns { installed: Map(name -> Set(source)), broken: [{ name, target }] }.
// A source is "top" (real folder), "<group>/<folder>", or an absolute path outside the skills folder.
function scan(p) {
  const installed = new Map();
  const broken = [];
  if (!isDir(p.skills)) return { installed, broken };
  const realSkills = fs.realpathSync(p.skills);
  const add = (name, source) => {
    if (!installed.has(name)) installed.set(name, new Set());
    installed.get(name).add(source);
  };
  for (const entry of fs.readdirSync(p.skills).sort()) {
    const full = path.join(p.skills, entry);
    const link = isLink(full);
    if (link && !isDir(full)) {
      broken.push({ name: entry, target: fs.readlinkSync(full) });
    } else if (!isDir(full)) {
      continue;
    } else if (hasSkill(full)) {
      if (!link) add(entry, 'top');
      else {
        const real = fs.realpathSync(full);
        const rel = path.relative(realSkills, real);
        add(entry, rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : real);
      }
    } else if (!link) {
      for (const child of fs.readdirSync(full).sort()) {
        const dir = path.join(full, child);
        if (isDir(dir) && hasSkill(dir)) add(child, `${entry}/${child}`);
      }
    }
  }
  return { installed, broken };
}

// The single source for an installed skill name, or undefined. Groups win over links and "top".
function sourceOf(installed, name) {
  const sources = [...(installed.get(name) || [])];
  if (!sources.length) return undefined;
  const groups = sources.filter((s) => s !== 'top' && !path.isAbsolute(s));
  if (groups.length > 1) {
    throw new UserError(`skill "${name}" is in several groups (${groups.join(', ')}); pass ${name}=<group>/${name}`);
  }
  return groups[0] || sources.find((s) => s === 'top') || sources[0];
}

// An explicit "name=source" must really point at a skill folder.
function checkSource(p, name, source) {
  const bad = (why) => new UserError(`skill "${name}": source "${source}" ${why}`);
  if (source === 'top') {
    if (!hasSkill(path.join(p.skills, name))) throw bad(`has no skill folder at ${path.join(p.skills, name)}`);
    return;
  }
  const dir = path.isAbsolute(source) ? source : path.join(p.skills, ...source.split('/'));
  if (!path.isAbsolute(source) && (source.split('/').length !== 2 || source.split('/').includes('..'))) {
    throw bad('must be "top", "<group>/<folder>" or an absolute path');
  }
  if (!isDir(dir) || !hasSkill(dir)) throw bad(`is not a skill folder (${dir})`);
}

// Installed skills that no preset names, plus broken links.
function unassigned(p, presets) {
  const { installed, broken } = scan(p);
  const managed = new Set(Object.values(presets).flatMap((x) => x.skills.map((s) => s.name)));
  return { names: [...installed.keys()].filter((n) => !managed.has(n)).sort(), broken };
}

module.exports = { scan, sourceOf, checkSource, unassigned };
