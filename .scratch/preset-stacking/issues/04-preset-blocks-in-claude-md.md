# 04: Preset blocks in the global CLAUDE.md

**What to build:** Each active preset gets its own marked block in the global `CLAUDE.md`, importing that preset's fragment, in activation order. Adding or removing a preset adds or removes only its own block (ADR 0005). Before any edit the tool checks that every block marker has its pair and refuses to write when one does not, saying which marker is damaged. After every apply it prints one line: restart the session only when a block changed, otherwise already active. It also reports the total size of the stacked fragments whenever a preset is added.

**Blocked by:** 03

**Status:** resolved

- [x] Adding a preset with a fragment adds exactly one block; removing it removes exactly that block
- [x] Blocks appear in activation order
- [x] Text outside the blocks is byte-identical after any apply
- [x] A damaged or unpaired marker makes the command refuse, exit non-zero and name the marker
- [x] A change in a block prints "restart the session"; a skills-only change prints "already active"
- [x] The total fragment size is printed when a preset is added
- [x] A preset without a fragment adds no block
