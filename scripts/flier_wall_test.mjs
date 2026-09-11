// Fliers no longer pin themselves against the map edge (B1 Spirelings).
// ============================================================================
// Per user: "monsters are stuck at the side after attacking (B1 expedition)".
// tower_b1 (30 Spirelings, 1200 px) is reloaded fresh for each player
// position, so no destination carries over between runs. The player is in god
// mode and held still; every 50 ms each flier is sampled.
//
//   1. RIGHT WALL: player at x 1080 - under 5% of flier samples pressed
//      against a wall and no pinning over 2 s (baseline: 27%, 22 pinnings)
//   2. LEFT WALL: player at x 100 - the same (baseline: 19%, 15 pinnings)
//   3. DESTINATIONS: no sampled flier destination lies outside the map
//      (baseline: 3,922 samples outside)
//   4. CONTROL: at both walls the CHASING fliers (aggro mode) still orbit the
//      player - median horizontal distance under 350 px - and the Spireling
//      dash still fires. Idle fliers are excluded: on this floor many never
//      come within the 350 px aggro range, and a median over all 30 measured
//      the map, not the chase.
//   5. CONTROL: with the player at the centre fliers are not at the walls
// Run: node scripts/flier_wall_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/flier_wall_test.mjs   (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const SECS = Number(process.env.SECS || 12);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });

const PORT = Number(process.env.PORT || 12021);
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
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });
await page.waitForTimeout(1200);

const R = await page.evaluate(async (SECS) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { scen: {} };
  for (const [key, px] of [['right', 1080], ['left', 100], ['centre', 600]]) {
    try { loadMap('tower_b1'); game.paused = false; player._god = true; } catch (e) { out.err = String(e); return out; }
    await sleep(1500);
    const ww = game.mapData.worldWidth;
    const floorY = (game.mapData.platforms || []).filter((p) => p.type === 'ground').reduce((a, p) => Math.max(a, p.y), 0);
    const fl = () => game.monsters.filter((m) => m && m.flies && m.currentHp > 0);
    const streak = new Map(), prevDc = new Map();
    let samples = 0, atWall = 0, pinnings = 0, outside = 0, dashes = 0; const aggroDists = []; const outEx = [];
    const chasing = new Set();
    const t0 = performance.now();
    while (performance.now() - t0 < SECS * 1000) {
      player.x = px - player.w / 2; player.y = floorY - player.h; player.vx = 0; player.vy = 0; player.hp = getMaxHp();
      game.paused = false;
      await sleep(50);
      const now = performance.now();
      for (const m of fl()) {
        samples++;
        const dc = m._dashCharging || 0;
        if (dc > (prevDc.get(m) || 0) + 1) dashes++;
        prevDc.set(m, dc);
        if (m._flyMode === 'a') { chasing.add(m); aggroDists.push(Math.abs((m.x + m.w / 2) - px)); }
        if (m._flyDestX != null && (m._flyDestX < 0 || m._flyDestX > ww)) { outside++; if (outEx.length < 4) outEx.push(Math.round(m._flyDestX)); }
        const wall = m.x <= 2 ? 'L' : (m.x + m.w >= ww - 2 ? 'R' : null);
        if (wall) {
          atWall++;
          const st = streak.get(m) || { since: now, side: wall, counted: false };
          if (st.side !== wall) { st.since = now; st.side = wall; st.counted = false; }
          streak.set(m, st);
          if (!st.counted && now - st.since > 2000) { st.counted = true; pinnings++; }
        } else streak.delete(m);
      }
    }
    aggroDists.sort((a, b) => a - b);
    out.scen[key] = { px, fliers: fl().length, chasing: chasing.size, samples, wallPct: +(100 * atWall / Math.max(1, samples)).toFixed(1), pinnings, outside, outEx, dashes,
                      medChaseDist: aggroDists.length ? Math.round(aggroDists[Math.floor(aggroDists.length / 2)]) : null,
                      endAtWall: fl().filter((m) => m.x <= 2 || m.x + m.w >= ww - 2).length };
  }
  return out;
}, SECS);
await browser.close(); server.kill();

if (R.err) console.log('  err ' + R.err);
for (const k of ['right', 'left', 'centre']) console.log(`  ${k.padEnd(6)} ${JSON.stringify(R.scen[k])}`);
const S = R.scen;
ok('RIGHT WALL: under 5% of flier samples at a wall, no pinning over 2 s', S.right && S.right.wallPct < 5 && S.right.pinnings === 0, `player x 1080: ${S.right && S.right.wallPct}% at a wall, ${S.right && S.right.pinnings} pinnings > 2 s, ${S.right && S.right.endAtWall} at a wall at the end (baseline: 27%, 22, 11)`);
ok('LEFT WALL: under 5% of flier samples at a wall, no pinning over 2 s', S.left && S.left.wallPct < 5 && S.left.pinnings === 0, `player x 100: ${S.left && S.left.wallPct}% at a wall, ${S.left && S.left.pinnings} pinnings > 2 s, ${S.left && S.left.endAtWall} at a wall at the end (baseline: 19%, 15, 8)`);
const outAll = ['right', 'left', 'centre'].reduce((a, k) => a + ((S[k] && S[k].outside) || 0), 0);
ok('DESTINATIONS: no sampled flier destination lies outside the map', outAll === 0, `${outAll} samples outside (baseline: 3,922), e.g. ${['right', 'left'].map((k) => (S[k] && S[k].outEx || []).join(' ')).join(' / ')}`);
ok('CONTROL: at both walls the chasing fliers still orbit the player (median < 350 px) and the dash still fires',
   S.right && S.left && S.right.medChaseDist != null && S.left.medChaseDist != null && S.right.medChaseDist < 350 && S.left.medChaseDist < 350 && (S.right.dashes + S.left.dashes) > 0,
   `chasing fliers right ${S.right && S.right.chasing} at median ${S.right && S.right.medChaseDist} px, left ${S.left && S.left.chasing} at ${S.left && S.left.medChaseDist} px; dashes ${(S.right && S.right.dashes) + (S.left && S.left.dashes)}`);
ok('CONTROL: player at the centre - fliers are not at the walls', S.centre && S.centre.wallPct < 5, `player x 600: ${S.centre && S.centre.wallPct}% at a wall`);
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
