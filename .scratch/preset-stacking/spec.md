# Spec: stackable presets with a tested CLI

Status: ready-for-agent

Vocabulary follows `GLOSSARY.md`; decisions follow ADR 0001 to 0005.

## Problem Statement

I use presets of Claude Code skills to switch my working style. Today only one preset can be active, so `engineering_productivity` exists just to get two sets at once. Every preset repeats the base and a long off-list, so presets cannot stack, and a new skill I install (or an agent installs for me) stays on forever with no preset. The whole system is a runbook the assistant follows by hand: it has no tests, my preset files have no history, and one slip touches my live `~/.claude`. I want to say "add engineering", "create a preset X with skills Y and Z", or "group my unassigned skills yourself", and have it work reliably and safely.

## Solution

A zero-dependency Node CLI plus a thin skill. Presets become additive and stack: `default` (the base) is always on, and each active preset adds its skills and its fragment. The CLI applies presets, creates, updates and deletes them, lists unassigned skills, and reports restart needs. The agent does the judging (grouping skills into presets), shows a proposal, and waits for my approval. Every write is guarded by a dry run, a backup and a post-write validation. Preset definitions live in this repo with git history and are applied onto `~/.claude`. A hook nudges the agent to propose a preset after new skills are installed.

## User Stories

1. As the owner, I want several presets active at once, so that I can combine working styles without a combined preset.
2. As the owner, I want to say "add productivity" to an agent, so that its skills and rules turn on without touching the rest.
3. As the owner, I want to say "remove engineering", so that only its skills and its block go away.
4. As the owner, I want `default` always on, so that the base skills are never lost or repeated per preset.
5. As the owner, I want `default` to hold only the four base skills, so that it never gets in the way.
6. As the owner, I want `mockup-to-prototype` in its own `prototyping` preset, so that I add it only when needed.
7. As the owner, I want each preset to list only what it turns on, so that two presets never fight over an off-list.
8. As the owner, I want the tool to compute what to turn off, so that I never maintain off-lists.
9. As the owner, I want the tool to switch only managed skills, so that a skill I installed by hand keeps working.
10. As the owner, I want a command that lists unassigned skills, so that I know what no preset covers.
11. As the owner, I want `preset status` to always show the unassigned skills, so that I notice drift without remembering to look.
12. As the owner, I want to say "create preset X with skills Y and Z", so that a precise order runs directly.
13. As the owner, I want to update a preset by adding or removing skills, so that presets evolve.
14. As the owner, I want to delete a preset, so that dead presets disappear; deleting an active preset should deactivate it first and tell me.
15. As the owner, I want to say "group my unassigned skills yourself", so that the agent does the sorting.
16. As the owner, I want the agent to show a proposal (preset names and their skills) and wait for my yes, so that a bad grouping is never written.
17. As the owner, I want to correct a proposal before approving, so that I steer names and groups.
18. As the owner, I want a hook that fires after a `skills add` install, so that new skills get a preset proposal automatically.
19. As the owner, I want that hook to only nudge, so that it never writes or decides.
20. As the owner, I want the hook installed only after I approve the exact change to `settings.json`, so that my config is not edited behind my back.
21. As the owner, I want every command to be a dry run by default, so that I see the changes before they happen.
22. As the owner, I want an explicit confirm to write, so that nothing changes by accident.
23. As the owner, I want a backup of `settings.json` and `CLAUDE.md` before every write, so that I can recover.
24. As the owner, I want a single rollback command, so that undoing is one step.
25. As the owner, I want the tool to validate `settings.json` as JSON after writing, so that I never end with a broken file.
26. As the owner, I want the tool to restore the backup if validation fails, so that failures leave no damage.
27. As the owner, I want the tool to touch only skill switches, preset blocks and its own junctions, so that the rest of my config is safe.
28. As the owner, I want the tool to never delete the folder a junction points at, so that source skills are never lost.
29. As the owner, I want the tool to never select files by pattern, so that a broad match cannot hit something it did not create.
30. As the owner, I want each preset's fragment in its own block in `CLAUDE.md`, so that blocks are added and removed independently.
31. As the owner, I want the tool to check that every block marker has its pair before editing, so that corrupted markers do not leave orphan text.
32. As the owner, I want the tool to refuse to write when markers are damaged, and say why, so that I fix it first.
33. As the owner, I want a restart notice after each apply, so that I know whether Claude already sees the change.
34. As the owner, I want "restart the session" only when a preset block changed, so that I do not restart needlessly.
35. As the owner, I want "already active" when only skills changed, so that I trust the state.
36. As the owner, I want the total fragment size reported when I add a preset, so that I see the context cost of stacking.
37. As the owner, I want a skill in another project (like `tickets-tree`) linked in place, so that it is always the current version.
38. As the owner, I want broken junctions reported by `preset status`, so that a moved source folder does not fail silently.
39. As the owner, I want `engineering_productivity` retired and its text split into `engineering` and `productivity` fragments, so that each preset carries its own rules.
40. As the owner, I want `core` retired in favour of `default`, so that there is one name for the base.
41. As the owner, I want a one-time conversion of my 20 existing presets to the new format, so that all presets can stack.
42. As the owner, I want a backup before that conversion, so that the old files are recoverable.
43. As the owner, I want the converter to run once only and the tool to never read the old format afterwards, so that there is one format.
44. As the owner, I want the active presets stored as one global ordered list, so that activation order decides block order.
45. As the owner, I want applying the same active list twice to change nothing, so that apply is safe to repeat.
46. As the owner, I want the repo definitions to win on every apply, so that there is one source of truth.
47. As the owner, I want plugins and `statusLine` never touched, so that `claude-hud` and other plugins stay fixed.
48. As the owner, I want a `--root` option, so that I and the tests can run against a fake config folder.
49. As the developer, I want the tests to run the real CLI against a fresh fake root per test, so that development never touches the live `~/.claude`.
50. As the developer, I want the skill to tell the agent how to run each command, so that natural-language requests map to commands.
51. As the owner, I want the live setup replaced last, after a dry run and my approval of the exact files, so that the old system keeps working until the new one is proven.
52. As the owner, I want clear error messages that name the file and the problem, so that I can fix a failure fast.

