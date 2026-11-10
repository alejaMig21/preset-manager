# Presets cover skills and text only, not plugins

A preset turns skills on and adds one fragment to the global `CLAUDE.md`. Plugins (`enabledPlugins`) and the `statusLine` setting are outside the preset system and stay fixed configuration. The `claude-hud` plugin switch does not hide its HUD, because `statusLine` runs the plugin code directly, so a preset toggling it would give a false picture. Fragments stay because they carry per-preset workflow rules; they are joined when presets stack.
