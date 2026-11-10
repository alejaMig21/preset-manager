const { parseArgs } = require('node:util');
const store = require('./store');
const plan = require('./plan');
const apply = require('./apply');
const skills = require('./skills');
const crud = require('./crud');
const hook = require('./hook');
const { change, reconcile } = require('./reconcile');

const OPTIONS = {
  root: { type: 'string' },
  presets: { type: 'string' },
  yes: { type: 'boolean' },
  skills: { type: 'string' },
  add: { type: 'string' },
  remove: { type: 'string' },
  description: { type: 'string' },
};

const COMMANDS = {
  status(p) {
    const presets = store.loadPresets(p);
    const active = store.loadActive(p);
    const { names, broken } = skills.unassigned(p, presets);
    return [
      `Active presets: ${active.length ? active.map((a) => `${a.name} (since ${a.since})`).join(', ') : '(none)'}`,
      `Known presets: ${Object.keys(presets).join(', ')}`,
      `Unassigned skills: ${names.join(', ') || '(none)'}`,
      `Broken junctions: ${broken.map((b) => `${b.name} -> ${b.target}`).join(', ') || '(none)'}`,
    ].join('\n');
  },

  list: (p) => crud.show(p),

  orphans(p) {
    const { names } = skills.unassigned(p, store.loadPresets(p));
    return names.length ? `Unassigned skills (no preset names them):\n${names.map((n) => `  ${n}`).join('\n')}` : 'No unassigned skills.';
  },

  add: (p, args, v) => change(p, 'add', args[0], v.yes),
  remove: (p, args, v) => change(p, 'remove', args[0], v.yes),

  apply(p, args, v) {
    const presets = store.loadPresets(p);
    const active = store.loadActive(p);
    return reconcile(p, presets, active, active.map((a) => a.name), 'apply the active presets', v.yes);
  },

  rollback: (p, args, v) => apply.rollback(p, v.yes),

  hook: (p, args, v) => hook.run(p, args[0], v.yes),

  create: (p, args, v) => crud.create(p, args, v),
  update: (p, args, v) => crud.update(p, args, v),
  delete: (p, args, v) => crud.remove(p, args, v),
};

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
