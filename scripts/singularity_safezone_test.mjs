// The Singularity's safe zone protects the column above it — and says when it lands.
// ============================================================================
// Per user: "the gravity collapse attack by sovereign and gravitos is not
// working properly, i get hit even if i am in the safe zone even before the
// animation ends".
//
// The zone rect is a 70 px floor band and the resolve fires at life 0, so a
// player who is over the light but airborne (or nudged out on the last
// frame) dies "in the safe zone", and nothing in the telegraph marks the
// instant it lands. Every case below pushes a real gravitos_singularity hazard
// with one ground zone and forces the resolve by stepping life 1 -> 0.
//
// A phase-1 Gravitos stands far away for the survivable cases so a hit is the
// -99% branch (hp drops to ~1%) and the run can continue; the strict case
// flips it to phase 3, where a hit is death, and runs last.
//
//   1. CONTROL: standing in the zone survives (both builds)
//   2. airborne 110 px above the zone, inside its width -> survives
//      (baseline: box leaves the 70 px rect -> hit)
//   3. grace: in the zone until 5 frames before the resolve, then knocked
//      200 px away -> survives (baseline: hit)
//   4. CONTROL: 300 px from any zone the whole time -> hit (both builds:
//      the check still kills)
//   5. CONTROL: standing 220 px above the zone (a platform over it) -> hit
//      (both builds: the slack is bounded, a platform zone and a ground zone
//      stay distinct)
//   6. STRICT (phase 3): airborne 100 px above the zone, centre inside its
//      width -> survives (baseline: centre outside the rect -> death)
//   7. the telegraph counts down: with 120 frames left the draw path paints
//      the digit "2" on the live canvas (baseline: no countdown)
// Run: node scripts/singularity_safezone_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/singularity_safezone_test.mjs  (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });

const PORT = Number(process.env.PORT || 11531);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const r = await page.evaluate(() => { const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
  if (r) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) break;
}
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.classList.add('fade'); });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  try { loadMap('forest'); game.paused = false; player._god = true; } catch (e) {}
  await sleep(1200);
  game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;
  const floor = player.y + player.h;             // the ground line the player stands on
  const zx = player.x - 30;                      // zone centred on the player
  const zone = () => ({ x: zx, y: floor - 70, w: 100, h: 70 });
  const gv = spawnMonster(player.x + 900, player.y, 'gravitos', true);
  await sleep(3600); game.paused = false;
  if (gv) { gv.phase = 1; gv.speed = 0; }

  // Run one case: place the player via `place` (called every frame), resolve, report the hp fraction.
  const run = async (label, place, opts) => {
    game.hazards = game.hazards.filter((h) => h.type !== 'gravitos_singularity');
    const h = { type: 'gravitos_singularity', x: 0, y: 0, w: 4000, h: 2000, cx: player.x + 400, cy: floor - 200,
                life: 40, maxLife: 210, atk: 99999, safeZones: [zone()] };
    game.hazards.push(h);
    player._god = true; player.hp = getMaxHp(); player.invulnerable = 0; player._ohkoParry = 0;
    let f = 0;
    while (h.life > 1 && f < 200) {                // walk the telegraph down, holding the pose each frame
      place(h.life); if (gv) { gv.x = player.x + 900; gv.y = player.y; }
      game.paused = false; await sleep(16); f++;
    }
    place(1);
    player._god = false;                           // only the resolve frame can hurt
    const hp0 = player.hp;
    h.life = 1;                                    // next tick: 0 -> resolve
    game.paused = false; await sleep(40);
    const frac = player.hp / hp0;
    player._god = true;
    return { label, hit: frac < 0.5, hpFrac: +frac.toFixed(3), resolved: !game.hazards.includes(h) };
  };
  const ground = () => { player.y = floor - player.h; player.vy = 0; player.x = zx + 35; player.vx = 0; };
  out.standing = await run('standing in zone', ground);
  out.airborne = await run('airborne 110px over zone', () => { player.x = zx + 35; player.vx = 0; player.y = floor - player.h - 110; player.vy = -2; });
  out.grace = await run('knocked out 5 frames before', (life) => { if (life > 6) ground(); else { player.x = zx + 235; player.vx = 0; player.y = floor - player.h; } });
  out.far = await run('300px away', () => { player.x = zx + 300; player.vx = 0; player.y = floor - player.h; player.vy = 0; });
  out.platform = await run('220px above (platform over it)', () => { player.x = zx + 35; player.vx = 0; player.y = floor - player.h - 220; player.vy = 0; });
  // strict: phase 3 -> the kill branch; last, since it may trigger the death flow
  if (gv) gv.phase = 3;
  out.strict = await run('STRICT airborne 100px over zone', () => { player.x = zx + 35; player.vx = 0; player.y = floor - player.h - 100; player.vy = -1; });
  // Gravitos's AI may reassert its phase from HP thresholds each tick, so the
  // strict branch is REQUESTED here, not guaranteed: record what was observed
  // at the resolve so the row's label stays honest either way.
  out.strictPhase = gv ? (gv.phase | 0) : null;
  // 7. countdown digit on the live canvas at 120 frames left
  game.hazards = game.hazards.filter((h) => h.type !== 'gravitos_singularity');
  const h2 = { type: 'gravitos_singularity', x: 0, y: 0, w: 4000, h: 2000, cx: player.x + 400, cy: floor - 200,
               life: 120, maxLife: 210, atk: 99999, safeZones: [zone()] };
  game.hazards.push(h2);
  const P = CanvasRenderingContext2D.prototype; const oText = P.fillText; const digits = [];
  P.fillText = function (...a) { if (this === ctx && /^[0-9]$/.test(String(a[0]))) digits.push(String(a[0])); return oText.apply(this, a); };
  try { drawHazards(); } catch (e) { out.drawErr = String(e.message).slice(0, 80); }
  P.fillText = oText;
  out.countdown = digits;
  game.hazards.length = 0; game.monsters.length = 0;
  player.hp = getMaxHp(); player._god = true;
  return out;
});
await browser.close(); server.kill();

