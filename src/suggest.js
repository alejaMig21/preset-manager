// Read-only evidence for placing unassigned skills: which preset they fit, or whether one already covers them.
// It reports facts; the verdict belongs to the agent and the person.
const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');
const skills = require('./skills');

const STOP = new Set((
  'trigger when user users skill skills this that with from your their then into using use used also only each ' +
  'every more than such have will they them what which where other about after before over without within plus ' +
  'for the and are not any can all its has was were been being use'
).split(' '));
const MIN_SHARED = 3;
const MIN_SCORE = 0.12;

const words = (text) => new Set((text.toLowerCase().match(/[a-z][a-z0-9]{3,}/g) || []).filter((w) => !STOP.has(w)));
const whole = (name) => new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// The description of a SKILL.md: a one-line value or a ">" / "|" block.
function readDescription(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!front) return '';
  const lines = front[1].split(/\r?\n/);
  const i = lines.findIndex((l) => /^description:/.test(l));
  if (i < 0) return '';
  const first = lines[i].replace(/^description:\s*/, '').trim();
  if (!/^[>|][+-]?$/.test(first)) return first.replace(/^["']|["']$/g, '');
  const block = [];
  for (let j = i + 1; j < lines.length && /^\s/.test(lines[j]); j++) block.push(lines[j].trim());
  return block.join(' ');
}

function skillFile(p, { name, source }) {
  const dir = source === 'top' ? path.join(p.skills, name) : path.isAbsolute(source) ? source : path.join(p.skills, ...source.split('/'));
  return path.join(dir, 'SKILL.md');
}

// "A beats B/C" statements in the fragments: loser name -> [{ winner, preset }]. "sdd-x/y" means sdd-x and sdd-y.
function coverage(p) {
  const out = new Map();
  if (!fs.existsSync(p.fragments)) return out;
  for (const file of fs.readdirSync(p.fragments).filter((f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(p.fragments, file), 'utf8');
    for (const m of text.matchAll(/([\w-]+(?: and [\w-]+)*) beats? ([\w-]+(?:\/[\w-]+)*)/g)) {
      const [first, ...alts] = m[2].split('/');
      const stem = first.includes('-') ? first.slice(0, first.lastIndexOf('-') + 1) : '';
      const losers = [first, ...alts.map((a) => (a.includes('-') ? a : stem + a))];
      for (const loser of losers) {
        if (!out.has(loser)) out.set(loser, []);
        out.get(loser).push({ winner: m[1].replace(/ and /g, ' + '), preset: file.slice(0, -3) });
      }
    }
  }
  return out;
}

function mentions(p, name) {
  const found = [];
  if (!fs.existsSync(p.fragments)) return found;
  for (const file of fs.readdirSync(p.fragments).filter((f) => f.endsWith('.md'))) {
    for (const line of fs.readFileSync(path.join(p.fragments, file), 'utf8').split(/\r?\n/)) {
      if (whole(name).test(line)) found.push({ preset: file.slice(0, -3), line: line.trim() });
    }
  }
  return found;
}

function evidence(p, presets, covered, entry, desc, managed) {
  const lines = [];
  const { name, source } = entry;
  if (source !== 'top' && !path.isAbsolute(source)) {
    const group = `${source.split('/')[0]}/`;
    const hits = Object.values(presets)
      .map((x) => [x.name, x.skills.filter((s) => s.source.startsWith(group)).length])
      .filter(([, n]) => n);
    if (hits.length) lines.push(`same folder "${group}" as: ${hits.map(([n, c]) => `${n} (${c} skills)`).join(', ')}`);
  }
  const start = name.includes('-') ? name.split('-')[0] : '';
  if (start.length >= 3) {
    const hits = managed.filter((m) => m.name !== name && m.name.startsWith(`${start}-`));
    const byPreset = [...new Set(hits.map((m) => m.preset))].map(
      (preset) => `${preset} (${hits.filter((m) => m.preset === preset).slice(0, 3).map((m) => m.name).join(', ')})`,
    );
    if (byPreset.length) lines.push(`same name start "${start}-" as: ${byPreset.join(', ')}`);
  }
  const mine = words(desc);
  const similar = managed
    .map((m) => {
      const theirs = words(readDescription(skillFile(p, m)));
      const shared = [...mine].filter((w) => theirs.has(w));
      const score = shared.length / (mine.size + theirs.size - shared.length || 1);
      return { m, shared, score };
    })
    .filter((x) => x.shared.length >= MIN_SHARED && x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  for (const { m, shared, score } of similar) {
    lines.push(`similar to: ${m.name} (${m.preset}) ${score.toFixed(2)}, shared: ${shared.slice(0, 5).join(', ')}`);
  }
  for (const c of covered.get(name) || []) lines.push(`covered by: ${c.winner} (statement in ${c.preset} text)`);
  for (const x of mentions(p, name)) lines.push(`mentioned in: ${x.preset}: "${clip(x.line, 160)}"`);
  return lines;
}

function run(p, only) {
  const presets = store.loadPresets(p);
  const { names } = skills.unassigned(p, presets);
  if (!names.length) return 'No unassigned skills.';
  for (const n of only) {
    if (!names.includes(n)) throw new store.UserError(`"${n}" is not an unassigned skill`);
  }
  const { installed } = skills.scan(p);
  const managed = [];
  const seen = new Set();
  for (const preset of Object.values(presets)) {
    for (const s of preset.skills) {
      if (!seen.has(s.name)) managed.push({ ...s, preset: preset.name });
      seen.add(s.name);
    }
  }
  const covered = coverage(p);
  const blocks = (only.length ? only : names).map((name) => {
    const entry = { name, source: skills.sourceOf(installed, name) };
    const desc = readDescription(skillFile(p, entry));
    const ev = evidence(p, presets, covered, entry, desc, managed);
    return [
      name,
      `  source: ${entry.source}`,
      `  description: ${desc ? clip(desc, 110) : '(none)'}`,
      ...(ev.length ? ev.map((l) => `  ${l}`) : ['  no evidence found']),
    ].join('\n');
  });
  return [`Evidence for ${blocks.length} unassigned skill(s). It is evidence only: the verdict is for you and the person to give.`, '', ...blocks.map((b) => `${b}\n`)].join('\n');
}

module.exports = { run };
