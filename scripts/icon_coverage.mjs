// ICON COVERAGE — every emoji-bearing icon field in the game vs the art that
// actually exists on disk. System emoji render differently on Windows vs
// SteamOS/Deck (and can fall back to tofu where Noto Color Emoji is absent),
// so anything player-facing wants real art. This report makes the remaining
// work concrete: run it, generate the listed art, re-run until 100%.
//
// The game already has FOUR art-backed icon helpers, each with an emoji
// fallback, so dropping a correctly-named file into the right folder is all
// that is needed — no code change per icon:
//   itemIconHtml   -> Sprites/items/<id>.png
//   boonIconHtml   -> Sprites/boons/<id>.png
//   _crestImgHTML  -> Sprites/ui/Class/<id>.png
//   _lxIconHtml    -> explicit src
// Run: node scripts/icon_coverage.mjs [--list]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const html = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const LIST = process.argv.includes('--list');

const dirSet = (rel) => {
  try { return new Set(fs.readdirSync(path.join(ROOT, rel)).map((f) => f.replace(/\.\w+$/, '').toLowerCase())); }
  catch (e) { return new Set(); }
};

// --- category definitions: how to find the ids, and where their art lives ---
const CATS = [
  { key: 'boons', label: 'Boons (POWERUPS)', dir: 'Sprites/boons',
    re: /\{\s*id:'([a-zA-Z_]+)',\s*name:'([^']+)',\s*icon:'([^']+)'/g },
  { key: 'skills', label: 'Skills (SKILLS)', dir: 'Sprites/ui/skills',
    re: /^\s{2}([a-zA-Z_]+):\s*\{\s*name:'([^']*)',\s*icon:'([^']+)'/gm },
  // Classes/jobs only — they are the entries that carry a `stats:` block.
  // A looser `name:…icon:` match pulled in SKILLS entries and double-counted
  // them as missing class art.
  { key: 'classes', label: 'Classes / jobs', dir: 'Sprites/ui/Class',
    re: /^\s{2}([a-z]+):\s*\{\s*name:'([^']+)',\s*icon:'([^']+)',[^}]*?stats:\s*\{/gm },
];

let totalNeed = 0, totalHave = 0;
const gaps = {};
console.log('=== ICON ART COVERAGE ===\n');
for (const c of CATS) {
  const have = dirSet(c.dir);
  const seen = new Map();
  for (const m of html.matchAll(c.re)) {
    const [, id, name, icon] = m;
    if (!seen.has(id)) seen.set(id, { name, icon });
  }
  const ids = [...seen.keys()];
  const missing = ids.filter((id) => !have.has(id.toLowerCase()));
  totalNeed += ids.length; totalHave += (ids.length - missing.length);
  gaps[c.key] = missing.map((id) => ({ id, ...seen.get(id) }));
  const pct = ids.length ? Math.round(((ids.length - missing.length) / ids.length) * 100) : 100;
  console.log(`${c.label}`);
  console.log(`  art dir : ${c.dir}${fs.existsSync(path.join(ROOT, c.dir)) ? '' : '   (does not exist yet)'}`);
  console.log(`  coverage: ${ids.length - missing.length}/${ids.length}  (${pct}%)`);
  if (missing.length && LIST) {
    for (const g of gaps[c.key]) console.log(`      - ${g.id.padEnd(22)} ${g.icon}  ${g.name}`);
  } else if (missing.length) {
    console.log(`  missing : ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ` … +${missing.length - 12}` : ''}`);
  }
  console.log('');
}
const pctAll = totalNeed ? Math.round((totalHave / totalNeed) * 100) : 100;
console.log(`OVERALL: ${totalHave}/${totalNeed} icon fields backed by art (${pctAll}%)`);
console.log(`Re-run with --list to print every missing id (that list is the art brief).`);
// Exit non-zero only when a category regresses to zero art, so CI can catch a
// deleted art folder without failing on the known in-progress backlog.
const broken = CATS.filter((c) => dirSet(c.dir).size === 0 && c.key === 'boons');
process.exit(broken.length ? 1 : 0);
