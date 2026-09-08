// Promo asset: a poster of EVERY monster and boss in the game, built from the sprite folders and the game's own
// monsterTypes table so it can never drift from what actually ships.
//
// Why it exists: the single most shareable thing this project owns is the sheer number of creatures in it, and there
// was no one image that showed them. The sheet carries the play link and the Patreon link in its footer, so the image
// advertises the game wherever it is reposted without the caption having to.
//
//   node scripts/gen_monster_contact_sheet.mjs            -> writes the HTML to scripts/_tmp_contact_sheet.html
//   node scripts/gen_monster_contact_sheet.mjs --out F    -> writes it to F
// Render it to PNG by opening the file over http and screenshotting at full page height.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? process.argv[i + 1] : path.join(ROOT, 'scripts', '_tmp_contact_sheet.html'); })();
// MOJI_GAME_FILE reads a candidate or a checked-out tip instead of the working copy, which in this repo is routinely
// behind origin/main while a parallel session holds uncommitted edits - the first run of this stamped a version six
// builds old onto the poster.
const GAME = readFileSync(process.env.MOJI_GAME_FILE ? path.resolve(process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const VER = (/const GAME_VERSION = '([^']+)'/.exec(GAME) || [, '?'])[1];

// ---- the roster, straight out of the game's own table
const mtStart = GAME.indexOf('const monsterTypes = {');
if (mtStart < 0) throw new Error('monsterTypes not found');
const mtBody = GAME.slice(mtStart, GAME.indexOf('\n};', mtStart));
const types = [];
for (const m of mtBody.matchAll(/\n  (\w+):\s*\{\s*name:\s*'([^']+)'[^\n]*?(?:\blevel:\s*(\d+))?/g)) {
  types.push({ id: m[1], name: m[2], level: m[3] ? +m[3] : null });
}
// levels live further into each row than the name, so read them per row rather than from one greedy match
for (const t of types) {
  const row = new RegExp('\\n  ' + t.id + ':\\s*\\{[^\\n]*').exec(mtBody);
  if (row) { const lv = /\blevel:\s*(\d+)/.exec(row[0]); t.level = lv ? +lv[1] : null; const bs = /\b(?:boss|isBoss):\s*true/.test(row[0]); t.boss = bs; }
}
// The twelve zodiac bosses are SYNTHESISED at boot from ZODIAC_SIGNS and never appear in the monsterTypes literal, so
// a sheet built from the literal alone silently drops the twelve most impressive creatures in the game. Add them from
// the sign table, which carries their real in-game names and their level ladder (70 upward, two per sign).
const zStart = GAME.indexOf('const ZODIAC_SIGNS = [');
if (zStart > -1) {
  const zBody = GAME.slice(zStart, GAME.indexOf('\n];', zStart));
  let order = 0;
  for (const m of zBody.matchAll(/id:\s*'(\w+)'[^\n]*?name:\s*'([^']+)'/g)) {
    types.push({ id: 'zodiac_' + m[1], name: m[2], level: 70 + order * 2, boss: true });
    order++;
  }
}

// ---- a picture for each, preferring the animated idle frame the game actually draws
const CANDIDATES = (id) => {
  const z = /^zodiac_(\w+)$/.exec(id);
  const out = [];
  if (z) out.push(`Sprites/bosses/zodiac/idle/${z[1]}_0.webp`, `Sprites/bosses/zodiac/${z[1]}.webp`);
  out.push(`Sprites/bosses/idle/${id}_0.webp`, `Sprites/bosses/${id}.webp`,
           `Sprites/monsters/idle/${id}_0.webp`, `Sprites/monsters/${id}.webp`);
  return out;
};
let found = 0; const missing = [];
for (const t of types) {
  t.src = CANDIDATES(t.id).find((p) => existsSync(path.join(ROOT, p))) || null;
  if (t.src) found++; else missing.push(t.id);
}
const shown = types.filter((t) => t.src);
// bosses first, then by level, so the eye lands on the big ones
shown.sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || (b.level || 0) - (a.level || 0) || a.name.localeCompare(b.name));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cells = shown.map((t) => `<figure class="c${t.boss ? ' boss' : ''}">
      <div class="art"><img src="${t.src}" alt="${esc(t.name)}" loading="eager"></div>
      <figcaption>${esc(t.name)}</figcaption>
    </figure>`).join('\n    ');

writeFileSync(OUT, `<!doctype html><html><head><meta charset="utf-8">
<title>Every monster in Mojiworld</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Archivo:wght@400;600&display=swap">
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#16101f;color:#efe7f7;font:14px/1.5 Archivo,system-ui,sans-serif;
       background-image:radial-gradient(1200px 500px at 50% -100px,rgba(255,177,77,.16),transparent 70%)}
  .page{width:2000px;margin:0 auto;padding:54px 46px 40px}
  header{text-align:center;margin-bottom:34px}
  h1{font:700 54px/1.05 Cinzel,Georgia,serif;margin:0;color:#ffd166;letter-spacing:1px;
     text-shadow:0 2px 24px rgba(255,184,77,.35)}
  .sub{margin:11px 0 0;color:#c3b6d8;font-size:17px;letter-spacing:.3px}
  .rule{height:2px;margin:22px auto 0;max-width:620px;
        background:linear-gradient(90deg,transparent,#6b4bb0,#ffb84d,#6b4bb0,transparent)}
  .grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}
  .c{margin:0;background:rgba(255,255,255,.028);border:1px solid #31264a;border-radius:5px;
     padding:8px 5px 6px;display:flex;flex-direction:column;align-items:center;gap:5px}
  .c.boss{border-color:rgba(255,209,102,.55);background:rgba(255,184,77,.075)}
  .art{height:82px;display:flex;align-items:flex-end;justify-content:center;width:100%}
  .art img{max-width:100%;max-height:82px;image-rendering:auto;filter:drop-shadow(0 3px 5px rgba(0,0,0,.5))}
  figcaption{font-size:10px;line-height:1.25;text-align:center;color:#b0a3c8;
             overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-height:24px}
  .c.boss figcaption{color:#ffd166;font-weight:600}
  footer{margin-top:34px;padding-top:20px;border-top:1px solid #31264a;
         display:flex;justify-content:space-between;align-items:baseline;gap:20px;flex-wrap:wrap}
  footer .l{font:700 20px/1 Cinzel,Georgia,serif;color:#ffd166;letter-spacing:.6px}
  footer .r{font-size:15px;color:#c3b6d8;text-align:right;line-height:1.7}
  footer .r b{color:#efe7f7;font-weight:600}
</style></head><body>
<div class="page">
  <header>
    <h1>Every monster in Mojiworld</h1>
    <p class="sub">${shown.length} creatures and bosses &middot; hand-made sprites &middot; ${VER}</p>
    <div class="rule"></div>
  </header>
  <div class="grid">
    ${cells}
  </div>
  <footer>
    <div class="l">MOJIWORLD &mdash; The Everdawn Cycle</div>
    <div class="r">Free in your browser, no install &middot; <b>raw.githack.com/dpeh001-x/Mojiworld/main/mojiworld_game.html</b><br>
      Support the project &middot; <b>patreon.com/c/Mojiworld</b></div>
  </footer>
</div></body></html>`);

console.log(`${shown.length} of ${types.length} types have art -> ${path.relative(ROOT, OUT)}`);
if (missing.length) console.log(`no sprite for ${missing.length}: ${missing.slice(0, 14).join(' ')}${missing.length > 14 ? ' …' : ''}`);
