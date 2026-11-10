# 14: Hook commands and live adoption

**What to build:** `preset hook define` adds a hook to a preset from arguments, `preset hook adopt <number>` copies an existing unmanaged hook (numbered by `preset hooks`) into a preset, and `preset hook drop` removes a hook from a preset. All three write only the preset definition, are dry runs until `--yes`, and never change `settings.json`; the next apply gives the hook its tag. Updating a preset's skills or plugins keeps its hooks. `list --details` shows hooks. The hook of the `tickets-tree` project and the hooks that already exist are then given owners, only after the person approves each definition, because definitions live in a public repository.

**Blocked by:** 13

**Status:** ready-for-agent

- [x] `hook define` writes a valid hook into the named preset and refuses an unknown preset, a repeated id or a missing command
- [x] `hook adopt` copies the numbered hook's event, matcher and command, refuses a number out of range or an already managed hook, and leaves `settings.json` unchanged
- [x] `hook drop` removes the hook from the definition and refuses an unknown id
- [x] `update` and `create` keep the hooks of a preset
- [x] `list --details` shows each preset's hooks
- [ ] The person approved every hook definition before it was written
