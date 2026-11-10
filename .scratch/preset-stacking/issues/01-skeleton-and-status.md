# 01: Skeleton and `preset status`

**What to build:** The `preset` command exists and `preset status --root <folder>` reads the preset definitions of this repo plus the fake config folder, then prints the ordered list of active presets (empty at first) and the known presets. The automated test harness exists: each test builds a fresh fake config folder, runs the real command as a subprocess and checks only printed output, files and exit code (the single test seam of the spec). Zero dependencies, `node --test`.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `preset status --root <folder>` prints the active presets (none) and the known presets, exit code 0
- [x] Without `--root` the command targets the real config folder, but no test ever does
- [x] A missing or malformed preset definition gives an error naming the file and the problem, exit code non-zero
- [x] The state of active presets is one global ordered list with the activation date of each
- [x] `node --test` runs the first tests against a fake config folder
