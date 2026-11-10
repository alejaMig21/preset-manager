# Grill brief: preset-manager with N stacked presets

Written 2026-11-09 by the assistant in another session (cwd `D:\Projects\AI\dev-tickets-tree`). The next session starts here with no other context. When the person says "do the grill" (or "haz el grill"), read this file, `GLOSSARY.md` and `snapshot/2026-11-09/`, then run the `grilling` skill on the agenda below. Replies to the person in Rioplatense Spanish; every file in this repo in English.

## Goal (the person's words, translated)

Expand the preset system so that **N presets can be active at the same time**. Today `engineering_productivity` exists only to get "engineering + productivity" at once; with stacking it is not needed. Target example: `default` + `engineering` + `productivity` + `matt-pocock-custom` all active together. Every preset today silently includes the base (the person was unsure of its name: `core`, `base`; they will call it **`default`** from now on).

## What exists today (verified 2026-11-09, files copied to `snapshot/2026-11-09/`)

`preset-manager` is **not a project**: it is one skill, `~/.claude/skills/preset-manager/SKILL.md` (runbook only, no code, no tests). `~/.claude` is not a git repo; the only history is `~/.claude/presets/backups/`.

How a switch works today (single active preset):

- `~/.claude/presets/<name>.json`: source of truth. Fields: `name`, `description`, `status` (`defined`|`applied`), `base`, `skills_on[{name, source}]` (`source` = `top` or `<group>/<folder>`), `skills_off[]`, `plugin_skills_base`, `plugin_skills_extra`, `plugins_on[]`, `plugins_off[]`, `fragments[]`, `notes`, optional `applied_record`.
- `~/.claude/presets/active.json`: `{"active": "<one name>", "since": "<date>"}`. Today: `engineering_productivity`.
- Skills: grouped skills live in `~/.claude/skills/<group>/<folder>`; Claude Code only sees `~/.claude/skills/<name>`, so a **junction** (`cmd /c mklink /J`) `skills/<name>` -> `skills/<group>/<folder>` turns a skill on. Junctions are removed only with `cmd /c rmdir <link>`, never `rm -r`. One junction (`find-skills`) points outside `.claude`, to `C:\Users\aleja\.agents\skills\find-skills`.
- `skills_off` (a name list stored in every preset, 27 to 54 names) is copied into `~/.claude/settings.json` `skillOverrides` as `"<name>": "off"`. It is "the universe of top-level skills minus `skills_on` minus base". `skillOverrides` does not affect plugin-provided skills.
- Plugins: `plugins_on`/`plugins_off` are copied into `settings.json` `enabledPlugins`. `claude-hud` is off in every preset; `frontend-design` is on only in `design_ui` and `design_system`.
- Text: the global `~/.claude/CLAUDE.md` gets ONE marker block at its very end: `<!-- preset:NAME -->`, a line `@presets/fragments/NAME.md`, `<!-- /preset:NAME -->`. Imports are relative to the global file. `CLAUDE.md` and plugin changes need a session restart; skill changes apply live.
- Base repeated inside every preset JSON: skills `find-skills`, `preset-manager`, `skill-creator`, `dev-journal`; plugins on `engram`, `ponytail`, `caveman`, `pyright-lsp`; fragment `fragments/base.md` (documents the mechanism, never imported).
- Backups: before a switch the runbook copies `settings.json` and `CLAUDE.md` to `presets/backups/<name>.<timestamp>` and keeps the last 5.
- Presets defined (20 JSON files): `core` (base + `mockup-to-prototype`), `engineering` (24 skills), `productivity` (11), `engineering_productivity` (31, applied), `gamedev`, 14 `design_*` presets (subgroups of `skills/design`, which holds about 200 skill folders), and the new `matt-pocock-custom`.
- `skills/synced/` and `skills/_shared/` are not skills; `synced/` holds cloud-synced skills (unverified how they relate to presets).

