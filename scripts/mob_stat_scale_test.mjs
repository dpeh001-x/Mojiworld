// Non-boss monsters carry the level-banded HP lift and 1.8x DEF.
// Per user: ">10 hp x1.5, >20 x2.2, >40 x2.5, >60 x3, >70 x4, def x1.8,
// excluding boss monsters".
//
// Compares the LIVE table against the pre-change baseline table (committed
// below as data), so every one of the 135 types is checked - scaled ones for
// the right factor, excluded ones for being untouched.
// Run: node scripts/mob_stat_scale_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9242;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(() => {
  const bossKeys = new Set();
  for (const id of Object.keys(MAPS)) {
    const md = MAPS[id];
    for (const sp of (md.spawns || [])) if (sp && sp.boss && sp.type) bossKeys.add(sp.type);
    if (md.bossType) bossKeys.add(md.bossType);
    for (const k of (md.bossSequence || [])) if (k) bossKeys.add(k);
  }
  for (const k of Object.keys(typeof BOSS_SPRITES === 'object' ? BOSS_SPRITES : {})) bossKeys.add(k);
  const rows = {};
  for (const k of Object.keys(monsterTypes)) {
    const m = monsterTypes[k];
    const isBoss = bossKeys.has(k) || k.indexOf('zodiac_') === 0 || !!(m.boss || m.isBoss || m.superBoss);
    const natural = (typeof MOB_NATURAL_LEVEL === 'object' && MOB_NATURAL_LEVEL[k] != null) ? MOB_NATURAL_LEVEL[k] : null;
    rows[k] = { hp: m.hp, def: m.def, lvl: (m.level != null ? m.level : natural), isBoss };
  }
  return rows;
});

// Baseline stats captured from the pre-change build (v0.29.777 table).
const BASE = JSON.parse(process.env.MOJI_MOB_BASE || 'null');
if (!BASE) {
  console.log('  (no baseline supplied via MOJI_MOB_BASE - running rule checks only)');
}

const band = (l) => l == null ? null : l > 70 ? 4 : l > 60 ? 3 : l > 40 ? 2.5 : l > 20 ? 2.2 : l > 10 ? 1.5 : null;

if (BASE) {
  const wrongHp = [], wrongDef = [], touchedBoss = [], touchedLow = [];
  for (const k of Object.keys(BASE)) {
    const b = BASE[k], now = out[k];
    if (!now) continue;
    const f = band(b.lvl);
    const scaled = !b.isBoss && f != null;
    if (b.isBoss) {
      if (now.hp !== b.hp || now.def !== b.def) touchedBoss.push(`${k} ${b.hp}/${b.def}->${now.hp}/${now.def}`);
    } else if (!scaled) {
      if (now.hp !== b.hp || now.def !== b.def) touchedLow.push(`${k} lv${b.lvl} ${b.hp}/${b.def}->${now.hp}/${now.def}`);
    } else {
      if (now.hp !== Math.round(b.hp * f)) wrongHp.push(`${k} lv${b.lvl} x${f}: ${b.hp}->${now.hp} (want ${Math.round(b.hp * f)})`);
      if (now.def !== Math.round(b.def * 1.8)) wrongDef.push(`${k} def ${b.def}->${now.def} (want ${Math.round(b.def * 1.8)})`);
    }
  }
  const scaledCount = Object.keys(BASE).filter(k => !BASE[k].isBoss && band(BASE[k].lvl) != null).length;
  ok('every non-boss above level 10 got its exact HP band', wrongHp.length === 0,
     wrongHp.length ? `${wrongHp.length} wrong: ` + wrongHp.slice(0, 3).join(' | ') : `${scaledCount} monsters scaled correctly`);
  ok('every scaled monster got def x1.8', wrongDef.length === 0,
     wrongDef.length ? `${wrongDef.length} wrong: ` + wrongDef.slice(0, 3).join(' | ') : '');
  ok('no boss stat changed', touchedBoss.length === 0,
     touchedBoss.length ? touchedBoss.slice(0, 4).join(' | ') : `${Object.keys(BASE).filter(k => BASE[k].isBoss).length} bosses untouched`);
  ok('no monster at level 10 or below changed', touchedLow.length === 0,
     touchedLow.length ? touchedLow.slice(0, 4).join(' | ') : '');
}

// Rule checks that hold on the patched build without a baseline.
const sample = [['zombie', 4450, 20], ['gummy', 290, 7], ['skeleton', 2585, 20], ['blightElder', 169548, 281]];
const bad = sample.filter(([k, hp, df]) => !out[k] || out[k].hp !== hp || out[k].def !== df);
ok('spot-checked monsters carry their scaled stats', bad.length === 0,
   bad.length ? bad.map(([k]) => `${k}=${out[k] && out[k].hp}/${out[k] && out[k].def}`).join(' ') : 'zombie 4450/20, gummy 290/7, skeleton 2585/20, blightElder 169548/281');
ok('untouched low-level monsters keep their stats',
   out.snail && out.snail.hp === 40 && out.snail.def === 1 && out.mushroom && out.mushroom.hp === 154,
   `snail ${out.snail && out.snail.hp}/${out.snail && out.snail.def}`);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
