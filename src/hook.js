// A PostToolUse hook that nudges the agent to give new skills a preset. It only nudges.
const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');
const skills = require('./skills');
const apply = require('./apply');

const BIN = path.resolve(__dirname, '..', 'bin', 'preset.js');
const COMMAND = `"${process.execPath}" "${BIN}" hook nudge`;
const ENTRY = { matcher: 'Bash', hooks: [{ type: 'command', command: COMMAND }] };

const isOurs = (entry) =>
  (entry.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes('preset.js') && h.command.endsWith(' hook nudge'));

function install(p, yes) {
  const settings = store.loadSettings(p);
  const current = (settings.hooks && settings.hooks.PostToolUse) || [];
  if (current.some(isOurs)) return 'Hook already installed. Nothing to do.';
  if (!yes) {
    return `Would add this entry to hooks.PostToolUse in ${p.settings}:\n${JSON.stringify(ENTRY, null, 2)}\nRe-run with --yes to write it.`;
  }
  apply.writeSettings(p, { ...settings, hooks: { ...settings.hooks, PostToolUse: [...current, ENTRY] } });
  return `Hook installed in ${p.settings}. It only nudges the agent and never writes presets. Undo it with "preset rollback --yes".`;
}

// Reads the hook input (JSON on stdin). Prints a nudge only after a Bash "skills add" left unassigned skills.
// Any problem means silence: a hook must never break the session.
function nudge(p) {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    const command = input && input.tool_input && input.tool_input.command;
    if (typeof command !== 'string' || !/\bskills\s+add\b/.test(command)) return '';
    const { names } = skills.unassigned(p, store.loadPresets(p));
    if (!names.length) return '';
    const additionalContext =
      `These installed skills belong to no preset: ${names.join(', ')}. ` +
      'Propose which preset each should go in (preset names with their skills) and wait for the user\'s approval ' +
      'before running any preset command that writes.';
    return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext } });
  } catch {
    return '';
  }
}

function run(p, sub, yes) {
  if (sub === 'install') return install(p, yes);
  if (sub === 'nudge') return nudge(p);
  throw new store.UserError('usage: preset hook install|nudge');
}

module.exports = { run };
