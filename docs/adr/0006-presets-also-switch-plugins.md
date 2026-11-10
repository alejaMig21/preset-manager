# Presets also switch plugins

Each preset may list plugins it turns on, and plugins stack like skills: `default` carries the four base plugins, the tool computes which managed plugins to switch off, and a plugin that no preset names is left alone. This replaces the plugin part of ADR 0002, because turning on a working style should not need a second manual step, and a plugin such as `unity` costs about 1,800 tokens per session when it is always on. `claude-hud` stays unmanaged: the `statusLine` setting runs its code directly and ignores the plugin switch, so no preset should touch it.

## Consequences

Claude Code loads plugins at session start, so every plugin change prints the restart notice; skills-only changes stay live. Rollback restores plugin switches because they live in `settings.json`, which every backup already holds. A plugin counts as installed when `plugins/installed_plugins.json` lists it; with no such file the tool trusts the plugins named in `enabledPlugins`. A preset that asks for a plugin that is not installed is refused, so a typo or a removed plugin cannot be switched on by name.
