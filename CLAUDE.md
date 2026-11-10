## Start here

This repo will become the home of `preset-manager`: stacking N presets of Claude Code skills, plugins and text. Nothing is built yet.

- If the person says "do the grill" (or "haz el grill", or anything close): read `docs/grill-brief.md` and `GLOSSARY.md`, then run the `grilling` skill on the agenda in the brief. Do not ask for context: the brief holds it. Follow its "Question style" and "Order override": start from the person's goal (several presets on at once), never from implementation, and define every term under each question.
- `snapshot/2026-11-09/` is a read-only copy of the live setup (`~/.claude/skills/preset-manager/SKILL.md`, `~/.claude/presets/`). The live files in `~/.claude` stay the source of truth until this project replaces them.
- Never write inside `~/.claude` from this repo's sessions unless the person approves the exact files first.

## Agent skills

### Issue tracker

Issues and specs are local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
