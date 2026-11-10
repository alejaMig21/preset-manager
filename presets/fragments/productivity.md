# Preset productivity: workflow

Active: productivity skills plus the base. Every global rule stays in force.

## Stage table

| Stage | Skill | Trigger |
|---|---|---|
| 1 Start | engram `mem_context` + `mem_search` | first message of every session |
| 2 Intake | grilling | user says grill/stress-test, or a plan has open branches |
| 2 | grill-me [U] | same, with no repo |
| 2 | to-questionnaire [U] | the answer lives in someone else's head |
| 3 | to-spec [U] | grilling settled, build spans sessions; synthesis only, no interview |
| 7 | handoff [U] | new harness, directory or colleague, or forking a side task |
| 7 | dev-journal | at each milestone, pivot or diagnosed problem, and at session end |
| 8 Teach | teach [U] | user wants to learn a topic across sessions (cwd = workspace) |
| 8 | wait-what [U] | user says a message did not land |
| 8 | learn, doc-coauthoring (plugin) | by their own descriptions |
| 9 Agent docs | writing-for-agents | editing a skill, CLAUDE.md, AGENTS.md or a fragment |
| Always | find-skills, preset-manager, ponytail, caveman | "is there a skill for X", preset switch, every build, every reply |

## Stage rules

1. Start: run `mem_context`, then read `GLOSSARY.md`, `docs/adr/`, `docs/agents/` and the project CLAUDE.md pointers; open a handoff file only when the user names one.
2. Intake: ask what is missing before building. Inside grilling, use its round format (numbered frontier, recommended answer first); outside it, one question at a time. Look facts up yourself; ask only for decisions.
8. Teach: after a wait-what request, re-pitch in plain English with GLOSSARY.md terms and a one-line context.
9. Agent docs: apply writing-for-agents (pointers, front-loaded triggers, one source of truth) before saving any instruction file.

## User-only skills (suggest, do not invoke)

Say "propose: /name because <one line>" and wait. User-only: ask-matt, grill-with-docs, grill-me, to-spec, to-tickets, implement, implement-spec, improve-codebase-architecture, setup-matt-pocock-skills, triage, wayfinder, retro, handoff, teach, to-questionnaire, wait-what. Model-invoked: everything else in the table; load those on their trigger.

## Session checklist

- [ ] Memory recalled and domain docs read before the first answer.
- [ ] Every proposed user-only skill named with its one-line reason.
- [ ] Spec, tickets and decisions saved in the tracker or `.scratch/`, not only in chat.
- [ ] Tests red before green; diff reviewed in a fresh context before commit.
- [ ] Decisions saved (`mem_save`, dev-journal); `mem_session_summary` written.
- [ ] Every substantive reply ended with the "Cómo seguir:" line.
