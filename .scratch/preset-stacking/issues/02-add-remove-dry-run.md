# 02: Dry run of `add` and `remove`

**What to build:** `preset add <name>` and `preset remove <name>` print the plan without writing anything: which skills would be turned on, which would be turned off, which junctions would be created or removed. `default` (the four base skills) is always on. Only managed skills (named in some preset) are ever switched; unassigned skills are never touched. The off-list is computed (ADR 0001): managed skills no active preset asks for. A skill whose source lives outside the config folder is planned as a junction straight to that source, never a copy (ADR 0003).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Adding a preset plans its skills on and leaves the rest as they are
- [ ] Removing a preset plans off only managed skills that no remaining active preset asks for
- [ ] `default` skills are planned on even when `default` is not in the active list
- [ ] An unassigned skill never appears in the plan
- [ ] An external-source skill is planned as an in-place junction
- [ ] Running the command changes no file in the fake config folder
- [ ] Adding an already active preset or removing an inactive one reports it and plans nothing
