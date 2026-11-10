# Always-on rules

Apply with any combination of presets.

## Session end

End: save decisions and gotchas with `mem_save`, write a dev-journal entry at each milestone or pivot, finish with `mem_session_summary`. Propose retro and handoff; never run them unasked.

## Next step

Next step: end every substantive reply with one line "Cómo seguir:" naming the recommended next move for the current stage, using what the active presets offer: either a user-only skill the user types (`/wayfinder`, `/to-spec`, `/to-tickets`, `/implement`, `/handoff`, `/retro`...) with its one-line reason, or plain words the user can say ("adelante con X"). When a wayfinder map is open, name the frontier tickets and which of them need the user (conversation) and which the assistant can take alone. Say explicitly when nothing is needed from the user. Keep it to one or two lines, in the user's language, with no new jargon.

## Overrides

- Delegation triggers, worktree parallelism, fresh-context review, engram protocol, Strict TDD, ponytail and caveman apply unchanged. Keep passing a `model` alias (sonnet default) on Agent calls and hand sub-agents the skill paths `~/.claude/skills/<group>/<skill>/SKILL.md`.
- Replies follow the persona language; every artifact (GLOSSARY.md, specs, tickets, ADRs, PR bodies, comments) is English. The repo `GLOSSARY.md` holds domain terms; the reply "Glosario" explains terms to the user.
- The project CLAUDE.md wins on test runner, branch policy and roadmap location.

