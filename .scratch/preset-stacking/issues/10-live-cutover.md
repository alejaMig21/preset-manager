# 10: Replace the live setup

**What to build:** The new tool takes over the person's real `~/.claude`. A dry run against the real folder shows every change; the person approves the exact files; then the one-time conversion, the new `preset-manager` skill and the hook are applied for real and the result is verified. Until this ticket is done the old system keeps working. This ticket is done with the person present, never by an agent alone, because it writes outside the repository.

**Blocked by:** 07, 08, 09

**Status:** ready-for-human

- [ ] The dry run against the real folder was shown and the exact files were approved before any write
- [ ] A backup of the real `settings.json`, `CLAUDE.md` and presets exists and was verified restorable
- [ ] After the conversion `status` shows the expected active presets and no broken junctions
- [ ] The person's current working skills are still visible in a new session
- [ ] The live `preset-manager` skill is replaced by the new thin one
- [ ] The hook is installed and fires on a test `skills add`
- [ ] Rollback was exercised once and works
