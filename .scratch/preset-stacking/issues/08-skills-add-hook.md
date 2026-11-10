# 08: Hook that nudges after `skills add`

**What to build:** First verify, on a fake or sandboxed install, in which folder `skills add -g` places a new skill, because the hook's detection depends on it. Then provide a command that installs a PostToolUse hook: when the agent runs a Bash `skills add`, the hook calls `orphans` and injects a message asking the agent to propose a preset for the new unassigned skills. The hook only nudges: it never writes presets and never decides. The install command is a dry run by default and writes the hook into `settings.json` only after the person approves the exact change, with the same backup and validation as every write.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] The install folder of `skills add -g` is documented in the ticket's result
- [ ] The install command shows the exact `settings.json` change and writes nothing without confirmation
- [ ] After confirmation the hook is present and `settings.json` is still valid JSON
- [ ] Simulating a `skills add` run with unassigned skills produces the nudge message
- [ ] Simulating it with none produces no message
- [ ] The hook never writes any preset or skill file
