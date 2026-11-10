# 08: Hook that nudges after `skills add`

**What to build:** First verify, on a fake or sandboxed install, in which folder `skills add -g` places a new skill, because the hook's detection depends on it. Then provide a command that installs a PostToolUse hook: when the agent runs a Bash `skills add`, the hook calls `unassigned` and injects a message asking the agent to propose a preset for the new unassigned skills. The hook only nudges: it never writes presets and never decides. The install command is a dry run by default and writes the hook into `settings.json` only after the person approves the exact change, with the same backup and validation as every write.

**Blocked by:** 06

**Status:** resolved

- [x] The install folder of `skills add -g` is documented in the ticket's result (see Result below)
- [x] The install command shows the exact `settings.json` change and writes nothing without confirmation
- [x] After confirmation the hook is present and `settings.json` is still valid JSON
- [x] Simulating a `skills add` run with unassigned skills produces the nudge message
- [x] Simulating it with none produces no message
- [x] The hook never writes any preset or skill file

## Result: where `skills add -g` installs

Read-only research, nothing was installed. The skills CLI documents `~/.claude/skills/` as the global path for Claude Code (`~/.agents/skills/` is for other agents such as Codex). On this machine the only skill the CLI installed for Claude Code, `find-skills`, is a link in `~/.claude/skills/` pointing at a canonical copy in `~/.agents/skills/`. Either way a newly installed skill shows up as an entry directly under `~/.claude/skills/`, which is exactly what the unassigned-skills scan reads. The hook therefore triggers on the Bash command text and then scans; it does not depend on the install folder. If the CLI ever installed only into `~/.agents/skills/`, Claude Code would not see the skill and there would be nothing to assign.
