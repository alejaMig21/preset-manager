# 07: Thin `preset-manager` skill for the agent

**What to build:** The new `preset-manager` skill replaces the old runbook-only one. It tells the agent how to turn the person's natural-language requests into commands: add or remove a preset, create, update or delete a preset, list unassigned skills. When the person says to group unassigned skills on its own, the agent shows a proposal (preset names and their skills) and waits for approval before writing; explicit orders run directly after the dry run. The skill follows the writing-for-agents guidance and states when to tell the person to restart the session. It is delivered in this repo; replacing the live skill is ticket 10.

**Blocked by:** 05, 06

**Status:** resolved

- [x] The skill maps each of the four request types to the right command
- [x] It states the proposal-first rule for "group them yourself" requests
- [x] It states that every write is a dry run first and needs confirmation
- [x] It tells the agent to relay the restart notice
- [x] It points to the glossary terms instead of redefining them
