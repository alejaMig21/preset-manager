// Creating, updating, deleting and listing preset definitions (files in the repo).
const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');
const skills = require('./skills');
const plan = require('./plan');
const { reconcile } = require('./reconcile');

const { NAME, PLUGIN, stamp, definitionText } = store;
const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
const fail = (msg) => new store.UserError(msg);
const names = (arr) => arr.map((s) => s.name).join(', ');
const describe = (skillList, plugins) => `skills: ${names(skillList) || '(none)'}${plugins.length ? `; plugins: ${plugins.join(', ')}` : ''}`;

// A plugin id must be well formed and known to Claude Code (installed or already in enabledPlugins).
function checkPlugins(p, ids) {
  const known = plan.knownPlugins(p, store.loadSettings(p));
  for (const id of ids) {
    if (!PLUGIN.test(id)) throw fail(`invalid plugin id "${id}" (expected name@marketplace)`);
    if (!known.has(id)) throw fail(`plugin "${id}" is not installed`);
  }
  return ids;
}

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

function write(p, name, description, skillList, plugins) {
  fs.writeFileSync(path.join(p.presets, `${name}.json`), definitionText(name, description, skillList, plugins));
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
  const plugins = checkPlugins(p, list(v.plugins));
  if (!picked.length && !plugins.length) throw fail('a preset needs at least one skill or one plugin: pass --skills a,b or --plugins name@marketplace');
  if (!v.yes) return `Would create preset "${name}" with ${describe(picked, plugins)}\nRe-run with --yes to write it.`;
  write(p, name, v.description || '', picked, plugins);
  return `Created preset "${name}" with ${describe(picked, plugins)}`;
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
  const dropPlugins = list(v['remove-plugins']);
  const notListed = dropPlugins.filter((id) => !preset.plugins.includes(id));
  if (notListed.length) throw fail(`preset "${name}" does not list the plugin: ${notListed.join(', ')}`);
  const addPlugins = checkPlugins(p, list(v['add-plugins']));
  const both = addPlugins.filter((id) => dropPlugins.includes(id));
  if (both.length) throw fail(`the plugin is in both --add-plugins and --remove-plugins: ${both.join(', ')}`);
  const keptPlugins = preset.plugins.filter((id) => !dropPlugins.includes(id));
  const nextPlugins = [...keptPlugins, ...addPlugins.filter((id) => !keptPlugins.includes(id))];
  if (!next.length && !nextPlugins.length) throw fail(`a preset needs at least one skill or one plugin; use "preset delete ${name}" instead`);
  if (!v.yes) return `Would update preset "${name}" to ${describe(next, nextPlugins)}\nRe-run with --yes to write it.`;
  write(p, name, preset.description, next, nextPlugins);
  const active = store.loadActive(p).some((a) => a.name === name);
  const elsewhere = new Set(Object.values(presets).filter((x) => x.name !== name).flatMap((x) => x.skills.map((s) => s.name)));
  const unassigned = drop.filter((n) => !elsewhere.has(n) && !next.some((s) => s.name === n));
  return [
    `Updated preset "${name}": ${describe(next, nextPlugins)}`,
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

function show(p, details) {
  const presets = store.loadPresets(p);
  const active = new Set(store.loadActive(p).map((a) => a.name));
  if (!details) {
    // One name per line; "*" marks the active ones, and default is always on.
    return Object.keys(presets)
      .map((n) => `${n === 'default' || active.has(n) ? '*' : ' '} ${n}${n === 'default' ? ' (always on)' : ''}`)
      .join('\n');
  }
  return Object.values(presets)
    .map((x) => `${x.name}: ${names(x.skills) || '(no skills)'}${x.plugins.length ? ` | plugins: ${x.plugins.join(', ')}` : ''}${active.has(x.name) ? ' [active]' : ''}`)
    .join('\n');
}

module.exports = { create, update, remove, show };
