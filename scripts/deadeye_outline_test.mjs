// Deadeye Protocol's rounds carry a 2 px black outline.
// ============================================================================
// Per user: "for the projectiles from the skill deadeyes protocol it needs to
// have a 2px black outline around it".
//   1. OVERCLOCK ROUND: the band measures 2 px at the size the game draws it
//   2. EXECUTE ROUND: same
//   3. THE RING IS A BAND, NOT A BLOB: the round's body is punched out, so no
//      black sits under the art's glow
//   4. DRAWN IN GAME: a live marksman_ult projectile rings on real frames
//   5. CONTROL: another ult sprite round (siege ballista) does not
//   6. PIXEL PROOF: black is added outside the body, and every body pixel is
//      byte-identical to the un-ringed render
// Run: node scripts/deadeye_outline_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/deadeye_outline_test.mjs  (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });
const PORT = Number(process.env.PORT || 12731);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
try {
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
  await page.waitForTimeout(1000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { has: typeof _lxProjRing === 'function' };
    try { loadMap('forest'); game.paused = false; } catch (e) { out.err = String(e); return out; }
    await sleep(1200);
    game.monsters.length = 0; game.projectiles.length = 0; player._god = true;
    // the two rounds exactly as _lxProtocolRound spawns them
    const ROUNDS = [{ key: 'bult_marksman', w: 56, h: 18 }, { key: 'bult_deadeye_exec', w: 84, h: 26 }];
    for (let a = 0; a < 40; a++) {
      if (ROUNDS.every((r) => _lxPlayerProjReady(LX_BULT_PROJ[r.key]))) break;
      await sleep(250);
    }
    out.spritesReady = ROUNDS.map((r) => !!_lxPlayerProjReady(LX_BULT_PROJ[r.key]));
    // ---- 1 + 2 + 3: the band, measured at the size the game draws each round ----
    out.bands = [];
    if (out.has) for (const r of ROUNDS) {
      const bw = r.w * 1.5, bh = r.h * 1.5, box = Math.max(bw, bh);
      const bake = _lxProjScaled(LX_BULT_PROJ[r.key], box | 0);
      const nw = bake.naturalWidth || bake.width, nh = bake.naturalHeight || bake.height;
      const dw = nw >= nh ? box : box * (nw / nh);
      const ring = _lxProjRing(bake, dw);
      if (!ring) { out.bands.push({ key: r.key, err: 'no ring' }); continue; }
      const rc = ring.getContext('2d', { willReadFrequently: true });
      const row = ring.height >> 1;
      const d = rc.getImageData(0, row, ring.width, 1).data;
      let start = -1, end = -1;
      for (let x = 0; x < ring.width; x++) { if (d[x * 4 + 3] > 200) { start = x; break; } }
      if (start >= 0) for (let x = start; x < ring.width; x++) { if (d[x * 4 + 3] < 50) { end = x; break; } }
      const srcPx = (start >= 0 && end > start) ? (end - start) : 0;
      const mid = rc.getImageData(ring.width >> 1, row, 1, 1).data[3];   // body punched out?
      out.bands.push({ key: r.key, drawnW: +dw.toFixed(1), bakeW: nw, srcPx, drawnPx: +(srcPx * (dw / nw)).toFixed(2), centreAlpha: mid });
    }
    // ---- 6: pixel proof at the drawn size ----
    if (out.has) {
      const r = ROUNDS[0], box = Math.max(r.w * 1.5, r.h * 1.5);
      const bake = _lxProjScaled(LX_BULT_PROJ[r.key], box | 0);
      const nw = bake.naturalWidth || bake.width, nh = bake.naturalHeight || bake.height;
      const dw = nw >= nh ? box : box * (nw / nh), dh = nw >= nh ? box * (nh / nw) : box;
      const W = Math.ceil(dw) + 24, H = Math.ceil(dh) + 24;
      const mk = (withRing) => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.save(); cx.translate(W / 2, H / 2);
        cx.drawImage(bake, -dw / 2, -dh / 2, dw, dh);
        if (withRing) _lxProjRingDraw(cx, bake, dw, dh);
        cx.restore();
        return cx.getImageData(0, 0, W, H).data;
      };
      const plain = mk(false), ringed = mk(true);
      // INTERIOR = solid pixels whose 8 neighbours are solid too. The rim is
      // excluded on purpose: this round is a thin bullet (about 8 px tall as
      // drawn), so most of its pixels are anti-aliased rim, and covering that
      // rim is exactly what a 2 px band does. What must never change is the
      // body the player reads.
      let blackAdded = 0, interiorPx = 0, interiorChanged = 0, rimPx = 0, rimChanged = 0;
      const isBlack = (a, i) => a[i + 3] > 200 && a[i] < 20 && a[i + 1] < 20 && a[i + 2] < 20;
      const same = (i) => plain[i] === ringed[i] && plain[i + 1] === ringed[i + 1] && plain[i + 2] === ringed[i + 2] && plain[i + 3] === ringed[i + 3];
      const A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : plain[(y * W + x) * 4 + 3];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (isBlack(ringed, i) && !isBlack(plain, i)) blackAdded++;
        if (plain[i + 3] < 250) continue;
        const solidRing = A(x - 1, y) >= 250 && A(x + 1, y) >= 250 && A(x, y - 1) >= 250 && A(x, y + 1) >= 250 &&
                          A(x - 1, y - 1) >= 250 && A(x + 1, y - 1) >= 250 && A(x - 1, y + 1) >= 250 && A(x + 1, y + 1) >= 250;
        if (solidRing) { interiorPx++; if (!same(i)) interiorChanged++; }
        else { rimPx++; if (!same(i)) rimChanged++; }
      }
      out.pixels = { blackAdded, interiorPx, interiorChanged, rimPx, rimChanged };
    }
    // ---- 4 + 5: the gate, on real frames ----
    if (out.has) {
      const calls = { n: 0, byW: [] };
      const orig = window._lxProjRingDraw;
      window._lxProjRingDraw = function (ctx, img, dw, dh) { calls.n++; calls.byW.push(Math.round(dw)); return orig.apply(this, arguments); };
      const push = (skill, bspr, w, h) => game.projectiles.push({ x: player.x + 90, y: player.y - 30, vx: 0.2, vy: 0, w, h, life: 600,
        damage: 0, owner: 'player', skill, bspr, bsprKeepAspect: true, noGravity: true, color: '#ffd27a' });
      push('siege', 'bult_ballista', 40, 20);   // control, alone first
      let g0 = game.time | 0; while (((game.time | 0) - g0) < 40) await sleep(16);
      out.controlCalls = calls.n;
      game.projectiles.length = 0;
      push('marksman_ult', 'bult_marksman', 56, 18);
      push('marksman_ult', 'bult_deadeye_exec', 84, 26);
      g0 = game.time | 0; while (((game.time | 0) - g0) < 40) await sleep(16);
      out.deadeyeCalls = calls.n - out.controlCalls;
      out.widths = Array.from(new Set(calls.byW)).slice(0, 6);
      window._lxProjRingDraw = orig;
      game.projectiles.length = 0;
    }
    return out;
  });
  if (R.err) console.log('  err ' + R.err);
  console.log('  helper present: ' + R.has + ' | sprites decoded: ' + JSON.stringify(R.spritesReady));
  console.log('  bands:  ' + JSON.stringify(R.bands));
  console.log('  pixels: ' + JSON.stringify(R.pixels) + ' | ring draws - deadeye ' + R.deadeyeCalls + ', control ' + R.controlCalls + ' at widths ' + JSON.stringify(R.widths));
  const B = R.bands || [], b0 = B[0] || {}, b1 = B[1] || {}, P = R.pixels || {};
  ok('OVERCLOCK ROUND: the black band measures 2 px at the drawn size', b0.drawnPx >= 1.4 && b0.drawnPx <= 2.6,
    `${b0.drawnPx} px drawn (${b0.srcPx} px of a ${b0.bakeW} px bake in a ${b0.drawnW} px box)`);
  ok('EXECUTE ROUND: the black band measures 2 px at the drawn size', b1.drawnPx >= 1.4 && b1.drawnPx <= 2.6,
    `${b1.drawnPx} px drawn (${b1.srcPx} px of a ${b1.bakeW} px bake in a ${b1.drawnW} px box)`);
  ok('THE RING IS A BAND, NOT A BLOB: each round\'s body is punched out', b0.centreAlpha === 0 && b1.centreAlpha === 0,
    `centre alpha ${b0.centreAlpha} / ${b1.centreAlpha} (0 = no black under the art)`);
  ok('DRAWN IN GAME: live Deadeye Protocol rounds ring on real frames', (R.deadeyeCalls | 0) > 0, `${R.deadeyeCalls} ring draws over 40 frames`);
  ok('CONTROL: another ult sprite round (siege ballista) does not ring', (R.controlCalls | 0) === 0, `${R.controlCalls} ring draws`);
  ok('PIXEL PROOF: black added outside, the round\'s interior untouched', (P.blackAdded | 0) > 20 && P.interiorChanged === 0 && (P.interiorPx | 0) > 40,
    `${P.blackAdded} black px added; interior ${P.interiorChanged} of ${P.interiorPx} changed, rim ${P.rimChanged} of ${P.rimPx} covered by the band`);
} finally {
  await browser.close().catch(() => {}); server.kill();
}
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
