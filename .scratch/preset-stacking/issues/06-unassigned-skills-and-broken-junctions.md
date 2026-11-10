# 06: Unassigned skills and broken junctions

**What to build:** An `orphans` command lists the unassigned skills: installed skills, at the top level and inside skill groups, that no preset names. `preset status` always shows that list and also reports every junction whose source no longer exists. Both are read-only.

**Blocked by:** 03

**Status:** resolved

- [x] `orphans` lists installed skills that no preset names and omits managed ones
- [x] `status` shows the unassigned skills every time
- [x] `status` reports a junction whose source folder was removed, naming the junction
- [x] With no unassigned skills and no broken junctions the output says so
- [x] Neither command writes anything
