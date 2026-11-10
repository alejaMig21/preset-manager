// One-time conversion of the old preset format (one active preset, off-lists, plugins) to the new one.
const fs = require('node:fs');
const path = require('node:path');
const { UserError, readJsonFile, NAME, stamp, definitionText } = require('./store');

const BASE = ['find-skills', 'preset-manager', 'skill-creator', 'dev-journal'];
const RETIRED = ['core', 'engineering_productivity'];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function readOld(dir) {
  if (!fs.existsSync(dir)) throw new UserError(`${dir}: old presets folder not found`);
  const presets = {};
  for (const entry of fs.readdirSync(dir).sort()) {
    if (!entry.endsWith('.json')) continue;
    const stem = entry.slice(0, -5);
    const data = readJsonFile(path.join(dir, entry));
    // active.json and settings backups live here too; only real old presets have skills_on.
    if (data && data.name === stem && Array.isArray(data.skills_on)) presets[stem] = data;
  }
  const activeFile = path.join(dir, 'active.json');
  return { presets, active: fs.existsSync(activeFile) ? readJsonFile(activeFile) : null };
}

function ownSkills(file, data) {
  const seen = new Set();
  const out = [];
  for (const s of data.skills_on) {
    if (!s || !NAME.test(s.name) || typeof s.source !== 'string') {
      throw new UserError(`${file}: invalid skill entry ${JSON.stringify(s)}`);
    }
    if (BASE.includes(s.name) || seen.has(s.name)) continue;
    seen.add(s.name);
    out.push({ name: s.name, source: s.source });
  }
  return out;
}

// Text of the fragments an old preset imported, except base.md (which only documented the mechanism).
function fragmentText(from, data) {
  const root = path.resolve(from);
  const texts = [];
  for (const entry of data.fragments || []) {
    const file = path.resolve(root, entry);
    if (path.basename(file) === 'base.md' || !file.startsWith(root + path.sep) || !fs.existsSync(file)) continue;
    texts.push(fs.readFileSync(file, 'utf8'));
  }
  return texts.join('\n');
}

// Splits one fragment between two presets line by line: a line that names only one preset's skills goes
// with that preset; structure and lines naming both (or neither) go to both, so nothing is lost.
function splitText(text, engNames, prodNames) {
  const only = (mine, other) => mine.filter((n) => !other.includes(n) && !BASE.includes(n));
  const eOnly = only(engNames, prodNames);
  const pOnly = only(prodNames, engNames);
  const names = (line, list) => list.some((n) => new RegExp(`(?<![\\w-])${escapeRe(n)}(?![\\w-])`).test(line));
  let eng = '';
  let prod = '';
  for (const line of text.split(/(?<=\n)/)) {
    const e = names(line, eOnly);
    const p = names(line, pOnly);
    if (e && !p) eng += line;
    else if (p && !e) prod += line;
    else {
      eng += line;
      prod += line;
    }
  }
  return { eng, prod };
}

function build(from) {
  const { presets: old, active } = readOld(from);
  const sources = new Map();
  for (const d of Object.values(old)) for (const s of d.skills_on) if (!sources.has(s.name)) sources.set(s.name, s.source);
  const defs = {
    default: {
      description: 'Always on: the base skills.',
      skills: BASE.map((name) => ({ name, source: sources.get(name) || 'top' })),
    },
  };
  const skipped = [];
  if (old.core) {
    const skills = ownSkills('core.json', old.core);
    if (skills.length) defs.prototyping = { description: 'Prototyping skills, split out of the old core preset.', skills };
  }
  for (const [name, data] of Object.entries(old)) {
    if (RETIRED.includes(name) || name === 'default' || name === 'prototyping') continue;
    const skills = ownSkills(`${name}.json`, data);
    if (skills.length) defs[name] = { description: data.description || '', skills };
    else skipped.push(name);
  }
  const fragments = {};
  for (const name of Object.keys(defs)) {
    if (name === 'default' || name === 'prototyping') continue;
    const text = fragmentText(from, old[name]);
    if (text) fragments[name] = text;
  }
  if (old.engineering_productivity && defs.engineering && defs.productivity) {
    const text = fragmentText(from, old.engineering_productivity);
    if (text) {
      const { eng, prod } = splitText(text, defs.engineering.skills.map((s) => s.name), defs.productivity.skills.map((s) => s.name));
      fragments.engineering = (fragments.engineering || '') + eng;
      fragments.productivity = (fragments.productivity || '') + prod;
    }
  }
  let names = [];
  const was = active && typeof active.active === 'string' ? active.active : null;
  if (was === 'engineering_productivity') names = ['engineering', 'productivity'].filter((n) => defs[n]);
  else if (was && was !== 'core' && defs[was]) names = [was];
  const since = (active && active.since) || new Date().toISOString().slice(0, 10);
  return { defs, fragments, skipped, activeEntries: names.map((name) => ({ name, since })), retired: Object.keys(old).filter((n) => RETIRED.includes(n)) };
}

function convert(p, yes) {
  const marker = path.join(p.state, 'converted.json');
  if (fs.existsSync(marker)) throw new UserError(`already converted (${marker}); the conversion runs once`);
  if (fs.existsSync(p.activeFile)) throw new UserError(`${p.activeFile} already exists: the new system is in use, refusing to convert`);
  const { defs, fragments, skipped, activeEntries, retired } = build(p.from);
  const targets = [
    ...Object.keys(defs).map((n) => path.join(p.presets, `${n}.json`)),
    ...Object.keys(fragments).map((n) => path.join(p.fragments, `${n}.md`)),
  ];
  const clash = targets.filter((f) => fs.existsSync(f));
  if (clash.length) throw new UserError(`would overwrite existing files, nothing written: ${clash.join(', ')}`);

  const summary = [
    `  presets: ${Object.entries(defs).map(([n, d]) => `${n} (${d.skills.length})`).join(', ')}`,
    `  retired: ${retired.join(', ') || '(none)'}${skipped.length ? `; only base skills, not converted: ${skipped.join(', ')}` : ''}`,
    `  fragments: ${Object.entries(fragments).map(([n, t]) => `${n}.md (${Buffer.byteLength(t)} bytes)`).join(', ') || '(none)'}`,
    `  active: ${activeEntries.map((a) => a.name).join(', ') || '(none; default is always on)'}`,
    `  the old files in ${p.from} stay untouched; a backup copy is made first.`,
  ].join('\n');
  if (!yes) return `Conversion plan (dry run, nothing written):\n${summary}\nRe-run with --yes to convert.`;

  const created = [];
  const put = (file, text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    created.push(file);
  };
  try {
    fs.cpSync(p.from, path.join(p.backups, `${stamp()}-convert`, 'old-presets'), {
      recursive: true,
      filter: (src) => path.basename(src) !== 'backups',
    });
    for (const [name, d] of Object.entries(defs)) {
      put(path.join(p.presets, `${name}.json`), definitionText(name, d.description, d.skills));
    }
    for (const [name, text] of Object.entries(fragments)) put(path.join(p.fragments, `${name}.md`), text);
    put(p.activeFile, `${JSON.stringify({ active: activeEntries }, null, 2)}\n`);
    put(marker, `${JSON.stringify({ at: new Date().toISOString(), from: p.from })}\n`);
  } catch (e) {
    for (const file of created.reverse()) fs.rmSync(file, { force: true });
    throw new UserError(`convert failed and was rolled back: ${e.message}`);
  }
  return `Converted.\n${summary}\nNext: review the definitions, then run "preset apply" (dry run first).`;
}

module.exports = { convert };
