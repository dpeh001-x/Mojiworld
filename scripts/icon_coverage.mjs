// ICON COVERAGE — every skill / boon icon id vs the art actually on disk,
// plus a hunt for art that exists but sits in the wrong folder.
//
// The game already resolves these itself, with an emoji fallback:
//   skills -> Sprites/skills/<id>.png     (drawn by the skill bar + panels)
//   boons  -> Sprites/boons/<id>.png      (boonIconHtml)
// so a correctly-named file in the right folder is picked up with NO code
// change. This report exists to find ids with no art, and stray art that is
// named right but filed wrong.
//
// Run: node scripts/icon_coverage.mjs [--list]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const LIST = process.argv.includes('--list');

// --- precise roster extraction (regex over the whole file over-matches:
// skill-tree nodes, consumables and edicts all use `id:'…', icon:'…'` too) ---
const sliceBlock = (startRe, endTok) => {
  const s = html.search(startRe);
  if (s < 0) return '';
  const e = html.indexOf(endTok, s);
  return e < 0 ? '' : html.slice(s, e);
};
// Strip commented-out lines first: retired entries (e.g. the disabled `tjump`
// boon) are still in the source behind `//` and would otherwise be reported as
// missing art for a boon the game can never offer.
const stripComments = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const POWERUPS_SRC = stripComments(sliceBlock(/const POWERUPS\s*=\s*\[/, '\n];'));
const boonIds = [...POWERUPS_SRC.matchAll(/\{\s*id:'([a-zA-Z_]+)'[^}]*?icon:'([^']+)'[^}]*?name:'([^']*)'|\{\s*id:'([a-zA-Z_]+)',\s*name:'([^']+)',\s*icon:'([^']+)'/g)]
  .map((m) => ({ id: m[1] || m[4], icon: m[2] || m[6], name: m[3] || m[5] }))
  .filter((x) => x.id);

const SKILLS_SRC = sliceBlock(/const SKILLS\s*=\s*\{/, '\n};');
const skillIds = [...SKILLS_SRC.matchAll(/^\s{2}([a-zA-Z_]+):\s*\{\s*name:'([^']*)',\s*icon:'([^']+)'/gm)]
  .map((m) => ({ id: m[1], name: m[2], icon: m[3] }));

const CATS = [
  { key: 'skills', label: 'Skills', dir: 'Sprites/skills', ids: skillIds },
  { key: 'boons', label: 'Boons',  dir: 'Sprites/boons',  ids: boonIds },
];

// index every image in the repo by basename, so misfiled art can be found
const IMG = /\.(png|webp|jpg|jpeg|gif)$/i;
const index = new Map();
(function walk(dir) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const en of ents) {
    const p = path.join(dir, en.name);
    if (en.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p); }
    else if (IMG.test(en.name)) {
      const base = en.name.replace(IMG, '').toLowerCase();
      if (!index.has(base)) index.set(base, []);
      index.get(base).push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  }
})(path.join(ROOT, 'Sprites'));

let need = 0, have = 0;
const strays = [];
console.log('=== ICON ART COVERAGE ===\n');
for (const c of CATS) {
  const dirAbs = path.join(ROOT, c.dir);
  const present = new Set();
  try { for (const f of fs.readdirSync(dirAbs)) if (IMG.test(f)) present.add(f.replace(IMG, '').toLowerCase()); } catch (e) {}
  const missing = c.ids.filter((x) => !present.has(x.id.toLowerCase()));
  need += c.ids.length; have += c.ids.length - missing.length;
  const pct = c.ids.length ? Math.round(((c.ids.length - missing.length) / c.ids.length) * 100) : 100;
  console.log(`${c.label}  —  ${c.dir}`);
  console.log(`  coverage: ${c.ids.length - missing.length}/${c.ids.length}  (${pct}%)`);
  for (const m of missing) {
    // is the art elsewhere in the tree under the right name?
    const found = (index.get(m.id.toLowerCase()) || []).filter((p) => !p.startsWith(c.dir + '/'));
    if (found.length) strays.push({ cat: c.key, id: m.id, dest: `${c.dir}/${m.id}.png`, found });
  }
  if (missing.length) {
    const noArt = missing.filter((m) => !(index.get(m.id.toLowerCase()) || []).some((p) => !p.startsWith(c.dir + '/')));
    if (LIST) for (const m of missing) console.log(`      - ${m.id.padEnd(22)} ${m.icon}  ${m.name}`);
    else console.log(`  missing : ${missing.map((m) => m.id).slice(0, 10).join(', ')}${missing.length > 10 ? ` … +${missing.length - 10}` : ''}`);
    console.log(`  of which genuinely have NO art anywhere: ${noArt.length}`);
  }
  console.log('');
}
console.log(`OVERALL: ${have}/${need} icon ids backed by art (${need ? Math.round((have / need) * 100) : 100}%)`);
if (strays.length) {
  console.log(`\n=== MISFILED ART (${strays.length}) — exists under the right name, wrong folder ===`);
  for (const s of strays) console.log(`  ${s.id}: ${s.found[0]}  ->  ${s.dest}`);
} else {
  console.log('\nNo misfiled art: every id that has art anywhere is already in its correct folder.');
}
process.exit(0);
