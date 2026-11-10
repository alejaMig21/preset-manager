// Writing to the config root, always behind a backup, with validation and rollback.
const fs = require('node:fs');
const path = require('node:path');
const { UserError, readJsonFile } = require('./store');

// Files the tool may change besides links; each is backed up before every write.
const BACKED_UP = [
  ['settings.json', 'settings'],
  ['CLAUDE.md', 'claudeMd'],
  ['active.json', 'activeFile'],
];

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

const isLink = (file) => {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch {
    return false;
  }
};

// Removes only the link itself: rmdir on a junction never touches its target, and fails on a real folder.
function removeLink(p, name) {
  const link = path.join(p.skills, name);
  if (isLink(link)) fs.rmdirSync(link);
}

function createLink(p, name, target) {
  fs.symlinkSync(target, path.join(p.skills, name), 'junction');
}

function linkTarget(link) {
  try {
    return fs.realpathSync(link);
  } catch {
    return fs.readlinkSync(link);
  }
}

function makeBackup(p, actions) {
  let dir;
  try {
    fs.mkdirSync(p.backups, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    dir = path.join(p.backups, stamp);
    for (let i = 1; fs.existsSync(dir); i++) dir = path.join(p.backups, `${stamp}-${i}`);
    fs.mkdirSync(dir);
    const manifest = { files: {}, created: [], removed: [] };
    for (const [name, key] of BACKED_UP) {
      manifest.files[name] = fs.existsSync(p[key]);
      if (manifest.files[name]) fs.copyFileSync(p[key], path.join(dir, name));
    }
    for (const a of actions) {
      if (a.kind === 'link') manifest.created.push(a.name);
      if (a.kind === 'unlink') manifest.removed.push({ name: a.name, target: linkTarget(path.join(p.skills, a.name)) });
    }
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  } catch (e) {
    throw new UserError(`cannot make a backup, nothing was written: ${e.message}`);
  }
  return dir;
}

function restore(p, dir) {
  const manifest = readJsonFile(path.join(dir, 'manifest.json'));
  for (const name of manifest.created) removeLink(p, name);
  for (const { name, target } of manifest.removed) {
    removeLink(p, name);
    createLink(p, name, target);
  }
  for (const [name, key] of BACKED_UP) {
    if (manifest.files[name]) writeAtomic(p[key], fs.readFileSync(path.join(dir, name)));
    else fs.rmSync(p[key], { force: true });
  }
}

function applyChange(p, { actions, nextEntries, settings }) {
  const backup = makeBackup(p, actions);
  try {
    for (const a of actions) {
      if (a.kind === 'unlink') removeLink(p, a.name);
      if (a.kind === 'link') createLink(p, a.name, a.target);
    }
    const switches = actions.filter((a) => a.kind === 'on' || a.kind === 'off');
    if (switches.length) {
      const overrides = { ...(settings.skillOverrides || {}) };
      for (const a of switches) {
        if (a.kind === 'on') delete overrides[a.name];
        else overrides[a.name] = 'off';
      }
      writeAtomic(p.settings, `${JSON.stringify({ ...settings, skillOverrides: overrides }, null, 2)}\n`);
    }
    writeAtomic(p.activeFile, `${JSON.stringify({ active: nextEntries }, null, 2)}\n`);
    // Test seam for the safety net: simulate a write that leaves settings.json broken.
    if (process.env.PRESET_MANAGER_FAULT === 'corrupt-settings') fs.writeFileSync(p.settings, '{ corrupt');
    if (fs.existsSync(p.settings)) readJsonFile(p.settings);
  } catch (e) {
    restore(p, backup);
    throw new UserError(`apply failed and was rolled back: ${e.message}`);
  }
}

function lastBackup(p) {
  const names = fs.existsSync(p.backups)
    ? fs.readdirSync(p.backups).filter((n) => !n.endsWith('.rolled-back')).sort()
    : [];
  if (!names.length) throw new UserError('no backup found, nothing to roll back');
  return path.join(p.backups, names[names.length - 1]);
}

function rollback(p, yes) {
  const dir = lastBackup(p);
  const manifest = readJsonFile(path.join(dir, 'manifest.json'));
  const lines = [
    `Backup ${path.basename(dir)}:`,
    `  restores ${Object.keys(manifest.files).filter((n) => manifest.files[n]).join(', ') || '(no files)'}`,
    `  removes links: ${manifest.created.join(', ') || '(none)'}`,
    `  recreates links: ${manifest.removed.map((r) => r.name).join(', ') || '(none)'}`,
  ];
  if (!yes) return [`Rollback plan (dry run, nothing written):`, ...lines, 'Re-run with --yes to apply.'].join('\n');
  restore(p, dir);
  fs.renameSync(dir, `${dir}.rolled-back`);
  return ['Rolled back.', ...lines].join('\n');
}

module.exports = { applyChange, rollback };
