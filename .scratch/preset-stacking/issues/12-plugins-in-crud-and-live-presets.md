# 12: Plugins in create, update, list and the live presets

**What to build:** `create` takes `--plugins`, `update` takes `--add-plugins` and `--remove-plugins`, and `list` shows each preset's plugins. Then the real definitions get their plugins: the four base plugins in `default`, `frontend-design` in `design_ui` and `design_system`, and `unity` in `gamedev`. The dry run against the real configuration is shown to the person, who approves the exact change before anything is written to it.

**Blocked by:** 11

**Status:** ready-for-agent

- [x] `create --plugins` writes the plugins into the definition and refuses an unknown one
- [x] `update --add-plugins` and `--remove-plugins` change only the plugin list; removing one that is not listed is refused
- [x] `list` shows plugins next to skills
- [x] The repo definitions carry the plugins listed above
- [ ] The real dry run was shown and the exact change approved before any write
