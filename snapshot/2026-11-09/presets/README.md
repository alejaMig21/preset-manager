# Presets

One JSON file per preset. These files are the source of truth. Junctions in `~/.claude/skills`, `skillOverrides` and `enabledPlugins` in `settings.json`, and `@` imports in `CLAUDE.md` are derived from them and can be rebuilt at any time. Managed by the `preset-manager` skill.

## Schema

- `name`, `description`, `status` (`defined` or `applied`), `base` (always true)
- `skills_on`: `{name, source}`; source is `top` (directly in `~/.claude/skills`) or `<group>/<folder>` (needs a junction)
- `skills_off`: every skill in the universe (top-level plus engineering/productivity group skills) not in `skills_on`; set to `off` while the preset is active
- `plugin_skills_base`, `plugin_skills_extra`: skills provided by plugins (not on disk)
- `plugins_on`, `plugins_off`: entries for `enabledPlugins`
- `fragments`: paths (relative to `~/.claude/presets/`) of CLAUDE.md fragment files; see "Fragment mechanism"
- `applied_record`: facts about a past apply (only `engineering_productivity`)
- `notes`: short remarks, unverified claims flagged

## Base (in every preset)

Skills: `dev-journal`, `find-skills`, `preset-manager`, `skill-creator`. Plugins on: `engram`, `ponytail`, `caveman`, `pyright-lsp`. `claude-hud` is always off. `frontend-design` is off except in `design_ui` and `design_system`. Fragment `fragments/base.md` is always listed.

## Fragment mechanism

A fragment is a Markdown file in `~/.claude/presets/fragments/` holding the workflow text of one preset. `fragments/base.md` only explains the mechanism and is never imported. The global `~/.claude/CLAUDE.md` receives ONE marker block per active preset, placed at the very end of the file:

```
<!-- preset:NAME -->
@presets/fragments/NAME.md
<!-- /preset:NAME -->
```

- The import path is relative to the global CLAUDE.md (`@presets/...`; verified to work).
- Switching presets removes the previous `preset:` block and appends the new one; re-applying the same preset replaces its block, never duplicates it.
- Back up CLAUDE.md before the first change (`presets/CLAUDE.md.backup-before-fragment`).
- CLAUDE.md is read only at session start (verified), so restart the session after a switch.
- Presets without a `fragments/NAME.md` file get no marker block.

## Presets

- `core`: base + mockup-to-prototype
- `gamedev`: unity-best-practices, blender-addon-zip (+ `fragments/gamedev.md`)
- `engineering`: all skills in `skills/engineering`
- `productivity`: all skills in `skills/productivity` + learn, doc-coauthoring
- `engineering_productivity`: union of the two (applied 2026-10-20)
- `design_ui`, `design_ux`, `design_review`, `design_accessibility`, `design_system`, `design_figma`, `design_motion`, `design_3d_creative`, `design_dataviz`, `design_slides_content`, `design_native_mobile`, `design_tui`, `design_product`, `design_bundles`: subgroups of `skills/design`; design presets list only top-level and engineering/productivity skills in `skills_off`
