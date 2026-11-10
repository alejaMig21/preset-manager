# Preset base fragment

The base text of every session is the user's global `~/.claude/CLAUDE.md`; this file adds nothing to it.
Preset fragments are appended to that file through one marker block per active preset:
`<!-- preset:NAME -->`, a line `@presets/fragments/NAME.md`, `<!-- /preset:NAME -->`, placed at the very end.
See `~/.claude/presets/README.md` ("Fragment mechanism") for the exact rules.
