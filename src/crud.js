// Creating, updating, deleting and listing preset definitions (files in the repo).
const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');
const skills = require('./skills');
const { reconcile } = require('./reconcile');

const { NAME, stamp, definitionText } = store;
const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
const fail = (msg) => new store.UserError(msg);
const names = (arr) => arr.map((s) => s.name).join(', ');

// "name" is found among the installed skills; "name=source" is taken as given after checking it.
function resolve(p, specs) {
  const { installed } = skills.scan(p);
  return specs.map((spec) => {
    const eq = spec.indexOf('=');
    const name = eq < 0 ? spec : spec.slice(0, eq);
    if (!NAME.test(name)) throw fail(`invalid skill name "${name}"`);
    if (eq >= 0) {
      const source = spec.slice(eq + 1);
      skills.checkSource(p, name, source);
      return { name, source };
    }
    const source = skills.sourceOf(installed, name);
    if (!source) throw fail(`skill "${name}" not found under ${p.skills} (for a skill elsewhere use ${name}=<absolute path>)`);
    return { name, source };
  });
}

function write(p, name, description, skillList) {
  fs.writeFileSync(path.join(p.presets, `${name}.json`), definitionText(name, description, skillList));
}

function existing(p, name) {
  const presets = store.loadPresets(p);
  if (!presets[name]) throw fail(`preset "${name}" not found`);
  return { presets, preset: presets[name] };
}

function create(p, args, v) {
  const name = args[0];
  if (!name || !NAME.test(name)) throw fail('usage: preset create <name> --skills a,b [--description "..."]');
  if (fs.existsSync(path.join(p.presets, `${name}.json`))) throw fail(`preset "${name}" already exists`);
  const picked = resolve(p, list(v.skills));
  if (!picked.length) throw fail('a preset needs at least one skill: pass --skills a,b');
  if (!v.yes) return `Would create preset "${name}" with skills: ${names(picked)}\nRe-run with --yes to write it.`;
  write(p, name, v.description || '', picked);
  return `Created preset "${name}" with skills: ${names(picked)}`;
}

function update(p, args, v) {
  const name = args[0];
  if (!name) throw fail('usage: preset update <name> [--add a,b] [--remove c]');
  const { presets, preset } = existing(p, name);
  const drop = list(v.remove);
  const missing = drop.filter((n) => !preset.skills.some((s) => s.name === n));
  if (missing.length) throw fail(`preset "${name}" does not contain: ${missing.join(', ')}`);
  const kept = preset.skills.filter((s) => !drop.includes(s.name));
  const added = resolve(p, list(v.add)).filter((s) => !kept.some((k) => k.name === s.name));
  const next = [...kept, ...added];
  if (!next.length) throw fail(`a preset needs at least one skill; use "preset delete ${name}" instead`);
  if (!v.yes) return `Would update preset "${name}" to skills: ${names(next)}\nRe-run with --yes to write it.`;
  write(p, name, preset.description, next);
  const active = store.loadActive(p).some((a) => a.name === name);
  const elsewhere = new Set(Object.values(presets).filter((x) => x.name !== name).flatMap((x) => x.skills.map((s) => s.name)));
  const unassigned = drop.filter((n) => !elsewhere.has(n) && !next.some((s) => s.name === n));
  return [
    `Updated preset "${name}": ${names(next)}`,
    unassigned.length ? `Now unassigned (left exactly as they are): ${unassigned.join(', ')}` : '',
    active ? 'The preset is active: run "preset apply --yes" to apply the change.' : '',
  ].filter(Boolean).join('\n');
}

function remove(p, args, v) {
  const name = args[0];
  if (!name) throw fail('usage: preset delete <name>');
  if (name === 'default') throw fail('"default" cannot be deleted');
  const { presets, preset } = existing(p, name);
  const active = store.loadActive(p);
  const isActive = active.some((a) => a.name === name);
  const others = new Set(Object.values(presets).filter((x) => x.name !== name).flatMap((x) => x.skills.map((s) => s.name)));
  const nowUnassigned = preset.skills.filter((s) => !others.has(s.name));
  const lines = [];
  if (isActive) {
    const next = active.map((a) => a.name).filter((n) => n !== name);
    lines.push(reconcile(p, presets, active, next, `deactivate "${name}"`, Boolean(v.yes)));
  }
  if (!v.yes) {
    lines.push(`Would delete the definition and the fragment of "${name}".`, 'Re-run with --yes to delete it.');
    return lines.join('\n');
  }
  if (isActive) lines.push(`Preset "${name}" was active and has been deactivated.`);
  const saved = path.join(p.backups, `${stamp()}-deleted-${name}`);
  fs.mkdirSync(saved, { recursive: true });
  fs.copyFileSync(path.join(p.presets, `${name}.json`), path.join(saved, `${name}.json`));
  if (preset.hasFragment) fs.copyFileSync(path.join(p.fragments, `${name}.md`), path.join(saved, `${name}.md`));
  fs.rmSync(path.join(p.presets, `${name}.json`));
  fs.rmSync(path.join(p.fragments, `${name}.md`), { force: true });
  lines.push(`Deleted preset "${name}".`);
  if (nowUnassigned.length) lines.push(`Now unassigned (left exactly as they are): ${names(nowUnassigned)}`);
  return lines.join('\n');
}

function show(p) {
  const presets = store.loadPresets(p);
  const active = new Set(store.loadActive(p).map((a) => a.name));
  return Object.values(presets)
    .map((x) => `${x.name}: ${names(x.skills)}${active.has(x.name) ? ' [active]' : ''}`)
    .join('\n');
}

module.exports = { create, update, remove, show };
