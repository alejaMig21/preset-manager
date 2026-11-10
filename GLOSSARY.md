# Glossary

Seed terms from the 2026-11-09 session; the grill refines them.

- **Preset**: a named set of skills turned on, plugins turned on or off, and a text fragment appended to the global `CLAUDE.md`. Stored as `~/.claude/presets/<name>.json`.
- **Active preset**: today exactly one, named in `~/.claude/presets/active.json`. Target: a list of several.
- **Additive preset**: a preset that lists only what it adds and is meant to stack with others. Marked `"additive": true` (only `matt-pocock-custom` so far).
- **Default**: the person's name for what every preset includes today (the base). Currently repeated inside each preset JSON and partly represented by `core.json`.
- **Base**: the skills `find-skills`, `preset-manager`, `skill-creator`, `dev-journal` and the plugins `engram`, `ponytail`, `caveman`, `pyright-lsp` that every preset carries today.
- **Skill group**: a folder `~/.claude/skills/<group>/` holding skills that Claude Code does not see until a junction exposes them (`engineering`, `productivity`, `design`, `matt-pocock-custom`).
- **Junction**: a Windows folder link created with `mklink /J`; `~/.claude/skills/<name>` pointing at `skills/<group>/<folder>` turns that skill on.
- **skills_off**: the list of skill names written to `settings.json` `skillOverrides` as `off`. Today stored in each preset; target: computed.
- **Fragment**: a Markdown file `~/.claude/presets/fragments/<name>.md` with a preset's workflow text, imported into the global `CLAUDE.md` inside a `<!-- preset:NAME -->` block.
- **Universe**: the set of skills the tool knows about, from which `skills_off` is computed. Its exact definition is an open grill question.
- **Snapshot**: the read-only copy of the live setup kept in `snapshot/2026-11-09/`.
