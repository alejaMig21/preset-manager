---
name: preset-manager
description: Runbook to switch, list, create or repair presets (named sets of skills, plugins and a CLAUDE.md text fragment). Use when the user says "cambia a <preset>", "change to preset X", "switch preset", "which presets exist", "new preset", or mentions gamedev, engineering, productivity or design_* presets. Always on: part of the base of every preset. No script exists: the assistant runs the steps with its own tools.
---

# preset-manager

A **preset** = skills on/off + plugins on/off + a text fragment appended to the global CLAUDE.md. Exactly one preset is active. Switching never deletes a skill. This skill is in the base of every preset and must never be turned off. Everything lives inside `~/.claude`.

## Layout

| Path | Role |
|---|---|
| `presets/<name>.json` | Source of truth. Fields: `skills_on[{name,source}]`, `skills_off[]`, `plugins_on[]`, `plugins_off[]`, `fragments[]`, `notes`. `source` is `top` or `<group>/<folder>`. |
| `presets/active.json` | `{"active": "<name>", "since": "<date>"}`. Create if missing, update on every switch. |
| `presets/fragments/<name>.md` | The preset's CLAUDE.md text. `fragments/base.md` only documents the mechanism and is never imported. |
| `presets/backups/` | Timestamped copies of `settings.json` and `CLAUDE.md` (keep the last 5 of each). |
| `skills/<group>/<folder>` | Grouped skills. Claude Code only sees `skills/<name>`, so a junction `skills/<name>` -> `skills/<group>/<folder>` activates one. Junctions are a derived cache: recreate them from the preset file. |
| `settings.json` | `skillOverrides` (`off` etc.; no effect on plugin skills) and `enabledPlugins`. |
| `CLAUDE.md` | Global file. User blocks stay as they are; the preset block is the last thing in the file. |

All paths are relative to `~/.claude` (`C:\Users\aleja\.claude`). The `_shared` folder is not a skill.

## Defined presets

`core`, `gamedev`, `engineering`, `productivity`, `engineering_productivity`, `design_<subgroup>` (`ui`, `ux`, `review`, `accessibility`, `system`, `figma`, `motion`, `3d_creative`, `dataviz`, `slides_content`, `native_mobile`, `product`, `bundles`; `design_tui` is proposed). Base in every preset: ponytail, caveman, engram, `dev-journal`, `find-skills`, `preset-manager`, `skill-creator`.

## Fragment mechanism

The global CLAUDE.md holds ONE preset block, at the very end:

```
<!-- preset:NAME -->
@presets/fragments/NAME.md
<!-- /preset:NAME -->
```

Imports are relative to the global CLAUDE.md (absolute and `~` imports from a project-level CLAUDE.md do not load). CLAUDE.md is read only at session start, so a restart is required. Never edit `<!-- user:... -->` blocks while switching. Original CLAUDE.md snapshot: `presets/CLAUDE.md.backup-before-fragment`.

## Runbook: "cambia a <preset>"

1. **Read.** Read `presets/<name>.json` (stop and report if missing) and `presets/active.json` (the current preset). If target equals current, say so and only re-verify.
2. **Plan + backup.** Tell the user in plain Spanish what turns on and what turns off (skills, plugins, text). Copy `settings.json` and `CLAUDE.md` to `presets/backups/settings.<yyyymmdd-hhmmss>.json` and `presets/backups/CLAUDE.<yyyymmdd-hhmmss>.md`; delete all but the 5 newest of each.
3. **Skills (junctions).** For each `skills_on` entry with source `<group>/<folder>`: ensure `skills/<name>` exists as a junction to `skills/<group>/<folder>`; if missing run `cmd /c mklink /J "<link>" "<target>"` and check it exists. Junctions that belonged to the previous preset and are not listed by the new one: remove each with `cmd /c rmdir "<link>"` only. Never `rm -r`, never delete the target folder.
4. **settings.json** (Read + Edit; touch nothing else). Set `skillOverrides` to `{name: "off"}` for every `skills_off` entry and remove any override of a `skills_on` entry. Set `enabledPlugins[p] = true` for `plugins_on` and `false` for `plugins_off`. Read the file back and confirm it is valid JSON.
5. **CLAUDE.md fragment.** The global CLAUDE.md must always match the ACTIVE preset.
   - Remove the existing `<!-- preset:... -->` block(s) including their closing marker.
   - Then append at the very end: `<!-- preset:NAME -->`, one `@presets/fragments/<f>.md` line for EACH entry of `fragments` that is a real file other than `base.md`, then `<!-- /preset:NAME -->`. A preset with no real fragment gets no block.
6. **Verify.**
   - The live skill list now shows the `skills_on` skills and hides the `skills_off` ones (it updates in-session).
   - Grep CLAUDE.md: exactly one `<!-- preset:` opening marker and one closing marker.
   - Every skill or command named in the fragment text (for example `/sdd-*`) is in `skills_on`; report each reference to an inactive skill.
7. **Record.** Write `presets/active.json` = `{"active": "<name>", "since": "<today>"}`.
8. **Report.** Short, in the user's language, then the LAST line every time: "Reinicia la sesion de Claude Code para cargar el nuevo fragmento de CLAUDE.md y los plugins." Skill changes apply live; CLAUDE.md and plugin changes need the restart.

## Rollback

Restore the newest good pair from `presets/backups/`: copy `settings.<ts>.json` over `settings.json` and `CLAUDE.<ts>.md` over `CLAUDE.md`, re-run step 3 for the previous preset (its junctions), set `active.json` back, and tell the user to restart. Pre-preset settings: `presets/settings.backup-before-presets.json`.

## When to suggest a switch

If the user asks for work that needs skills or rules from another preset (for example SDD, PR or review work while `engineering_productivity` is active; Unity or Blender work without `gamedev`; UI work without a `design_*` preset), say which preset fits and why, and ask. Never switch silently.

## Create or repair a preset

Create `presets/<name>.json` with the fields above (copy a close preset), optionally `fragments/<name>.md` and list it in `fragments`, then run the runbook. `skills_off` = universe of top-level skills plus group skills not in `skills_on` or the base. `claude-hud` is off in every preset.

Every preset fragment must include a "Next step" rule like the one in `fragments/engineering_productivity.md` (rule 10): end each substantive reply with a "Cómo seguir:" line that tells the user what to type or say next, using the skills that preset offers (user-only skills with their one-line reason, or plain words), and says when nothing is needed from the user. Copy that rule into a new fragment and adapt the examples to the preset's skills.
