# 13: Hooks in presets

**What to build:** A preset definition may list hooks. Planning and applying an active list also adds the hooks wanted by `default` or an active preset, removes managed hooks nobody asks for, and gives an existing identical hook its owner tag. Hooks no preset names are never touched. `preset hooks` lists every hook with its owner or "unmanaged", and the hooks defined but not installed. `status` reports how many hooks are unmanaged (ADR 0007).

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A wanted hook is added as its own entry with the tag `[preset <name>: <id>]`; every other hook is unchanged
- [x] Removing a preset removes only its hooks and cleans up empty entries
- [x] An identical hook that already exists is tagged, not duplicated, and a second apply changes nothing
- [x] A managed hook deleted by hand is added back by the next apply
- [x] A hook-only change prints "already active", not the restart notice
- [x] Hooks no preset names are never planned or changed
- [x] Rollback restores the hooks
- [x] A malformed hook definition, or an id used twice across presets, is refused naming the file or the id
- [x] `preset hooks` shows each hook's owner or "unmanaged", and hooks defined but not installed
- [x] `status` shows the number of unmanaged hooks
