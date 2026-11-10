## Start here

`preset-manager` is a Node CLI (`bin/preset.js`, zero dependencies) plus a thin skill (`skills/preset-manager/`). It stacks presets of Claude Code skills, plugins and text onto `~/.claude`. Read `GLOSSARY.md` for the terms and `docs/adr/` for the decisions before changing behaviour. The spec and the tickets are in `.scratch/preset-stacking/`.

## Working here

- Run the tests with `node --test`. They drive the real CLI against a fake `--root` folder and check only files, output and exit code (ADR 0004). Add new behaviour the same way, test first.
- Never write inside `~/.claude` from this repo's sessions unless the person approves the exact change. Every CLI command that writes is a dry run until `--yes`: show the plan, get the yes, then run it.
- Preset definitions live in `presets/` here and are applied onto `~/.claude`; the repo wins on every apply.
- The live skill `~/.claude/skills/preset-manager` is a junction to `skills/preset-manager/` here, and the hook in `~/.claude/settings.json` calls `bin/preset.js`. Keep this repo at its current path.
- `snapshot/2026-11-09/` is a read-only copy of the setup before this system replaced it. `docs/grill-brief.md` is the history of the design grill, superseded by the ADRs.

## Agent skills

### Issue tracker

Issues and specs are local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
