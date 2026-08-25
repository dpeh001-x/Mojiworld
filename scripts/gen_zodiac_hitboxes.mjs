#!/usr/bin/env node
// Add the twelve zodiac bosses to data/monster_hitboxes.js.
// =============================================================================
// WHY THEY WERE MISSING. monster_hitboxes.js is described in its own header as
// "AUTO-GENERATED from the live game (monsterTypes w/h + _lxMobScale +
// BOSS_DRAW_SCALE)", with no committed generator - it was extracted by hand
// once. The zodiac types are not in the static monster table at all: they are
// synthesised at boot,
//     monsterTypes['zodiac_' + z.id] = { w: 110 + o * 4, h: 110 + o * 4, ... }
// so a one-off extraction that ran against the source rather than the runtime
// would miss all twelve. That is why the animator has no zodiac entity: without
// a hitbox row it has no m.h, so it cannot compute a game size.
//
// So this reads the RUNTIME, exactly as the header says the table was built:
// boot the game, wait for the type table to exist, and copy out what the draw
// path actually consumes -
//     w, h          monsterTypes['zodiac_<sign>']
//     mul           BOSS_DRAW_SCALE['zodiac_<sign>'] ?? 2.0
//     f             FLOATING_ZODIAC.has(sign)
//     zmul          _ZODIAC_SPRITE_FX[sign].sizeMul  (the per-sign size bump
//                   the boss draw applies as _zSizeMul; 1 for most signs)
//     dy            _ZODIAC_SPRITE_FX[sign].dyPx     (scorpio's +40px push-down)
// Nothing here is typed in by hand, so it cannot drift from the game by
// transcription - re-run it after any zodiac stat change.
//
//   node scripts/gen_zodiac_hitboxes.mjs [--check]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'x.js'));
const { chromium } = require('playwright-core');
const HB_FILE = join(root, 'data', 'monster_hitboxes.js');
const CHECK = process.argv.includes('--check');
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const free = (p) => new Promise((r) => {
  const s = createServer();
  s.once('error', () => r(false));
  s.once('listening', () => s.close(() => r(true)));
  s.listen(p, '127.0.0.1');
});
let PORT = null;
for (let p = 8810; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', cwd: root });
await new Promise((r) => setTimeout(r, 2200));

let rows;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof ZODIAC_SIGNS !== 'undefined' && typeof monsterTypes !== 'undefined'
    && !!monsterTypes['zodiac_aries'], null, { timeout: 120000 });
  rows = await page.evaluate(() => ZODIAC_SIGNS.map((z) => {
    const key = 'zodiac_' + z.id;
    const t = monsterTypes[key];
    const fx = (typeof _ZODIAC_SPRITE_FX !== 'undefined' && _ZODIAC_SPRITE_FX[z.id]) || {};
    const mul = (typeof BOSS_DRAW_SCALE !== 'undefined' && BOSS_DRAW_SCALE[key] != null) ? BOSS_DRAW_SCALE[key] : 2.0;
    const flies = (typeof FLOATING_ZODIAC !== 'undefined') && FLOATING_ZODIAC.has(z.id);
    return { key, w: t.w, h: t.h, mul, f: flies ? 1 : 0, zmul: +fx.sizeMul || 1, dy: +fx.dyPx || 0 };
  }));
} finally {
  await browser.close();
  srv.kill();
}
if (!rows || rows.length !== 12) { console.error('expected 12 signs, got ' + (rows ? rows.length : 0)); process.exit(1); }

const fmt = (r) => {
  let s = `${r.key}:{w:${r.w},h:${r.h},mul:${r.mul}`;
  if (r.f) s += ',f:1';
  if (r.zmul !== 1) s += `,zmul:${r.zmul}`;
  if (r.dy) s += `,dy:${r.dy}`;
  return s + '}';
};
const BEGIN = '// --- zodiac bosses (generated: scripts/gen_zodiac_hitboxes.mjs) ---';
const END = '// --- end zodiac ---';
const block = [BEGIN, ...rows.map((r) => fmt(r) + ','), END].join('\n');

const src = readFileSync(HB_FILE, 'utf8');
const i0 = src.indexOf(BEGIN);
let out;
if (i0 >= 0) {
  const i1 = src.indexOf(END, i0);
  if (i1 < 0) { console.error('zodiac block has a start marker but no end marker'); process.exit(1); }
  out = src.slice(0, i0) + block + src.slice(i1 + END.length);
} else {
  // insert just before the closing brace of the object literal
  const close = src.lastIndexOf('};');
  if (close < 0) { console.error('monster_hitboxes.js did not match the expected shape'); process.exit(1); }
  out = src.slice(0, close) + block + '\n' + src.slice(close);
}

if (CHECK) {
  if (out !== src) { console.error('data/monster_hitboxes.js is STALE — run: node scripts/gen_zodiac_hitboxes.mjs'); process.exit(1); }
  console.log('zodiac hitbox rows are up to date (12 signs)');
  process.exit(0);
}
// node --check refuses a .tmp extension, so validate a .js-named copy first
const probe = join(root, 'scripts', '_tmp_zodiac_hb_check.js');
writeFileSync(probe, out, 'utf8');
execFileSync(process.execPath, ['--check', probe], { stdio: 'inherit' });
writeFileSync(HB_FILE + '.tmp', out, 'utf8');
renameSync(HB_FILE + '.tmp', HB_FILE);
console.log('wrote 12 zodiac rows into data/monster_hitboxes.js');
for (const r of rows) console.log('   ' + fmt(r));
