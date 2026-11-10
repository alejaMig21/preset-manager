# 03: Confirmed writes with a safety net

**What to build:** `add` and `remove` write for real only when the person confirms. Before writing, the tool backs up `settings.json` and `CLAUDE.md`. After writing it validates that `settings.json` is still valid JSON and restores the backup when it is not. A `rollback` command returns to the last backup in one step. The tool touches only skill switches, its own junctions and (later) preset blocks; it never deletes the folder a junction points at and never selects files by pattern (ADR 0004). Applying the same active list twice changes nothing.

**Blocked by:** 02

**Status:** resolved

- [x] Without confirmation nothing is written
- [x] With confirmation the active list, skill switches and junctions match the plan
- [x] A backup of both files exists before every write
- [x] A forced invalid result leaves the original `settings.json` restored and exits non-zero with an explanation
- [x] `rollback` restores the last backup
- [x] Removing a junction never deletes its source folder
- [x] A second apply of the same state changes no file
- [x] Anything in the config folder the tool did not create or manage is byte-identical afterwards
