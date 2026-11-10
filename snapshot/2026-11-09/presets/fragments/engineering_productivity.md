# Preset engineering_productivity: session workflow

Active: engineering + productivity skills plus the base. Every global rule stays in force.

## Stage table

Flow: grill -> (research, prototype) -> to-spec -> to-tickets -> implement -> code-review -> pr -> retro. `[U]` = user-only: propose it, the user types it. Full router: `/ask-matt`.

| Stage | Skill | Trigger |
|---|---|---|
| 1 Start | engram `mem_context` + `mem_search` | first message of every session |
| 1 | setup-matt-pocock-skills [U] | specs, tickets or triage wanted and `docs/agents/issue-tracker.md` is missing |
| 1 | ask-matt [U] | user is unsure which skill fits |
| 2 Intake | grilling | user says grill/stress-test, or a plan has open branches |
| 2 | grill-with-docs [U] | vague idea inside a repo (leaves GLOSSARY.md + ADRs) |
| 2 | grill-me [U] | same, with no repo |
| 2 | domain-modeling | term clash, overloaded word, GLOSSARY.md or ADR edit |
| 2 | to-questionnaire [U] | the answer lives in someone else's head |
| 3 Plan | research | a fact is needed from outside the repo; background agent, cited file |
| 3 | wayfinder [U] | effort too big for one session and the way is unclear |
| 3 | to-spec [U] | grilling settled, build spans sessions; synthesis only, no interview |
| 3 | to-tickets [U] | spec approved; tracer-bullet tickets with blocking edges |
| 3 | triage [U] | raw issues or PRs the user did not write |
| 4 Build | tdd | any behaviour built or fixed (project runner: `uv run pytest -q`) |
| 4 | implement [U] | one ticket or a small spec, one context |
| 4 | implement-spec [U] | whole spec as a ticket graph on one integration branch |
| 4 | prototype | a design question cannot be settled on paper |
| 4 | codebase-design | shaping a module interface or seam; deep-module vocabulary |
| 4 | improve-codebase-architecture [U] | spare moment, or structure makes tests hard |
| 4 | wizard | steps only a human can do (credentials, dashboards, cutover) |
| 5 Debug | diagnosing-bugs | anything broken, failing, slow or flaky |
| 6 Ship | code-review | non-trivial diff before commit, merge or PR; pin the fixed point |
| 6 | pr | writing a PR body (only when the user asks for a PR) |
| 7 End | retro [U] | after a build that went sideways, or after a bugfix |
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
3. Plan: keep grill -> to-spec -> to-tickets in one context window. Tracker config is `docs/agents/*.md`; local tickets live in `.scratch/<feature>/issues/`. `/compact` at the nearest boundary near the smart zone; `/clear` between tickets.
4. Build: confirm seams once per feature before the first test (tdd). Parallel independent tickets run in worktrees (implement-spec does this natively). Put a prototype on `prototype/<name>` and fold only the verdict into code.
5. Debug: reach a red one-command loop before any hypothesis; show the ranked hypotheses to the user.
6. Ship: run code-review in a fresh context (Standards and Spec reported separately), then `ponytail-review`, then pr.
7. End: save decisions and gotchas with `mem_save`, write a dev-journal entry at each milestone or pivot, finish with `mem_session_summary`. Propose retro and handoff; never run them unasked.
8. Teach: after a wait-what request, re-pitch in plain English with GLOSSARY.md terms and a one-line context.
9. Agent docs: apply writing-for-agents (pointers, front-loaded triggers, one source of truth) before saving any instruction file.
10. Next step: end every substantive reply with one line "Cómo seguir:" naming the recommended next move for the current stage, using what this preset offers: either a user-only skill the user types (`/wayfinder`, `/to-spec`, `/to-tickets`, `/implement`, `/handoff`, `/retro`...) with its one-line reason, or plain words the user can say ("adelante con X"). When a wayfinder map is open, name the frontier tickets and which of them need the user (conversation) and which the assistant can take alone. Say explicitly when nothing is needed from the user. Keep it to one or two lines, in the user's language, with no new jargon.

## User-only skills (suggest, do not invoke)

Say "propose: /name because <one line>" and wait. User-only: ask-matt, grill-with-docs, grill-me, to-spec, to-tickets, implement, implement-spec, improve-codebase-architecture, setup-matt-pocock-skills, triage, wayfinder, retro, handoff, teach, to-questionnaire, wait-what. Model-invoked: everything else in the table; load those on their trigger.

## Overrides while this preset is active

- Overlaps resolved: to-spec beats sdd-propose/spec/design; to-tickets beats sdd-tasks; implement and implement-spec beat sdd-apply; code-review beats sdd-verify/judgment-day; pr beats branch-pr; retro beats skill-improver. If the user asks for an off skill, say it is off in this preset.
- Delegation triggers, worktree parallelism, fresh-context review, engram protocol, Strict TDD, ponytail and caveman apply unchanged. Keep passing a `model` alias (sonnet default) on Agent calls and hand sub-agents the skill paths `~/.claude/skills/<group>/<skill>/SKILL.md`.
- Replies follow the persona language; every artifact (GLOSSARY.md, specs, tickets, ADRs, PR bodies, comments) is English. The repo `GLOSSARY.md` holds domain terms; the reply "Glosario" explains terms to the user.
- Commits are conventional with no attribution; /implement commits on the current feature branch only. Push and open a PR only on request. Triage's AI disclaimer line stays in tracker comments because that skill mandates it.
- The project CLAUDE.md wins on test runner, branch policy and roadmap location.

## Session checklist

- [ ] Memory recalled and domain docs read before the first answer.
- [ ] Every proposed user-only skill named with its one-line reason.
- [ ] Spec, tickets and decisions saved in the tracker or `.scratch/`, not only in chat.
- [ ] Tests red before green; diff reviewed in a fresh context before commit.
- [ ] Decisions saved (`mem_save`, dev-journal); `mem_session_summary` written.
- [ ] Every substantive reply ended with the "Cómo seguir:" line.
