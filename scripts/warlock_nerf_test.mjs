// The warlock nerf is live: constants, source, and a real raised minion.
// ============================================================================
// v0.30.283. Three layers:
//   1. RUNTIME constants (browser): the grandhex knobs as the engine sees them.
//   2. LIVE summon: raiseMinion() a skeleton and compare its atk against
//      getAtk() — must be the 0.55 ratio (floor), not the old 1.0.
//   3. SOURCE (node): the vortex/ult hazard multipliers and pandemic chain
//      fracs, which live inline in cast handlers.
// Baseline (MOJI_GAME_FILE=<v0.30.282 copy> for 1-2; source check reads the
// same file): all three layers fail.
// Run: node scripts/warlock_nerf_test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

// ---- 3. source layer --------------------------------------------------------
const src = readFileSync(path.join(ROOT, FILE), 'utf8');
ok('Soul Vortex hazard ticks at 1.40x (was 2.20x)', src.includes('atk: getAtk() * 1.40,'), 'inline in the harvest cast');
ok('Necrotic Ascendance drains at 2.0x (was 3.0x)', src.includes('atk: getAtk() * 2.0,'), 'inline in the ult cast');
ok('Pandemic chains 0.35 / 0.25 (was 0.50 / 0.35)',
   src.includes('chain: { n: 4, frac: 0.35 }') && src.includes('chain: { n: 2, frac: 0.25 }'));

// ---- 1 + 2. runtime layers --------------------------------------------------
const PORT = Number(process.env.PORT || 11181);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => typeof raiseMinion === 'function' && typeof getAtk === 'function'
  && typeof LX_GRANDHEX_RUPTURE_MUL !== 'undefined', null, { timeout: 60000 });
await page.waitForTimeout(3000);
const R = await page.evaluate(() => {
  const before = (game.minions || []).length;
  raiseMinion((player.x || 400) + 60, (player.y || 300), 'skeleton', 30000);
  const mn = (game.minions || [])[ (game.minions || []).length - 1 ];
  const atk = mn ? mn.atk : -1;
  if (game.minions && game.minions.length > before) game.minions.pop();
  return {
    rupture: LX_GRANDHEX_RUPTURE_MUL, burst: LX_GRANDHEX_BURST_MUL, splash: LX_GRANDHEX_RUPTURE_SPLASH,
    playerAtk: getAtk(), minionAtk: atk,
  };
});
await browser.close(); server.kill();

const ratio = R.playerAtk > 0 ? R.minionAtk / R.playerAtk : -1;
console.log(`  grandhex: rupture ${R.rupture} burst ${R.burst} splash ${R.splash}`);
console.log(`  summon: minion atk ${R.minionAtk} vs player atk ${R.playerAtk} = ${ratio.toFixed(2)}x`);
ok('Grand Hex knobs: rupture 3.5, burst 1.0, splash 0.40',
   R.rupture === 3.5 && R.burst === 1.0 && R.splash === 0.40,
   `${R.rupture}/${R.burst}/${R.splash} (pre-nerf: 5.5/1.5/0.55)`);
// The floor(atk*0.55) plus the max(14, ...) floor for very low atk: assert the
// ratio band rather than an exact integer (low-level player atk floors bite).
ok('a raised undead hits at ~0.55x player atk (was 1.0x)',
   ratio > 0 && (ratio <= 0.62 || R.minionAtk === 14),
   `${ratio.toFixed(2)}x${R.minionAtk === 14 ? ' (14-floor engaged at low atk)' : ''}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
