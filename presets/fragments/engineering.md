# Preset engineering: workflow

Active: engineering skills plus the base. Every global rule stays in force.

## Stage table

Flow: grill -> (research, prototype) -> to-spec -> to-tickets -> implement -> code-review -> pr -> retro. `[U]` = user-only: propose it, the user types it. Full router: `/ask-matt`.

| Stage | Skill | Trigger |
|---|---|---|
| 1 Start | engram `mem_context` + `mem_search` | first message of every session |
| 1 | setup-matt-pocock-skills [U] | specs, tickets or triage wanted and `docs/agents/issue-tracker.md` is missing |
| 1 | ask-matt [U] | user is unsure which skill fits |
| 2 | grill-with-docs [U] | vague idea inside a repo (leaves GLOSSARY.md + ADRs) |
| 2 | domain-modeling | term clash, overloaded word, GLOSSARY.md or ADR edit |
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
| 7 | dev-journal | at each milestone, pivot or diagnosed problem, and at session end |
| 8 | learn, doc-coauthoring (plugin) | by their own descriptions |
| Always | find-skills, preset-manager, ponytail, caveman | "is there a skill for X", preset switch, every build, every reply |

## Stage rules

3. Plan: keep grill -> to-spec -> to-tickets in one context window. Tracker config is `docs/agents/*.md`; local tickets live in `.scratch/<feature>/issues/`. `/compact` at the nearest boundary near the smart zone; `/clear` between tickets.
4. Build: confirm seams once per feature before the first test (tdd). Parallel independent tickets run in worktrees (implement-spec does this natively). Put a prototype on `prototype/<name>` and fold only the verdict into code.
5. Debug: reach a red one-command loop before any hypothesis; show the ranked hypotheses to the user.
6. Ship: run code-review in a fresh context (Standards and Spec reported separately), then `ponytail-review`, then pr.

## User-only skills (suggest, do not invoke)

Say "propose: /name because <one line>" and wait. User-only: ask-matt, grill-with-docs, grill-me, to-spec, to-tickets, implement, implement-spec, improve-codebase-architecture, setup-matt-pocock-skills, triage, wayfinder, retro, handoff, teach, to-questionnaire, wait-what. Model-invoked: everything else in the table; load those on their trigger.

## Overrides while this preset is active

- Overlaps resolved: to-spec beats sdd-propose/spec/design; to-tickets beats sdd-tasks; implement and implement-spec beat sdd-apply; code-review beats sdd-verify/judgment-day; pr beats branch-pr; retro beats skill-improver. If the user asks for an off skill, say it is off in this preset.
- Commits are conventional with no attribution; /implement commits on the current feature branch only. Push and open a PR only on request. Triage's AI disclaimer line stays in tracker comments because that skill mandates it.

## Session checklist

- [ ] Memory recalled and domain docs read before the first answer.
- [ ] Every proposed user-only skill named with its one-line reason.
- [ ] Spec, tickets and decisions saved in the tracker or `.scratch/`, not only in chat.
- [ ] Tests red before green; diff reviewed in a fresh context before commit.
- [ ] Decisions saved (`mem_save`, dev-journal); `mem_session_summary` written.
- [ ] Every substantive reply ended with the "Cómo seguir:" line.
