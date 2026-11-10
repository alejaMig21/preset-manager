// Hooks that belong to presets: plan, apply, inventory, and editing the hooks of a definition.
// A managed hook is found in settings.json by event, matcher and command, and carries an owner tag.
const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');

const { UserError } = store;
const tagOf = (preset, id) => `[preset ${preset}: ${id}]`;
const TAG = /^\[preset ([\w.-]+): ([\w.-]+)\]$/;
const KNOWN_EVENTS = new Set([
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'UserPromptSubmit', 'Notification', 'Stop',
  'SubagentStop', 'SessionStart', 'SessionEnd', 'PreCompact', 'PermissionRequest',
]);
const sameMatcher = (a, b) => (a ?? '') === (b ?? '');
const matches = (e, d) => e.event === d.event && sameMatcher(e.matcher, d.matcher) && e.command === d.command;
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

// hook+ (add), hook~ (an identical hook without a statusMessage gets its owner tag),
// hook- (remove a tagged hook nobody asks for, or whose definition is gone). Only tagged hooks are ever removed.
function actions(presets, activeNames, settings) {
  const list = entries(settings);
  const defs = managed(presets);
  const wanted = new Set(['default', ...activeNames]);
  const out = [];
  for (const d of defs) {
    const tag = tagOf(d.preset, d.id);
    const same = list.filter((e) => matches(e, d));
    const tagged = same.some((e) => e.statusMessage === tag);
    if (wanted.has(d.preset)) {
      if (!same.length) out.push({ kind: 'hook+', name: d.id, def: d });
      else if (!tagged && same.some((e) => !e.statusMessage)) out.push({ kind: 'hook~', name: d.id, def: d });
    } else if (tagged) {
      out.push({ kind: 'hook-', name: d.id, def: d });
    }
  }
  for (const e of list) {
    const m = TAG.exec(e.statusMessage || '');
    if (m && !defs.some((d) => d.preset === m[1] && d.id === m[2] && matches(e, d))) {
      out.push({ kind: 'hook-', name: m[2], def: { preset: m[1], id: m[2], event: e.event, matcher: e.matcher, command: e.command } });
    }
  }
  return out;
}

// The new `hooks` object of settings.json after the actions. Removal touches only the one tagged hook,
// then the group it leaves empty, then the event only if that emptied it.
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
      const hk = sameMatcher(g.matcher, d.matcher)
        && (g.hooks || []).find((x) => x.command === d.command && (kind === 'hook~' ? !x.statusMessage : x.statusMessage === tag));
      if (!hk) continue;
      if (kind === 'hook~') {
        hk.statusMessage = tag;
      } else {
        g.hooks = g.hooks.filter((x) => x !== hk);
        if (!g.hooks.length) hooks[d.event] = hooks[d.event].filter((x) => x !== g);
        if (!hooks[d.event].length) delete hooks[d.event];
      }
      break;
    }
  }
  return hooks;
}

const unmanagedCount = (presets, settings) => {
  const defs = managed(presets);
  return entries(settings).filter((e) => !defs.some((d) => matches(e, d))).length;
};

function inventory(presets, settings) {
  const defs = managed(presets);
  const list = entries(settings);
  const lines = list.map((e) => {
    const d = defs.find((x) => matches(e, x));
    const stale = TAG.test(e.statusMessage || '');
    const owner = d
      ? `preset ${d.preset}: ${d.id}${e.statusMessage === tagOf(d.preset, d.id) ? '' : ' (untagged)'}`
      : stale ? `${e.statusMessage} (its definition is gone: the next apply removes it)` : 'unmanaged';
    return [`${e.n}. ${e.event.padEnd(16)} ${(e.matcher || '(no matcher)').padEnd(18)} ${owner}`, `   ${clip(e.command || '', 100)}`, d && d.note ? `   ${d.note}` : '']
      .filter(Boolean).join('\n');
  });
  const missing = defs.filter((d) => !list.some((e) => matches(e, d)));
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

// Definitions are committed to a public repository, so say what would be published.
function warnings(def) {
  const out = [];
  if (/[A-Za-z]:[\\/]|\/(?:home|Users)\//.test(def.command)) out.push('the command contains a local path, and the definition goes to a public repository if you commit it');
  if (/token|secret|passw(or)?d|api[_-]?key/i.test(def.command)) out.push('the command looks like it may contain a secret: do not publish it');
  if (!KNOWN_EVENTS.has(def.event)) out.push(`"${def.event}" is not a known hook event name: check the spelling or the hook never fires`);
  return out.map((w) => `warning: ${w}`);
}

function addHook(p, v, def, yes) {
  const { presets, preset } = target(p, v);
  const problem = store.checkHook(def);
  if (problem) throw new UserError(problem);
  const owner = Object.values(presets).find((x) => x.hooks.some((hk) => hk.id === def.id));
  if (owner) throw new UserError(`hook id "${def.id}" already exists in preset "${owner.name}"`);
  const warn = warnings(def);
  if (!yes) {
    return [`Would add hook "${def.id}" (${def.event}${def.matcher ? ` ${def.matcher}` : ''}) to preset "${preset.name}". Full command:`, `  ${def.command}`, ...warn, 'Re-run with --yes to write it.'].join('\n');
  }
  writeHooks(p, preset, [...preset.hooks, def]);
  return [`Added hook "${def.id}" to preset "${preset.name}". Apply the preset to install it.`, ...warn].join('\n');
}

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined && x !== ''));

function define(p, v) {
  return addHook(p, v, clean({ id: v.id, event: v.event, matcher: v.matcher, command: v.command, note: v.note }), v.yes);
}

function adopt(p, args, v) {
  const n = Number(args[0]);
  const { presets } = target(p, v);
  const e = entries(store.loadSettings(p))[n - 1];
  if (!Number.isInteger(n) || !e) throw new UserError(`no hook number "${args[0] || ''}" (see "preset hooks")`);
  const d = managed(presets).find((x) => matches(e, x));
  if (d) throw new UserError(`hook ${n} is already managed by preset "${d.preset}" as "${d.id}"`);
  return addHook(p, v, clean({ id: v.id, event: e.event, matcher: e.matcher, command: e.command, note: v.note }), v.yes);
}

function drop(p, v) {
  const { preset } = target(p, v);
  if (!preset.hooks.some((hk) => hk.id === v.id)) throw new UserError(`preset "${preset.name}" has no hook "${v.id || ''}"`);
  if (!v.yes) return `Would drop hook "${v.id}" from preset "${preset.name}". The next apply removes it from settings.json.\nRe-run with --yes to write it.`;
  writeHooks(p, preset, preset.hooks.filter((hk) => hk.id !== v.id));
  return `Dropped hook "${v.id}" from preset "${preset.name}". The next apply removes it from settings.json.`;
}

module.exports = { actions, apply, inventory, unmanagedCount, define, adopt, drop };
