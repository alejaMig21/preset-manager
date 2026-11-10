# Personal definitions live in a git-ignored local folder

Next to `presets/` the tool also reads `presets.local/`, which git never uploads. A file there has the same format as a public one. When its name matches a public preset it adds its skills, plugins and hooks to that preset; when no public preset has that name it is a private preset. `hook define`, `hook adopt` and `create` take `--local` to write there. Chosen over path placeholders and over a second private repository because it is the smallest change that makes a leak impossible: the public repository stays in sync with the live setup only for what is safe to publish, and the commands that would publish a local path warn and point at `--local`.

## Consequences

Local definitions have no git history, so they are only as safe as the folder itself; `delete` backs up both files of a preset before removing them. Fragments stay public-only. The tool never commits or pushes anything.
