# 09: One-time conversion of the old presets

**What to build:** A `convert` command takes the old preset format and rewrites it into the new additive format: drops the repeated base, the off-lists and the plugin fields, retires `core` and `engineering_productivity`, creates `default` (base only) and `prototyping` (`mockup-to-prototype`), and splits the stage-table text of the retired preset into an `engineering` fragment and a `productivity` fragment. It backs up first, runs once, and the tool never reads the old format afterwards. It is exercised against a fake copy of the old setup built from the snapshot of 2026-11-09, never the live files.

**Blocked by:** 04, 05

**Status:** resolved

- [x] A fake copy of the old format converts into valid new-format presets that `status` reads
- [x] `core` and `engineering_productivity` no longer exist afterwards; `default` and `prototyping` do
- [x] `default` lists exactly the four base skills
- [x] The two new fragments together keep every rule of the old fragment, and each preset carries its own
- [x] A backup of the old files exists before anything is written
- [x] Running convert a second time refuses and says it already ran
- [x] The dry run changes nothing
