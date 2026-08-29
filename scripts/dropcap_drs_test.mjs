// Loot piles are culled, capped and value-preserving; the desktop render
// ladder has a rung below native.
// ============================================================================
// v0.30.278. Three mechanisms, each asserted directly:
//   1. CULL     drawDrops with a 300-coin pile OFF-camera costs a fraction of
//               the same pile on-camera (measured 1.31ms/call on-screen).
//   2. CAP      400 coins converge to <= 240 drops via oldest-coin merges,
//               with the TOTAL VALUE conserved exactly and item/potion drops
//               untouched. Nothing the player earned is lost.
//   3. FLOOR    _lxDrsFloorNow() is 0.75 on desktop, and the declared mobile
//               floor stays 1.0 — the governor may now trade resolution at
//               dpr 1, but only on machines already in veryLowFx.
// Baseline (MOJI_GAME_FILE=<v0.30.277 copy>): 1 and 2 fail outright, 3 fails
// on the missing helper.
// Run: node scripts/dropcap_drs_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11091);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);

// The mechanisms under test live below the boot gate but need no gameplay
// walk: game/drawDrops/_trimVisualQueues/LX_DRS all exist once scripts run.
const R = await page.evaluate(() => {
  const out = {};
  // --- 1. cull cost ---------------------------------------------------------
  const mk = (n, baseX) => { game.drops.length = 0;
    for (let i = 0; i < n; i++) game.drops.push({ type: 'mojicoin', value: 5,
      x: baseX + (i % 40) * 28, y: 200 + Math.floor(i / 40) * 30, vy: 0, life: 999999, noMagnet: true }); };
  const bench = () => { const t0 = performance.now(); for (let k = 0; k < 60; k++) drawDrops(); return (performance.now() - t0) / 60; };
  mk(300, game.camera.x + 100);       out.onMs  = +bench().toFixed(3);
  mk(300, game.camera.x + 6000);      out.offMs = +bench().toFixed(3);
  // --- 2. merge cap ---------------------------------------------------------
  game.drops.length = 0;
  for (let i = 0; i < 400; i++) game.drops.push({ type: 'mojicoin', value: 5, x: i, y: 0, vy: 0, life: 99999 });
  game.drops.push({ type: 'item', item: { rarity: 'epic', icon: 'X' }, x: 0, y: 0, vy: 0, life: 99999 });
  game.drops.push({ type: 'potion_hp', x: 1, y: 0, vy: 0, life: 99999 });
  for (let k = 0; k < 6; k++) { try { _trimVisualQueues(); } catch (e) { out.trimErr = String(e.message).slice(0, 80); break; } }
  out.dropsAfter = game.drops.length;
  out.coinValue = game.drops.filter((d) => d.type === 'mojicoin').reduce((a, d) => a + (d.value || 0), 0);
  out.itemsKept = game.drops.filter((d) => d.type === 'item').length
    + game.drops.filter((d) => d.type === 'potion_hp').length;
  game.drops.length = 0;
  // --- 3. floor -------------------------------------------------------------
  out.floorNow = (typeof _lxDrsFloorNow === 'function') ? _lxDrsFloorNow() : 'absent';
  out.floorMobileDecl = (typeof LX_DRS !== 'undefined') ? LX_DRS.floor : 'absent';
  out.isMobile = (typeof _IS_MOBILE_AT_LOAD !== 'undefined') ? _IS_MOBILE_AT_LOAD : 'absent';
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

console.log(`  drawDrops 300 coins: on-camera ${R.onMs}ms/call, off-camera ${R.offMs}ms/call`);
console.log(`  merge: 400 coins + 2 protected -> ${R.dropsAfter} drops, coin value ${R.coinValue}, protected kept ${R.itemsKept}${R.trimErr ? ', TRIM ERR ' + R.trimErr : ''}`);
console.log(`  floor: _lxDrsFloorNow()=${R.floorNow}  LX_DRS.floor=${R.floorMobileDecl}  mobile=${R.isMobile}`);

ok('CONTROL: an on-camera pile still costs real time (the bench is live)', R.onMs > 0.15,
   `${R.onMs}ms/call — a near-zero here would mean drawDrops is not running at all`);
// 0.1x, not 0.4x: canvas clipping already makes far-off primitives cheaper
// on the UNPATCHED build (measured 0.30x), so a loose threshold cannot tell
// natural clipping from the actual cull (measured 0.003x).
ok('an off-camera pile costs a tenth of an on-camera one', R.offMs < R.onMs * 0.1,
   `${R.offMs} vs ${R.onMs} ms/call (pre-v0.30.278: identical — no cull)`);
ok('coin piles converge under the cap', !R.trimErr && R.dropsAfter <= 242,
   `${R.dropsAfter} drops after trim (pre-fix: stays 402)`);
ok('...with every earned coin preserved', R.coinValue === 400 * 5,
   `total value ${R.coinValue} of 2000 — merging must never destroy currency`);
ok('...and item/potion drops untouched', R.itemsKept === 2);
ok('desktop floor is one rung below native; the declared mobile floor stays 1.0',
   R.floorNow === 0.75 && R.floorMobileDecl === 1.0 && R.isMobile === false,
   `floorNow ${R.floorNow}, mobile decl ${R.floorMobileDecl} (pre-fix: helper absent)`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
