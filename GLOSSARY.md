# Preset manager

Stacks several named presets of Claude Code skills and text on one machine, so a person turns whole working styles on and off by name. Refined by the 2026-11-09 grill.

## Language

**Preset**:
A named set of skills and plugins that are turned on plus one optional text fragment. Several presets can be active at once.
_Avoid_: Profile, mode, bundle

**Active preset**:
A preset currently switched on. The machine keeps an ordered list of them, global to all projects.
_Avoid_: Current preset, selected preset

**Stacking**:
Having several active presets at once; what each one turns on is simply joined.
_Avoid_: Merging, layering

**Default**:
The preset that is always on and holds only the base skills.
_Avoid_: Core, base preset

**Base**:
The skills `find-skills`, `preset-manager`, `skill-creator` and `dev-journal`; the content of `default`.

**Managed skill**:
A skill named in at least one preset. Only managed skills are switched on or off by the tool; every other skill is left alone.
_Avoid_: Known skill, universe

**Managed plugin**:
A plugin named in at least one preset. Only managed plugins are switched on or off by the tool; every other plugin, such as `claude-hud`, is left alone.

**Unassigned skill**:
An installed skill that no preset names.
_Avoid_: Orphan, loose skill

**Skill group**:
A folder of skills that Claude Code does not see until a link exposes one of them (`engineering`, `productivity`, `design`).

**Junction**:
A Windows folder link that makes a skill visible by pointing `~/.claude/skills/<name>` at its folder, inside or outside `~/.claude`.
_Avoid_: Symlink, shortcut

**Skill source**:
The folder a skill really lives in, which a junction points at. A source outside `~/.claude`, such as `tickets-tree`, is used in place, never copied.

**Fragment**:
A Markdown file with the workflow rules of one preset, joined into the global `CLAUDE.md`.
_Avoid_: Preset text, snippet

**Preset block**:
The marked section of the global `CLAUDE.md` that holds one active preset's fragment; each active preset has its own.

**Preset definition**:
The files that describe a preset (its skill list and fragment). They live in this repo and are applied onto `~/.claude`.

**Apply**:
Making the active presets real in `~/.claude`: junctions, skill switches and preset blocks.

**Restart notice**:
The single line printed after an apply saying whether the session must be restarted (only when a preset block changed).

**Proposal**:
A list of presets, each with its skills, that the agent shows and the person approves before anything is written.

**Snapshot**:
The read-only copy of the live setup kept in `snapshot/2026-11-09/`.

**Retired preset**:
A preset removed because stacking replaces it: `engineering_productivity` and `core`.
