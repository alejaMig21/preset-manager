// add / remove / apply: compute the new active list, then bring the config root in line with it.
const store = require('./store');
const plan = require('./plan');
const hookset = require('./hookset');
const apply = require('./apply');

const today = () => new Date().toISOString().slice(0, 10);

function change(p, kind, name, yes) {
  if (!name) throw new store.UserError(`usage: preset ${kind} <preset>`);
  const presets = store.loadPresets(p);
  if (!presets[name]) throw new store.UserError(`preset "${name}" not found`);
  if (name === 'default') throw new store.UserError('"default" is always on and cannot be added or removed');
  const active = store.loadActive(p);
  const names = active.map((a) => a.name);
  const isActive = names.includes(name);
  if (kind === 'add' && isActive) return `Preset "${name}" is already active. Nothing to do.`;
  if (kind === 'remove' && !isActive) return `Preset "${name}" is not active. Nothing to do.`;
  const next = kind === 'add' ? [...names, name] : names.filter((n) => n !== name);
  return reconcile(p, presets, active, next, `${kind} "${name}"`, yes);
}

function reconcile(p, presets, active, next, label, yes) {
  const settings = store.loadSettings(p);
  const actions = [
    ...plan.skillActions(p, presets, next, settings),
    ...plan.pluginActions(p, presets, next, settings),
    ...plan.blockActions(p, presets, next),
    ...hookset.actions(presets, next, settings),
  ];
  const activeChanged = next.join() !== active.map((a) => a.name).join();
  if (!actions.length && !activeChanged) return 'Nothing to change.';
  const bytes = plan.fragmentBytes(p, presets, next);
  const body = [
    actions.length ? plan.format(actions) : '  (no changes besides the active list)',
    bytes ? `Stacked fragment text: ${bytes} bytes (about ${Math.ceil(bytes / 4)} tokens).` : '',
  ].filter(Boolean).join('\n');
  if (!yes) return `Plan to ${label} (dry run, nothing written):\n${body}\nRe-run with --yes to apply.`;
  const since = Object.fromEntries(active.map((a) => [a.name, a.since]));
  const nextEntries = next.map((name) => ({ name, since: since[name] || today() }));
  apply.applyChange(p, { actions, nextEntries, settings, desired: plan.desiredBlocks(presets, next) });
  const restart = actions.some((a) => /^(block|plugin)/.test(a.kind) || a.kind === 'text');
  return `Done: ${label}.\n${body}\n${apply.restartNotice(restart)}`;
}

module.exports = { change, reconcile };
