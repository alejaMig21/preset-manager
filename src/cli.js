const { parseArgs } = require('node:util');
const store = require('./store');
const plan = require('./plan');
const apply = require('./apply');
const skills = require('./skills');
const crud = require('./crud');
const hook = require('./hook');
const hookset = require('./hookset');
const convert = require('./convert');
const suggest = require('./suggest');
const { change, reconcile } = require('./reconcile');

const OPTIONS = {
  root: { type: 'string' },
  presets: { type: 'string' },
  from: { type: 'string' },
  yes: { type: 'boolean' },
  details: { type: 'boolean' },
  in: { type: 'string' },
  id: { type: 'string' },
  event: { type: 'string' },
  matcher: { type: 'string' },
  command: { type: 'string' },
  note: { type: 'string' },
  skills: { type: 'string' },
  add: { type: 'string' },
  remove: { type: 'string' },
  description: { type: 'string' },
  plugins: { type: 'string' },
  'add-plugins': { type: 'string' },
  'remove-plugins': { type: 'string' },
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
      `Plugins without preset: ${plan.unmanagedPlugins(p, presets, store.loadSettings(p)).join(', ') || '(none)'}`,
      `Unmanaged hooks: ${hookset.unmanagedCount(presets, store.loadSettings(p))}`,
    ].join('\n');
  },

  list: (p, args, v) => crud.show(p, v.details),

  unassigned(p) {
    const { names } = skills.unassigned(p, store.loadPresets(p));
    return names.length ? `Unassigned skills (no preset names them):\n${names.map((n) => `  ${n}`).join('\n')}` : 'No unassigned skills.';
  },

  suggest: (p, args) => suggest.run(p, args),

  add: (p, args, v) => change(p, 'add', args[0], v.yes),
  remove: (p, args, v) => change(p, 'remove', args[0], v.yes),

  apply(p, args, v) {
    const presets = store.loadPresets(p);
    const active = store.loadActive(p);
    return reconcile(p, presets, active, active.map((a) => a.name), 'apply the active presets', v.yes);
  },

  rollback: (p, args, v) => apply.rollback(p, v.yes),

  hook: (p, args, v) => hook.run(p, args, v),
  hooks: (p) => hookset.inventory(store.loadPresets(p), store.loadSettings(p)),

  convert: (p, args, v) => convert.convert(p, v.yes),

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
