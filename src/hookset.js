// Hooks that belong to presets: plan, apply, inventory, and editing the hooks of a definition.
// A managed hook is found in settings.json by event, matcher and command, and carries an owner tag.
const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');

const { UserError } = store;
const tagOf = (preset, id) => `[preset ${preset}: ${id}]`;
const sameMatcher = (a, b) => (a ?? '') === (b ?? '');
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Every hook of settings.json, numbered in file order.
function entries(settings) {
  const out = [];
  for (const [event, groups] of Object.entries(settings.hooks || {})) {
    for (const g of groups) {
      for (const hk of g.hooks || []) out.push({ event, matcher: g.matcher, command: hk.command, statusMessage: hk.statusMessage });
    }
  }
  return out.map((e, i) => ({ ...e, n: i + 1 }));
}

const managed = (presets) => Object.values(presets).flatMap((x) => x.hooks.map((hk) => ({ ...hk, preset: x.name })));
const find = (list, d) => list.find((e) => e.event === d.event && sameMatcher(e.matcher, d.matcher) && e.command === d.command);

// hook+ (add), hook~ (an identical hook gets its owner tag), hook- (remove a tagged hook nobody asks for).
function actions(presets, activeNames, settings) {
  const list = entries(settings);
  const wanted = new Set(['default', ...activeNames]);
  const out = [];
  for (const d of managed(presets)) {
    const present = find(list, d);
    const tagged = present && present.statusMessage === tagOf(d.preset, d.id);
    if (wanted.has(d.preset)) {
      if (!present) out.push({ kind: 'hook+', name: d.id, def: d });
      else if (!tagged) out.push({ kind: 'hook~', name: d.id, def: d });
    } else if (tagged) {
      out.push({ kind: 'hook-', name: d.id, def: d }); // only a hook that carries our tag is ever removed
    }
  }
  return out;
}

// The new `hooks` object of settings.json after the actions.
function apply(settings, acts) {
  const hooks = structuredClone(settings.hooks || {});
  for (const { kind, def: d } of acts) {
    const tag = tagOf(d.preset, d.id);
    if (kind === 'hook+') {
      (hooks[d.event] ||= []).push({
        ...(d.matcher !== undefined ? { matcher: d.matcher } : {}),
        hooks: [{ type: 'command', command: d.command, statusMessage: tag }],
      });
      continue;
    }
    for (const g of hooks[d.event] || []) {
      const hk = sameMatcher(g.matcher, d.matcher) && (g.hooks || []).find((x) => x.command === d.command);
      if (!hk) continue;
      if (kind === 'hook~') hk.statusMessage = tag;
      else g.hooks = g.hooks.filter((x) => x !== hk);
      break;
    }
    if (kind === 'hook-') {
      hooks[d.event] = (hooks[d.event] || []).filter((g) => (g.hooks || []).length);
      if (!hooks[d.event].length) delete hooks[d.event];
    }
  }
  return hooks;
}

const unmanagedCount = (presets, settings) => {
  const defs = managed(presets);
  return entries(settings).filter((e) => !find(defs, e)).length;
};

function inventory(presets, settings) {
  const defs = managed(presets);
  const list = entries(settings);
  const lines = list.map((e) => {
    const d = defs.find((x) => x.event === e.event && sameMatcher(x.matcher, e.matcher) && x.command === e.command);
    const owner = d ? `preset ${d.preset}: ${d.id}${e.statusMessage === tagOf(d.preset, d.id) ? '' : ' (untagged)'}` : 'unmanaged';
    return [`${e.n}. ${e.event.padEnd(16)} ${(e.matcher ?? '(no matcher)').padEnd(18)} ${owner}`, `   ${clip(e.command || '', 100)}`, d && d.note ? `   ${d.note}` : '']
      .filter(Boolean).join('\n');
  });
  const missing = defs.filter((d) => !find(list, d));
  return [
    lines.join('\n') || '(no hooks in settings.json)',
    missing.length ? `\nDefined but not installed: ${missing.map((d) => `${d.id} (${d.preset})`).join(', ')}` : '',
    `\nUnmanaged hooks: ${unmanagedCount(presets, settings)}. They are never touched; adopt one with "preset hook adopt <number> --in <preset> --id <id>".`,
  ].join('\n');
}

// ---- editing the hooks of a preset definition (repo files only; settings.json is never written here) ----

function writeHooks(p, preset, hooks) {
  fs.writeFileSync(path.join(p.presets, `${preset.name}.json`), store.definitionText(preset.name, preset.description, preset.skills, preset.plugins, hooks));
}

function target(p, v) {
  const presets = store.loadPresets(p);
  if (!v.in || !presets[v.in]) throw new UserError(`preset "${v.in || ''}" not found (pass --in <preset>)`);
  return { presets, preset: presets[v.in] };
}

function addHook(p, v, def, yes) {
  const { presets, preset } = target(p, v);
  const problem = store.checkHook(def);
  if (problem) throw new UserError(problem);
  const owner = Object.values(presets).find((x) => x.hooks.some((hk) => hk.id === def.id));
  if (owner) throw new UserError(`hook id "${def.id}" already exists in preset "${owner.name}"`);
  if (!yes) return `Would add hook "${def.id}" (${def.event}${def.matcher ? ` ${def.matcher}` : ''}) to preset "${preset.name}":\n  ${clip(def.command, 120)}\nRe-run with --yes to write it.`;
  writeHooks(p, preset, [...preset.hooks, def]);
  return `Added hook "${def.id}" to preset "${preset.name}". Apply the preset to install it.`;
}

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined && x !== ''));

function define(p, v) {
  return addHook(p, v, clean({ id: v.id, event: v.event, matcher: v.matcher, command: v.command, note: v.note }), v.yes);
}

function adopt(p, args, v) {
  const n = Number(args[0]);
  const { presets } = target(p, v);
  const list = entries(store.loadSettings(p));
  const e = list[n - 1];
  if (!Number.isInteger(n) || !e) throw new UserError(`no hook number "${args[0] || ''}" (see "preset hooks")`);
  const d = find(managed(presets), e);
  if (d) throw new UserError(`hook ${n} is already managed by preset "${d.preset}" as "${d.id}"`);
  return addHook(p, v, clean({ id: v.id, event: e.event, matcher: e.matcher, command: e.command, note: v.note }), v.yes);
}

function drop(p, v) {
  const { preset } = target(p, v);
  if (!preset.hooks.some((hk) => hk.id === v.id)) throw new UserError(`preset "${preset.name}" has no hook "${v.id || ''}"`);
  if (!v.yes) return `Would drop hook "${v.id}" from preset "${preset.name}". It stays in settings.json until the next apply removes it.\nRe-run with --yes to write it.`;
  writeHooks(p, preset, preset.hooks.filter((hk) => hk.id !== v.id));
  return `Dropped hook "${v.id}" from preset "${preset.name}".`;
}

module.exports = { actions, apply, inventory, unmanagedCount, define, adopt, drop };
