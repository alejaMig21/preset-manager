---
name: preset-manager
description: Stack presets of skills and text. Use when the user names a preset (add, remove, create, update, delete), asks what is active, asks which skills have no preset, wants skills grouped into presets, or a hook reports skills without a preset.
---

# preset-manager

CLI: `node D:\Projects\AI\preset-manager\bin\preset.js` (written `preset` below). The CLI does the work; you do the judging. Terms are in `GLOSSARY.md`, decisions in `docs/adr/` of that repo.

## Requests and commands

| The person says | Run |
|---|---|
| what is active, what exists | `preset status`, `preset list` |
| add or remove preset X | `preset add X`, `preset remove X` |
| create preset X with skills Y and Z (and plugins) | `preset create X --skills Y,Z --plugins p@m --description "..."` |
| change what X contains | `preset update X --add a,b --remove c --add-plugins p@m --remove-plugins p@m` |
| delete X | `preset delete X` |
| which skills have no preset | `preset unassigned` |
| where an unassigned skill belongs, or whether it is needed | `preset suggest [skill...]` |
| make the active list real again | `preset apply` |
| undo the last change | `preset rollback` |

A skill outside the config folder goes in as `--skills name=<absolute path>`. A plugin id is `name@marketplace`, as in `enabledPlugins`; the CLI refuses one that is not installed. Plugin changes load only when a session starts, so relay the restart notice. Run `preset` with no command to list every command.

## Writing

Every write is a dry run until `--yes`. Run the dry run, show the plan, then run again with `--yes`.

- An explicit order (add, remove, create, update, delete, rollback) is the approval: show the plan, then add `--yes` without asking again.
- `preset convert` and `preset hook install` change what the person did not name: show the plan, wait for a yes, then add `--yes`.
- Done means the command printed its result line. Relay the restart notice it prints, word for word.

## Grouping skills on your own

Done when the person has approved a proposal.

1. Run `preset suggest` (evidence for every unassigned skill) and `preset list`.
2. Give every skill a verdict from that evidence:
   - **covered**: a skill of an existing preset, or a "beats" statement in a preset text, already replaces it. Name that skill and propose leaving it unassigned.
   - **fits an existing preset**: name the preset.
   - **new preset**: only for skills that fit none; group them by what they do.
3. Show the proposal as skill, verdict, evidence line. Say where the evidence is thin.
4. Wait for the person's yes or corrections.
5. Apply it with `create` and `update`, each through its dry run.

A hook can also report unassigned skills after a `skills add`: handle it the same way, starting at step 1.
