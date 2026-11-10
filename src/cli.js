const { parseArgs } = require('node:util');
const store = require('./store');

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
};

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
