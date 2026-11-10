# Presets are additive; the off-list is computed

Each preset lists only the skills it turns on. The tool computes what to turn off: managed skills (named in some preset) that no active preset asks for. Skills no preset names are never touched. This replaces the old model where every preset stored a long `skills_off` list and silently included the base. Chosen so presets can stack without overriding each other, and so a skill installed by hand is not switched off by surprise.
