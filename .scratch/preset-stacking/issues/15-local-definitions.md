# 15: Local definitions that git never uploads

**What to build:** The tool reads `presets.local/` next to `presets/`. A local file adds to the public preset of the same name, or is a private preset when none exists. `hook define`, `hook adopt` and `create` take `--local`; without it a hook command that holds a local path warns and points at `--local`. `update` edits the public file, or the local one for a private preset, and never copies local parts into the public file. `drop` removes a hook from whichever file holds it, `delete` backs up and removes both files, and `preset hooks` marks local hooks. The folder is listed in `.gitignore`. Then the person's personal hook definitions move from `presets/` to `presets.local/` before anything is pushed (ADR 0008).

**Blocked by:** 14

**Status:** resolved

- [x] A local file adds hooks, plugins or skills to the public preset of the same name, and apply uses the merged result
- [x] A local file with no public counterpart works as a private preset
- [x] `hook define --local`, `hook adopt --local` and `create --local` write only under `presets.local/` and never warn about the public repository
- [x] A hook command with a local path, written without `--local`, warns and mentions `--local`
- [x] `update` never writes local hooks, plugins or skills into the public file
- [x] A hook id used in both the public and the local file is refused
- [x] `drop` and `delete` handle both files; `delete` backs up both
- [x] A local file whose name does not match its filename is refused naming the file
- [x] `preset hooks` marks local hooks, and `.gitignore` lists `presets.local/`
- [x] The personal hook definitions moved to `presets.local/`, `apply` shows nothing to change, and no commit that would be pushed contains them
