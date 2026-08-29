// Every boss out-stats its hunting ground — and spawns obey the table.
// ============================================================================
// v0.30.280 floors, asserted two ways:
//
//   1. TABLE (pure data, no browser): parse data/monster_stats.js, build each
//      boss's band (strongest NORMAL mob within lv-8..lv+2) and assert
//        HP >= 8x   ATK >= 2x   DEF >= 2x
//      for every non-exempt boss. FAILS on the pre-v0.30.280 table (17 rows).
//
//   2. SPAWN (browser): spawn octobaby and zodiac_virgo through the real
//      spawnMonster and assert the instance's maxHp/atk/def EQUAL their table
//      rows — guarding the assumption the whole change rests on: that
//      data/monster_stats.js is what a spawned boss actually carries
//      (_lxApplyStatTable). If that wiring ever detaches, this fails loudly.
//
// Exempt by design: mirrorSelf (mirrors the player — a trial, not a monster),
// towerArbiter/towerSovereign (rescaled to player level +10 at spawn,
// v0.29.316 — their rows are seeds).
// Run: node scripts/boss_floor_test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });

// ---- 1. table floors --------------------------------------------------------
const src = readFileSync(path.join(ROOT, 'data', 'monster_stats.js'), 'utf8');
const rows = [...src.matchAll(/^\s{2}([A-Za-z_0-9]+):\s*{\s*lv:\s*(\d+),\s*hp:\s*(\d+),\s*atk:\s*(\d+),\s*def:\s*(\d+),\s*exp:\s*(\d+),\s*coin:\s*(\d+)/gm)]
  .map((m) => ({ t: m[1], lv: +m[2], hp: +m[3], atk: +m[4], def: +m[5], exp: +m[6], coin: +m[7] }));
const BOSSES = ['king', 'mooma', 'aetherion', 'gravitos', 'octobaby', 'pqConductor', 'legosaurus',
  'young_confused_barnaby', 'kingKrook', 'sundered_smith',
  'zodiac_aries', 'zodiac_taurus', 'zodiac_gemini', 'zodiac_cancer', 'zodiac_leo', 'zodiac_virgo',
  'zodiac_libra', 'zodiac_scorpio', 'zodiac_sagittarius', 'zodiac_capricorn', 'zodiac_aquarius', 'zodiac_pisces'];
const EXEMPT = ['mirrorSelf', 'towerArbiter', 'towerSovereign'];
const bossSet = new Set([...BOSSES, ...EXEMPT]);
const mobs = rows.filter((r) => !bossSet.has(r.t));
const band = (lv) => {
  let pool = mobs.filter((m) => m.lv >= lv - 8 && m.lv <= lv + 2);
  if (!pool.length) {
    const near = mobs.reduce((a, m) => Math.abs(m.lv - lv) < Math.abs(a.lv - lv) ? m : a, mobs[0]);
    pool = mobs.filter((m) => m.lv === near.lv);
  }
  return { hp: Math.max(...pool.map((m) => m.hp)), atk: Math.max(...pool.map((m) => m.atk)), def: Math.max(...pool.map((m) => m.def)) };
};
ok('CONTROL: table parsed (135-ish rows, all named bosses present)',
   rows.length > 120 && BOSSES.every((b) => rows.some((r) => r.t === b)),
   `${rows.length} rows`);
let worst = { r: Infinity, what: '' };
let violations = [];
for (const bt of BOSSES) {
  const b = rows.find((r) => r.t === bt);
  if (!b) continue;
  const B = band(b.lv);
  const rh = b.hp / B.hp, ra = b.atk / B.atk, rd = b.def / B.def;
  for (const [r, need, tag] of [[rh, 8, 'HP'], [ra, 2, 'ATK'], [rd, 2, 'DEF']]) {
    if (r < worst.r) worst = { r, what: `${bt} ${tag} ${r.toFixed(2)}x` };
    if (r < need) violations.push(`${bt} ${tag} ${r.toFixed(2)}x (need ${need}x)`);
  }
}
ok('every boss holds the floors: HP>=8x, ATK>=2x, DEF>=2x its band max',
   violations.length === 0,
   violations.length ? violations.slice(0, 6).join('; ') : `tightest margin: ${worst.what}`);
const grav = rows.find((r) => r.t === 'gravitos');
const zMaxDef = Math.max(...BOSSES.filter((t) => t.startsWith('zodiac_')).map((t) => rows.find((r) => r.t === t).def));
const zMaxHp = Math.max(...BOSSES.filter((t) => t.startsWith('zodiac_')).map((t) => rows.find((r) => r.t === t).hp));
ok('the apex holds: gravitos out-armours and out-bulks every zodiac',
   grav.def > zMaxDef && grav.hp > zMaxHp,
   `gravitos ${grav.hp}hp/${grav.def}def vs zodiac peak ${zMaxHp}hp/${zMaxDef}def`);
const ko = rows.find((r) => r.t === 'kingKrook'), ob = rows.find((r) => r.t === 'octobaby');
ok('the Lv-50 bulk band holds (krook vs octobaby within 1.5x)',
   Math.max(ko.hp, ob.hp) / Math.min(ko.hp, ob.hp) <= 1.5, `${ko.hp} vs ${ob.hp}`);
// exp/coin pacing: every changed boss row still follows the file's own rule.
let payDrift = [];
for (const bt of BOSSES) {
  const b = rows.find((r) => r.t === bt);
  if (Math.abs(b.exp - b.hp * 0.055) / (b.hp * 0.055) > 0.35) payDrift.push(bt + ' exp');
}
ok('boss EXP still tracks the file’s own hp×0.055 rule (±35%)',
   payDrift.length === 0, payDrift.slice(0, 5).join('; ') || 'all within band');

// ---- 2. spawn obeys the table ----------------------------------------------
const PORT = Number(process.env.PORT || 11131);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof game !== 'undefined' && typeof player !== 'undefined', null, { timeout: 60000 });
await page.waitForTimeout(4000);
const S = await page.evaluate(() => {
  const read = (ty) => {
    const m = spawnMonster((player.x || 400) + 240, (player.y || 300), ty, true);
    if (!m || !m.type) return null;
    const r = { maxHp: Math.round(m.maxHp || 0), atk: Math.round(m.atk || 0), def: Math.round(m.def || 0) };
    game.monsters.length = 0;
    return r;
  };
  return { octobaby: read('octobaby'), virgo: read('zodiac_virgo') };
});
await browser.close(); server.kill();
for (const [ty, want] of [['octobaby', rows.find((r) => r.t === 'octobaby')], ['zodiac_virgo', rows.find((r) => r.t === 'zodiac_virgo')]]) {
  const got = S[ty === 'octobaby' ? 'octobaby' : 'virgo'];
  // Spawns carry a small random spread (measured ±5-8% per stat) on top of
  // the table row. ±12% proves the table drives the spawn — the old detached
  // inline numbers would read 3x off, not 1.05x.
  const near = (a, b) => a > b * 0.88 && a < b * 1.12;
  ok(`spawned ${ty} tracks its table row (maxHp/atk/def within ±12%)`,
     got && near(got.maxHp, want.hp) && near(got.atk, want.atk) && near(got.def, want.def),
     got ? `spawned ${got.maxHp}/${got.atk}/${got.def} vs table ${want.hp}/${want.atk}/${want.def}` : 'spawn failed');
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
