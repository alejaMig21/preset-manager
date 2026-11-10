// Preset blocks in the global CLAUDE.md: parsing with pair validation, diffing, and rewriting.
// Lines are handled with their own line endings so text outside the blocks stays byte-identical.
const { UserError } = require('./store');

const OPEN = /^<!-- preset:([A-Za-z0-9][\w.-]*) -->$/;
const CLOSE = /^<!-- \/preset:([A-Za-z0-9][\w.-]*) -->$/;
const ANY_MARKER = /<!--\s*\/?preset:/;

const splitLines = (text) => (text.length ? text.split(/(?<=\n)/) : []);
const bare = (line) => line.replace(/\r?\n$/, '');
const importLine = (name) => `@preset-manager/fragments/${name}.md`;
const blockLines = (name, eol) =>
  [`<!-- preset:${name} -->`, importLine(name), `<!-- /preset:${name} -->`].map((l) => l + eol);

// Returns { ls, blocks: [{ name, start, end, body }] } or throws naming the damaged marker.
function parse(text, file) {
  const ls = splitLines(text);
  const blocks = [];
  let open = null;
  const damaged = (i, what) => new UserError(`${file}: damaged marker on line ${i + 1}: ${what}`);
  ls.forEach((raw, i) => {
    const line = bare(raw);
    const o = OPEN.exec(line);
    const c = CLOSE.exec(line);
    if (o) {
      if (open) throw damaged(open.start, `<!-- preset:${open.name} --> has no closing marker`);
      if (blocks.some((b) => b.name === o[1])) throw damaged(i, `preset:${o[1]} appears twice`);
      open = { name: o[1], start: i };
    } else if (c) {
      if (!open || open.name !== c[1]) throw damaged(i, `closing marker preset:${c[1]} has no matching opening marker`);
      blocks.push({ name: open.name, start: open.start, end: i, body: ls.slice(open.start + 1, i).map(bare) });
      open = null;
    } else if (ANY_MARKER.test(line)) {
      throw damaged(i, `unrecognised preset marker "${line.trim()}"`);
    }
  });
  if (open) throw damaged(open.start, `<!-- preset:${open.name} --> has no closing marker`);
  return { ls, blocks };
}

const isCanonical = (b) => b.body.length === 1 && b.body[0] === importLine(b.name);

// What would change: blocks to add (or rewrite in place) and blocks to remove. `desired` keeps its order.
function diff(text, desired, file) {
  const { blocks } = parse(text, file);
  const existing = new Map(blocks.map((b) => [b.name, b]));
  return {
    add: desired.filter((n) => !existing.has(n) || !isCanonical(existing.get(n))),
    remove: blocks.filter((b) => !desired.includes(b.name)).map((b) => b.name),
  };
}

function update(text, desired, file) {
  const { ls, blocks } = parse(text, file);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const byStart = new Map(blocks.map((b) => [b.start, b]));
  const out = [];
  for (let i = 0; i < ls.length; i++) {
    const b = byStart.get(i);
    if (!b) {
      out.push(ls[i]);
      continue;
    }
    if (desired.includes(b.name)) {
      out.push(...(isCanonical(b) ? ls.slice(b.start, b.end + 1) : blockLines(b.name, eol)));
    }
    i = b.end;
  }
  const have = new Set(blocks.filter((b) => desired.includes(b.name)).map((b) => b.name));
  for (const name of desired.filter((n) => !have.has(n))) {
    if (out.length && !/\n$/.test(out[out.length - 1])) out[out.length - 1] += eol;
    out.push(...blockLines(name, eol));
  }
  return out.join('');
}

module.exports = { diff, update };