const c = R;
for (const k of ['standing', 'airborne', 'grace', 'far', 'platform', 'strict']) console.log(`  ${k.padEnd(9)} ${c[k].label.padEnd(34)} hit=${c[k].hit}  hp ${c[k].hpFrac}  resolved=${c[k].resolved}`);
console.log(`  countdown digits at 120 frames left: ${JSON.stringify(c.countdown)}${c.drawErr ? '  drawErr ' + c.drawErr : ''}`);
ok('CONTROL: standing in the zone survives', c.standing.resolved && !c.standing.hit);
ok('airborne over the zone survives (a jump inside the light is still inside)', c.airborne.resolved && !c.airborne.hit,
   `hp ${c.airborne.hpFrac} (baseline: the box leaves the 70px rect -> hit)`);
ok('knocked out of the zone 5 frames before the resolve still counts (8-frame grace)', c.grace.resolved && !c.grace.hit,
   `hp ${c.grace.hpFrac} (baseline: hit)`);
ok('CONTROL: 300px from any zone is hit (the check still kills)', c.far.resolved && c.far.hit, `hp ${c.far.hpFrac}`);
ok('CONTROL: 220px above the zone is NOT covered (slack is bounded; platform vs ground zones stay distinct)', c.platform.resolved && c.platform.hit, `hp ${c.platform.hpFrac}`);
ok('airborne 100px over the zone with centre inside its width survives (phase 3 requested)', c.strict.resolved && !c.strict.hit,
   `hp ${c.strict.hpFrac}, Gravitos phase observed at resolve: ${c.strictPhase} (strict branch engaged only if 3; baseline: hit either way)`);
ok('the telegraph paints a countdown digit in its last seconds', Array.isArray(c.countdown) && c.countdown.includes('2'),
   JSON.stringify(c.countdown) + (c.drawErr ? ' ' + c.drawErr : '') + ' (baseline: none)');

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
