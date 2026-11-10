# One CLAUDE.md block per active preset

Each active preset gets its own marked block in the global `CLAUDE.md`, added or removed on its own, instead of one block regenerated from the whole list. Chosen for modularity. Accepted risk: a damaged marker can leave orphan text, so the tool checks that every marker has its pair before editing and refuses to write when one does not.
