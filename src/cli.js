const { parseArgs } = require('node:util');
const store = require('./store');
const plan = require('./plan');
const apply = require('./apply');

const OPTIONS = {
  root: { type: 'string' },
  presets: { type: 'string' },
  yes: { type: 'boolean' },
};

const today = () => new Date().toISOString().slice(0, 10);

const COMMANDS = {
  status(p) {
    const presets = store.loadPresets(p);
    const active = store.loadActive(p);
    const names = Object.keys(presets);
    return [
      `Active presets: ${active.length ? active.map((a) => `${a.name} (since ${a.since})`).join(', ') : '(none)'}`,
      `Known presets: ${names.join(', ')}`,
    ].join('\n');
  },

  add: (p, args, v) => change(p, 'add', args[0], v.yes),
  remove: (p, args, v) => change(p, 'remove', args[0], v.yes),

  apply(p, args, v) {
    const presets = store.loadPresets(p);
    const active = store.loadActive(p);
    return reconcile(p, presets, active, active.map((a) => a.name), 'apply the active presets', v.yes);
  },

  rollback: (p, args, v) => apply.rollback(p, v.yes),
};

// add/remove: compute the new active list, then reconcile the config root with it.
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
  const actions = [...plan.skillActions(p, presets, next, settings), ...plan.blockActions(p, presets, next)];
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
  const restart = actions.some((a) => a.kind.startsWith('block') || a.kind === 'text');
  return `Done: ${label}.\n${body}\n${apply.restartNotice(restart)}`;
}

function main(argv) {
  try {
    const parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
    const [command, ...args] = parsed.positionals;
    if (!COMMANDS[command]) {
      throw new store.UserError(`unknown command "${command || ''}". Commands: ${Object.keys(COMMANDS).join(', ')}`);
    }
    const out = COMMANDS[command](store.paths(parsed.values), args, parsed.values);
    if (out) console.log(out);
  } catch (e) {
    if (e instanceof store.UserError || e.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
      console.error(`error: ${e.message}`);
      process.exitCode = 1;
      return;
    }
    throw e;
  }
}

module.exports = { main };
