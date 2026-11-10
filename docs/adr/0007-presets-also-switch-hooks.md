# Presets also switch hooks, and tag each one with its owner

A preset may list hooks (an id, an event, an optional matcher, a command and a note). Activating the preset adds them to `settings.json`, deactivating it removes them, and a hook no preset names is never touched. A managed hook is recognised by its exact event, matcher and command, and carries the visible tag `[preset <name>: <id>]` in its `statusMessage`, because hook entries have no id field and unknown keys are not safe to add. `preset hooks` lists every hook with its owner, or "unmanaged", plus hooks that are defined but not installed, so a later cleanup starts from facts. Chosen over a read-only inventory because a project's hook should run only while its preset is active, and because the hooks that already exist had no owner at all.

## Consequences

Hooks reload from `settings.json` without a restart, so a hook-only change prints "already active". Preset definitions live in a public repository: adopt only hook commands you are happy to publish, since they may contain local paths. Hook ids are unique across all presets.
