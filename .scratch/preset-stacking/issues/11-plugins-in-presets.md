# 11: Plugins in presets

**What to build:** A preset definition may list plugins. Planning and applying an active list also switches the managed plugins: those wanted by `default` or an active preset go on, managed plugins nobody asks for go off, and plugins no preset names are never touched. Every plugin change prints the restart notice and is covered by backup and rollback. An unknown or uninstalled plugin is refused, in a definition and in a plan. `status` lists the plugins that have no preset (ADR 0006).

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A plugin listed by an active preset is planned and applied as on; the rest of `settings.json` is unchanged
- [x] `default` plugins are always wanted, even when `default` is not in the active list
- [x] A managed plugin no active preset asks for is switched off; one still asked for by another active preset stays on
- [x] A plugin no preset names is never planned or changed
- [x] A plugin-only change prints the restart notice, not "already active"
- [x] Applying the same state twice changes nothing
- [x] Rollback restores the plugin switches and prints the restart notice
- [x] A definition naming a plugin that is not installed, or with a malformed id, is refused naming the file or the plugin
- [x] `status` lists plugins that have no preset
