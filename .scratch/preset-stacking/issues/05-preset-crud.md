# 05: Create, update and delete presets

**What to build:** The person (through the agent) can create a preset with a name and a list of skills, update it by adding or removing skills, and delete it. Definitions are written into this repo's preset definitions. All three are dry run unless confirmed, like every write. Deleting an active preset deactivates it first, applying the normal remove path, and tells the person. A skill named in a preset must exist in some skill group or as an external source; otherwise the command refuses and names it.

**Blocked by:** 03

**Status:** resolved

- [x] `create` with a name and skills writes a valid definition after confirmation, nothing before
- [x] Creating a name that already exists is refused
- [x] `update` adds and removes skills and the result shows in `status`
- [x] `delete` of an inactive preset removes its definition
- [x] `delete` of an active preset deactivates it first and reports that it did
- [x] A skill that cannot be found is refused with its name in the message
- [x] The managed-skill set follows the definitions after each change
