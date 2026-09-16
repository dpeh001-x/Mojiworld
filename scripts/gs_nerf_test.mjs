// Ground Slam: every line of damage is 25% lower, measured off a real cast.
// ============================================================================
// Per user: "Reduce ground slam per line of damage by 25%".
//
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. EVERY LINE LANDED: 4 somersault ticks, 1 landing, the ring pulses - so the ratios below are
//      read off a whole cast, not whichever lines happened to reach a foe
//   3. EACH LINE IS x0.75: the multiplier each line actually passed, against 0.55 / 2.7 / 1.2
//   4. THE CAST TOTAL IS x0.75
//   5. CONTROL - performAround itself is untouched: a direct call still deals exactly what it is given
//
// Measured, not read from the source: getAtk is pinned high so performAround's +0..8 noise is under
// 0.1% of a line, rollCrit is pinned off, hitMonster is replaced by a recorder (no side effects), and a
// stand-in foe rides the warrior's centre so the leap cannot carry it out of any radius.
// Run: node scripts/gs_nerf_test.mjs   (MOJI_GAME_FILE=... for a private build)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 13191);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 260) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 747 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(11000);
  const click = async (sel, ms) => {
    const el = await page.$(sel);
    if (!el || !(await el.isVisible().catch(() => false))) return false;
    try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
  };
  await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
  await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
  for (let i = 0; i < 8; i++) {
    const r = await page.evaluate(() => { const o = document.getElementById('class-options'); return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
    if (r) break;
    if (!(await click('#cs-nav-next'))) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => { const o = document.getElementById('class-options'); if (!o) return; const w = [...o.children].find((k) => /warrior/i.test(k.textContent || '')); (w || o.firstElementChild).click(); });
  for (let i = 0; i < 30; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1000);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) break;
  }
  // .fade is what the boot gate waits for: without it the loop spins without ever stepping the sim
  await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });
  await page.waitForTimeout(3000);

  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const t0 = game.time, w0 = performance.now();
    while (game.time - t0 < 30 && performance.now() - w0 < 9000) await sleep(30);
    out.framesRan = game.time - t0;

    const ATK = 100000;
    const realAtk = window.getAtk, realCrit = window.rollCrit, realHit = window.hitMonster;
    const realMonsters = game.monsters, realWild = window._lxIsWildHostile;
    const hits = [];
    const foe = { x: 0, y: 0, w: 30, h: 30, currentHp: 1e12, maxHp: 1e12, vx: 0, vy: 0, type: 'slime' };
    let riding = true;
    const ride = () => { if (!riding) return; foe.x = player.x + player.w / 2 - 15; foe.y = player.y + player.h / 2 - 15; requestAnimationFrame(ride); };
    try {
      // the harness boots into the Void, which counts as a town: updateMonsters' sanctuary sweep removes any
      // wild hostile every frame, and a first version of this test recorded no hits at all because of it
      window._lxIsWildHostile = (m) => (m === foe ? false : realWild(m));
      window.getAtk = () => ATK;
      window.rollCrit = () => false;
      window.hitMonster = function (m, dmg, crit, skill) { if (m === foe) hits.push({ t: Math.round(performance.now()), pct: dmg / ATK }); };
      const enh = player._enh; player._enh = null;
      game.monsters = [foe];
      ride();
      SKILL_FNS.groundSlam();
      const c0 = performance.now();
      while (performance.now() - c0 < 2600) await sleep(40);
      // ---- control: performAround on its own ----
      const before = hits.length;
      performAround(200, 1.0, {});
      out.control = hits.slice(before).map((h) => +h.pct.toFixed(4));
      hits.length = before;
      player._enh = enh;
    } finally {
      riding = false;
      window.getAtk = realAtk; window.rollCrit = realCrit; window.hitMonster = realHit; window._lxIsWildHostile = realWild;
      game.monsters = realMonsters;
    }
    out.lines = hits.map((h) => +h.pct.toFixed(4));
    return out;
  });

  // classify by multiplier: noise is < 8 / 100000, so every line sits within 0.0001 of its value
  const near = (v, x) => Math.abs(v - x) < 0.0005;
  const spin = R.lines.filter((v) => near(v, 0.4125)), land = R.lines.filter((v) => near(v, 2.025)), ring = R.lines.filter((v) => near(v, 0.9));
  const stray = R.lines.filter((v) => !near(v, 0.4125) && !near(v, 2.025) && !near(v, 0.9));
  const total = R.lines.reduce((a, b) => a + b, 0);
  const oldTotal = spin.length * 0.55 + land.length * 2.7 + ring.length * 1.2;
  console.log(`  lines (x ATK, in landing order) ${JSON.stringify(R.lines)} | control ${JSON.stringify(R.control)} | frames ${R.framesRan}`);

  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('EVERY LINE LANDED: 4 somersault ticks, 1 landing, 3+ ring pulses, nothing unaccounted for',
    spin.length === 4 && land.length === 1 && ring.length >= 3 && ring.length <= 4 && stray.length === 0,
    `somersault ${spin.length}, landing ${land.length}, rings ${ring.length}, unrecognised ${JSON.stringify(stray)}`);
  ok('EACH LINE IS x0.75: 0.55 -> 0.4125, 2.7 -> 2.025, 1.2 -> 0.9',
    spin.every((v) => near(v / 0.55, 0.75)) && land.every((v) => near(v / 2.7, 0.75)) && ring.every((v) => near(v / 1.2, 0.75)) && spin.length && land.length && ring.length,
    `somersault ${spin[0]} (x${(spin[0] / 0.55).toFixed(4)}), landing ${land[0]} (x${(land[0] / 2.7).toFixed(4)}), ring ${ring[0]} (x${(ring[0] / 1.2).toFixed(4)})`);
  ok('THE CAST TOTAL IS x0.75',
    oldTotal > 0 && Math.abs(total / oldTotal - 0.75) < 0.001,
    `${total.toFixed(4)} ATK against ${oldTotal.toFixed(4)} for the same lines at the old multipliers (x${(total / oldTotal).toFixed(4)})`);
  ok('CONTROL — performAround itself is untouched: x1.0 in, x1.0 out',
    R.control.length === 1 && near(R.control[0], 1.0),
    `direct performAround(200, 1.0) dealt ${JSON.stringify(R.control)} x ATK`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let nbad = 0;
for (const r of res) { if (!r.pass) nbad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(nbad ? `\n${nbad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(nbad ? 1 : 0);