## Implementation Decisions

- **Preset model**: a preset is a name, a description and a list of skills it turns on, each with a source (a skill group folder, or an absolute path outside `~/.claude`), plus an optional fragment. No off-list, no plugins, no base copy (ADR 0001, 0002).
- **Managed skills**: the union of skills named in all preset definitions. The off-list is managed skills not named by any active preset.
- **Default preset**: a normal preset with the four base skills, always applied even if absent from the active list.
- **Active state**: one global ordered list of preset names with the date each was activated.
- **Commands** (names are the interface; exact flags settled at build time): status, list, add, remove, create, update, delete, orphans, rollback, convert, hook install. All write commands are dry run unless confirmed.
- **Apply**: junctions for skills of active presets; skill switches written for managed skills not wanted; one preset block per active preset in the global `CLAUDE.md`, in activation order; unchanged inputs produce unchanged outputs.
- **Preset blocks**: marked sections in `CLAUDE.md` that each import one fragment; markers are validated as pairs before any edit (ADR 0005).
- **Junctions**: created only for skills the tool manages; removed only by removing the link itself, never its target; skills whose source is outside `~/.claude` are linked in place (ADR 0003).
- **Safety**: dry run default, backup before write, validation after write, restore on failure, touch only skill switches, preset blocks and own junctions, no pattern selection (ADR 0004).
- **Restart notice**: printed after every apply; restart only when a preset block changed.
- **Orphans**: skills visible under `~/.claude/skills` (top level and groups) that no preset names.
- **Agent proposal**: the skill instructs the agent to show a proposal and wait for approval when grouping on its own; explicit orders run directly after the dry run.
- **Hook**: a PostToolUse hook that detects a Bash `skills add` run, calls the orphans command and injects context asking the agent to propose a preset; it only nudges. Installed only with approval of the exact `settings.json` change.
- **Converter**: one-time; backs up, rewrites the 20 existing presets to the new format, drops base copies, off-lists and plugin fields, retires `core` and `engineering_productivity`, splits the stage-table text into engineering and productivity fragments, and creates `prototyping`. Shared rules (the "Cómo seguir" rule, overrides) are placed once per fragment that needs them; duplication when both are stacked is accepted.
- **Source of truth**: repo definitions win on apply (ADR 0003).
- **Delivery**: the whole feature ships complete; cutover of the live setup is the last step.

## Testing Decisions

- A good test drives the real CLI as a subprocess against a fresh fake config root and asserts only external behaviour: resulting files, printed output and exit code. It never inspects internals.
- One seam only: the CLI. No unit tests for internal modules.
- Cases to cover: stacking and removal; default always on; computed off-list limited to managed skills; unassigned skill untouched; create, update, delete presets; orphans listing; dry run changes nothing; backup and rollback; invalid JSON restored; damaged markers refused; junction created, removed, target preserved; broken junction reported; external-source junction; restart notice both cases; idempotent apply; converter on a fake copy of the old format; hook install dry run.
- Prior art: the `dev-tickets-tree` project (`D:\Projects\AI\dev-tickets-tree`, an earlier project of the owner with a Node tool tested through a fake config dir). It is the model to mirror, not a dependency.
- Runner: `node --test`, no dependencies.

## Out of Scope

- Plugins, `enabledPlugins` and `statusLine` (including `claude-hud`).
- Per-project active presets (global only for now).
- Reading the old preset format after the one-time conversion.
- Managing skills no preset names, and skills provided by plugins.
- Automatic grouping without approval.
- Pushing anything to a remote or publishing the tool.

## Further Notes

- Not yet verified: the folder where `skills add -g` installs a skill; the hook matcher depends on it.
- Junction creation on Windows needs `mklink /J`; tests must create them inside the fake root.
- `docs/grill-brief.md` is partly superseded by the ADRs (data location, plugin scope).