`matt-pocock-custom` (created 2026-11-09, not applied): `presets/matt-pocock-custom.json` with the new field `"additive": true`, listing only `tickets-tree` (`source: matt-pocock-custom/tickets-tree`), plus the folder `~/.claude/skills/matt-pocock-custom/tickets-tree/SKILL.md`, a copy of `D:\Projects\AI\dev-tickets-tree\skills\tickets-tree\SKILL.md`. No junction exists. Applying it with the current runbook would turn every other skill off (the runbook computes `skills_off` from the single active preset).

## Grill agenda (frontier: questions to settle before any spec; recommended answer first)

Ask one at a time, each followed by a Glosario for the person (see `CLAUDE.md`).

1. **What is this repo?** Recommended: a Node tool (`preset` CLI, zero dependencies, `node --test`) plus a thin `preset-manager` skill that calls it, mirroring `D:\Projects\AI\dev-tickets-tree` (agent-facing skill, dumb tool, tests with a fake config dir). The data (`presets/*.json`) stays in `~/.claude`. Alternative: presets live in this repo and `apply` writes into `~/.claude`.
2. **The model.** Recommended: every preset is additive (lists only what it turns on, plus its own plugins and fragment); `default` is a normal preset that is always on (or implicitly merged); `skills_off` is computed (known skills minus the union of active `skills_on`), never stored. What does "known skills" mean (top-level only, or groups too, given `design` has about 200 folders)?
3. **Conflicts.** Two active presets disagree (one lists a plugin on, another off; `frontend-design`; `claude-hud` always off). Recommended: `on` beats `off` except for an explicit "never" list; report every conflict instead of resolving silently.
4. **`default` naming and content.** Is `default` the base only (4 skills, 4 plugins), or base + `mockup-to-prototype` (what `core.json` is today)? What happens to `core.json` and `fragments/base.md`?
5. **Text (`CLAUDE.md`).** One marker block per active preset, or one block importing N fragments? Order, and the context-size cost of stacking several large fragments (`engineering_productivity.md` already carries a stage table).
6. **State.** `active.json` becomes a list. Per machine only, or also per project (a project's `.claude/settings.json` could enable presets for that project)? Recommended: global first, per-project later.
7. **Migration.** Retire `engineering_productivity` (becomes `engineering` + `productivity`), convert the 20 JSON files to additive, keep the old file format readable?
8. **Skills from outside `.claude`.** Should a preset point (junction) straight at `D:\Projects\AI\dev-tickets-tree\skills\tickets-tree` instead of keeping a copy that goes stale? What about `find-skills` (junction into `.agents`) and plugin-provided skills?
9. **Safety.** Dry run by default, backup before every write, atomic write of `settings.json`, validate JSON after, one-command rollback, never delete a junction target, never select by pattern. What exactly must the tool refuse to touch?
10. **Testing seam.** A fake `CLAUDE_CONFIG_DIR`-style root so tests never touch the real `~/.claude`. Does the tool accept a `--root`?
11. **Restart rule.** Which changes need a session restart, and does the tool say so every time (plugins and `CLAUDE.md` yes, skills no)?
12. **Order of work.** First slice (a tracer bullet): suggested `preset status` that reads the real config and prints the active set, then `apply` against a fake root.

## Working rules for the grill session

- Do not touch `~/.claude` during the grill. Everything there is the person's live setup (see the PRECAUTION RULE in the global `CLAUDE.md`): state what an action touches, whose it is and how it is recovered before any write.
- After the grill: `GLOSSARY.md` and `docs/adr/` updated through `domain-modeling`; then the person types `/to-spec`, `/to-tickets`; tickets live under `.scratch/<feature>/` once `/setup-matt-pocock-skills` has been run (not run yet in this repo).
- Related, separate decision still open in the other session: install the `PostToolUse` hook for the tickets-tree nudge in `~/.claude/settings.json`. It does not depend on this project.
