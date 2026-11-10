# Preset definitions live in this repo and are applied onto ~/.claude

Preset JSON and fragments are versioned here; the tool applies them onto `~/.claude`. Skill folders stay under `~/.claude/skills`, and a skill whose source lives elsewhere is linked in place with a junction instead of copied. Chosen over keeping presets in `~/.claude/presets`, which has no history, at the cost of two places to keep in sync: this repo wins on every apply.

## Consequences

If a source folder outside `~/.claude` is moved or deleted its junction breaks; the tool reports broken junctions instead of hiding them.
