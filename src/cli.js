const { parseArgs } = require('node:util');
const store = require('./store');
const plan = require('./plan');

const OPTIONS = {
  root: { type: 'string' },
  presets: { type: 'string' },
  yes: { type: 'boolean' },
};

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

  add: (p, args) => change(p, 'add', args[0]),
  remove: (p, args) => change(p, 'remove', args[0]),
};

// add/remove: compute the new active list, then the skill actions that reach it.
function change(p, kind, name) {
  if (!name) throw new store.UserError(`usage: preset ${kind} <preset>`);
  const presets = store.loadPresets(p);
  if (!presets[name]) throw new store.UserError(`preset "${name}" not found`);
  if (name === 'default') throw new store.UserError('"default" is always on and cannot be added or removed');
  const active = store.loadActive(p);
  const isActive = active.some((a) => a.name === name);
  if (kind === 'add' && isActive) return `Preset "${name}" is already active. Nothing to do.`;
  if (kind === 'remove' && !isActive) return `Preset "${name}" is not active. Nothing to do.`;
  const next = kind === 'add' ? [...active.map((a) => a.name), name] : active.map((a) => a.name).filter((n) => n !== name);
  const actions = plan.skillActions(p, presets, next, store.loadSettings(p));
  return [
    `Plan to ${kind} "${name}" (dry run, nothing written):`,
    actions.length ? plan.format(actions) : '  (no skill changes)',
  ].join('\n');
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
    const [command, ...args] = parsed.positionals;
    if (!COMMANDS[command]) throw new store.UserError(`unknown command "${command || ''}". Commands: ${Object.keys(COMMANDS).join(', ')}`);
    const p = store.paths(parsed.values);
    const out = COMMANDS[command](p, args, parsed.values);
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
