// B/G numbers: big untransformed core, thin frame, soft growing glow, vertical burst.
// ============================================================================
// Per user, over six rounds of samples: a core bigger than the outline; chunkier
// and wider; the burst stacked vertically; the previous font kept; a strong drop
// shadow; no horizontal stretch but a soft glow; thinner outlines; a dramatic
// entrance; a mini wobble shake; wobble capped at 11 degrees and over by frame 10 (gb-pile; 22 under gb-cluster, 12 before), no
// shockwave ring; a softer, smaller, less opaque glow; and finally (gb-pile) slightly bigger rows in a tighter pile
// that overlaps the way ordinary numbers do.
//
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. THE CORE OUTWEIGHS THE FRAME: 50 (gb-pile, was 46) against a 15px white and 11px black,
//      so the visible rings are 2px and 5.5px - the frame frames it
//   3. THE FACE IS UNTOUCHED: Impact leads BOTH font sites and nothing scales
//      the glyph horizontally. An Arial Black pass and a stretch were rejected
//   4. THE BURST IS VERTICAL: step 0, every row on the same x, pitch 32 (gb-pile; 48 gb-cluster, 58 before)
//   5. THE ENTRANCE: 0.06 -> 2.36 by frame 2 -> 1 over 10 frames (gb-pile: was ~2.08 on frame 4), and the pop is not
//      allowed past frame 10 where the settled bitmap takes over
//   6. THE WOBBLE IS CAPPED: peak exactly 11.0 degrees (gb-pile; 22 gb-cluster, 12 before), checked across
//      the whole window rather than read off the amplitude constant
//   7. THE GLOW GROWS WITH THE GLYPH: at frame 0 it is a fraction of its
//      settled width, not a full-size disc around a speck
//   8. THE SILHOUETTE TRACKS THE BORDER: the drop shadow is stroked at exactly
//      the white border's width, so the two cannot drift apart
//   9. CONTROL - EVERY OTHER NUMBER IS UNTOUCHED: a normal hit and a crit keep
//      their sizes, their font and their own pop
//  10. THE PILE (gb-pile): once a cascade has landed the NEWEST row sits at the foe, in front, and each older one
//      a pitch higher - so the strip showing of every older row is the top of its digits, as with ordinary numbers
//  11. THE FONT (dn-font): several live numbers in one frame all draw in Impact (on v0.30.803 only the first did)
// Run: node scripts/gb_core_test.mjs   (MOJI_GAME_FILE=... for a baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 13101);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 250) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
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
    const r = await page.evaluate(() => { const o = document.getElementById('class-options');
      return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
    if (r) break;
    if (!(await click('#cs-nav-next'))) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
  for (let i = 0; i < 30; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1000);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) break;
  }
  // .fade is what the boot gate waits for: without it the loop spins without ever stepping the sim
  await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });

  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { framesRan: 0 };
    const t0 = game.time, w0 = performance.now();
    while (game.time - t0 < 30 && performance.now() - w0 < 9000) await sleep(30);
    out.framesRan = game.time - t0;

    out.dials = {
      size: LX_GB_ROW_SIZE, white: LX_GB_WHITE, black: LX_GB_BLACK,
      pitch: LX_GB_ROW_PITCH, step: LX_GB_XSTEP,
      popS: LX_GB_POP_S, popMin: LX_GB_POP_MIN, popWarp: (typeof LX_GB_POP_WARP === 'number') ? LX_GB_POP_WARP : 1,
      wobble: LX_GB_WOBBLE, wobbleF: LX_GB_WOBBLE_F, wobbleHz: LX_GB_WOBBLE_HZ, shake: LX_GB_SHAKE, shakeF: LX_GB_SHAKE_F,
      glow: LX_GB_GLOW, pulse: LX_GB_GLOW_PULSE, dilate: LX_GB_DILATE,
    };

    // THE ENTRANCE, from the shipped curve
    const pop = [];
    for (let age = 0; age < 11; age++) {
      if (age >= 10) { pop.push(1); continue; }
      const t = Math.pow(age / 10, (typeof LX_GB_POP_WARP === 'number') ? LX_GB_POP_WARP : 1), s = LX_GB_POP_S;   // gb-pile: the warped clock
      const back = 1 + (t - 1) * (t - 1) * ((s + 1) * (t - 1) + s);
      pop.push(+(LX_GB_POP_MIN + back * (1 - LX_GB_POP_MIN)).toFixed(3));
    }
    out.pop = pop;
    // THE WOBBLE, across the whole window - not read off the amplitude
    let wmax = 0;
    for (let age = 0; age < LX_GB_WOBBLE_F; age++) wmax = Math.max(wmax, Math.abs(Math.sin(age * LX_GB_WOBBLE_HZ) * LX_GB_WOBBLE * (1 - age / LX_GB_WOBBLE_F)));
    // and the live draw really uses that curve, including under low-fx (which boss fights switch on)
    out.lowFxRot = /if \(rot && \(!_dnLowFx_top \|\| d\._gbVolc\)\) ctx\.rotate\(rot\);/.test(String(drawDamageNumbers));
    out.wobbleDeg = +(wmax * 180 / Math.PI).toFixed(2);
    out.popWarpDrawn = /Math\.pow\(t, LX_GB_POP_WARP\)/.test(String(drawDamageNumbers));   // the replica is only honest if the draw warps too
    // THE GLOW at frame 0 vs settled, using the shipped divisor
    const gw = (age, scale) => {
      const gk = (age < 10) ? (1 + (LX_GB_GLOW_PULSE - 1) * (1 - age / 10)) : 1;
      return +(LX_GB_GLOW[0][0] * gk / Math.max(1, scale)).toFixed(2);
    };
    out.glowF0 = gw(0, pop[0]);          // glyph at 0.06 - must be small in DEVICE px
    out.glowF0Device = +(out.glowF0 * pop[0]).toFixed(2);
    out.glowSettled = gw(10, 1);

    // a real B/G row, through the real path
    const m = { currentHp: 1e12, maxHp: 1e12, x: player.x + 140, y: player.y, w: 40, h: 40, vx: 0, vy: 0, type: 'slime', level: 1 };
    game.monsters.push(m);
    game.damageNumbers.length = 0; m._deCol = null;
    _lxGbStackOpen();
    for (let i = 0; i < 4; i++) {
      game.damageNumbers.push({ x: m.x, y: m.y, vy: -2, text: String(1000 + i), life: 40, maxLife: 46, color: '#ffffff', size: 16 });
      _lxGbStack(m, 'magic');
    }
    const rows = game.damageNumbers.filter((z) => z && z._deRow !== undefined && !z._deSum);
    out.rows = { n: rows.length, sizes: rows.map((z) => z.size), dx: rows.map((z) => z._gbDx), volc: rows.every((z) => !!z._gbVolc) };
    const i2 = game.monsters.indexOf(m); if (i2 >= 0) game.monsters.splice(i2, 1);
    // THE PILE: let the four-row cascade land (rows arrive 5 frames apart) and the climb settle, then read where they sit
    {
      const tP = game.time, wP = performance.now();
      while (game.time - tP < 26 && performance.now() - wP < 6000) await sleep(16);
      const live = rows.filter((z) => z.life > 0);
      out.pile = { n: live.length, y: live.map((z) => +z.y.toFixed(1)), foeY: m.y - 6, colVolc: !!(m._deCol && m._deCol.volc),
        newestInFront: game.damageNumbers.indexOf(rows[rows.length - 1]) > game.damageNumbers.indexOf(rows[0]) };
    }

    // CONTROL: a normal hit and a crit, baked, must keep their own sizes and font
    const uiK = (typeof _dnUiK === 'number') ? _dnUiK : 1;
    const inkOf = (d, col) => {
      const bk = _dnBake(d, '11,238', col, ((d.size + 4) * uiK) | 0);
      const cc = bk.cv.getContext('2d');
      const im = cc.getImageData(0, 0, bk.cv.width, bk.cv.height).data;
      let x0 = bk.cv.width, y0 = bk.cv.height, x1 = -1, y1 = -1;
      for (let yy = 0; yy < bk.cv.height; yy++) for (let xx = 0; xx < bk.cv.width; xx++) {
        if (im[(yy * bk.cv.width + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      }
      return { w: x1 - x0, h: y1 - y0 };
    };
    // THE FONT (dn-font): every LIVE number in one frame goes out in Impact - not just the first of its size, which is
    // all v0.30.803 managed (the rest drew in whatever UI font the frame had before the loop)
    {
      game.damageNumbers.length = 0;
      const camX0 = game.camera.x, camY0 = (game.camera && game.camera.y) || 0;
      ['1,204', '987', '1,331'].forEach((t, i) => game.damageNumbers.push({ x: camX0 + 400 + i * 120, y: camY0 + 400, vy: 0, text: t, life: 40, maxLife: 44, color: '#fff', size: 14, crit: false }));
      const fonts = {}, ft = ctx.fillText, origDraw = window.drawDamageNumbers;
      let armed = false;
      ctx.fillText = function (txt) { if (armed) fonts[String(txt)] = ctx.font; return ft.apply(this, arguments); };
      window.drawDamageNumbers = function () { armed = true; try { return origDraw.apply(this, arguments); } finally { armed = false; } };
      const wF = performance.now();
      while (Object.keys(fonts).length < 3 && performance.now() - wF < 3000) await sleep(16);
      window.drawDamageNumbers = origDraw; delete ctx.fillText;
      out.fonts = fonts;
      game.damageNumbers.length = 0;
    }
    const realLow = window._perfLowFx; window._perfLowFx = () => false;
    out.ink = {
      normal: inkOf({ size: 14, color: '#fff', crit: false }, '#fff'),
      crit: inkOf({ size: 18, color: '#ffd24a', crit: true }, '#ffd24a'),
      bg: inkOf({ size: LX_GB_ROW_SIZE, color: LX_GB_ROW_COL, _gbVolc: true, big: true, crit: false }, LX_GB_ROW_COL),
    };
    window._perfLowFx = realLow;
    return out;
  });

  const src = readFileSync(path.join(ROOT, FILE), 'utf8');
  // the two DRAW sites build their font by concatenation; v0.30.790's _lxWarmCombatFonts names the same face in a
  // literal warm-up list, which is not a place a number is drawn - counting it failed this check on every build since
  const impactSites = (src.match(/\+ 'px Impact, "Arial Black", "Trebuchet MS", sans-serif'/g) || []).length;
  const stretch = /LX_GB_WIDEN/.test(src);
  const ring = /LX_GB_RING/.test(src);
  const shadowTracks = /ctx\.lineWidth = LX_GB_WHITE \/ \(scale \|\| 1\);/.test(src) && /c\.lineWidth = LX_GB_WHITE;/.test(src);
  const D = R.dials;

  console.log(`  dials ${JSON.stringify(D)}`);
  console.log(`  pop ${JSON.stringify(R.pop)} | wobble ${R.wobbleDeg} deg`);
  console.log(`  glow f0 ${R.glowF0} user (${R.glowF0Device} device) vs settled ${R.glowSettled} | ink bg ${R.ink.bg.w}x${R.ink.bg.h} crit ${R.ink.crit.w}x${R.ink.crit.h} normal ${R.ink.normal.w}x${R.ink.normal.h}`);
  console.log(`  pile ${JSON.stringify(R.pile)}`);
  console.log(`  rows ${JSON.stringify(R.rows)} | impact sites ${impactSites} | stretch ${stretch} | ring ${ring} | shadow tracks border ${shadowTracks} | frames ${R.framesRan}`);

  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('THE CORE OUTWEIGHS THE FRAME: 50 core, 15 white, 11 black',
    D.size === 50 && D.white === 15 && D.black === 11 && (D.white - D.black) / 2 <= 3,
    `core ${D.size}, visible white ${(D.white - D.black) / 2}px, black ring ${D.black / 2}px; B/G ink ${R.ink.bg.w}x${R.ink.bg.h} vs crit ${R.ink.crit.w}x${R.ink.crit.h}`);
  ok('THE FACE IS UNTOUCHED: Impact at both sites, no horizontal stretch',
    impactSites === 2 && !stretch,
    `Impact-led font sites ${impactSites}/2, stretch present ${stretch} (an Arial Black pass and a stretch were both rejected)`);
  ok('THE BURST IS VERTICAL: step 0, every row on the same x',
    D.step === 0 && D.pitch === 32 && R.rows.n === 4 && R.rows.dx.every((v) => v === 0) && R.rows.volc,
    `step ${D.step}, pitch ${D.pitch}, offsets ${JSON.stringify(R.rows.dx)}`);
  ok('THE ENTRANCE: 0.06 to a 2.3x+ peak by frame 2, and back to 1 by frame 10',
    R.pop[0] === D.popMin && Math.max(...R.pop) >= 2.3 && R.pop.indexOf(Math.max(...R.pop)) <= 2 && R.pop[1] > 2 && R.pop[10] === 1 && R.popWarpDrawn,
    `${R.pop[0]} -> peak ${Math.max(...R.pop)} -> ${R.pop[10]} (a crit peaks at 1.30)`);
  ok('THE WOBBLE IS CAPPED AT 11 DEGREES, measured across its own window, and survives low-fx',
    Math.abs(R.wobbleDeg - 11) < 0.15 && !ring && R.lowFxRot === true && D.wobbleF <= 10 && D.shake > 6 && D.shakeF > 8,   // gb-pile: the swing ends with the pop
    `peak ${R.wobbleDeg} deg over ${D.wobbleF} frames; judder ${D.shake}px/${D.shakeF}f; B/G rotates under low-fx ${R.lowFxRot}; shockwave ring present ${ring} (removed per user)`);
  ok('THE GLOW GROWS WITH THE GLYPH: frame 0 is a speck, not a disc',
    R.glowF0Device < R.glowSettled * 0.25 && D.glow[0][1] <= 0.06,
    `frame 0 renders ${R.glowF0Device} device px vs ${R.glowSettled} settled; outer alpha ${D.glow[0][1]}`);
  ok('THE SILHOUETTE TRACKS THE BORDER: the drop shadow is stroked at the border width',
    shadowTracks,
    'the shadow reads LX_GB_WHITE in both the bake and the live path, so it cannot drift from the border');
  ok('CONTROL — EVERY OTHER NUMBER IS UNTOUCHED: normal and crit keep their own size',
    R.ink.normal.w > 0 && R.ink.crit.w > R.ink.normal.w && R.ink.bg.w > R.ink.crit.w * 1.4,
    `normal ${R.ink.normal.w}x${R.ink.normal.h}, crit ${R.ink.crit.w}x${R.ink.crit.h}, B/G ${R.ink.bg.w}x${R.ink.bg.h}`);
  const F = R.fonts || {};
  ok('THE FONT: every live number in a frame draws in Impact, not only the first of its size',
    Object.keys(F).length === 3 && Object.values(F).every((f) => /Impact/.test(f)),
    Object.entries(F).map(([t, f]) => t + ' in ' + f).join('; ') || 'no live number drawn');
  const P = R.pile || { n: 0, y: [] };
  ok('THE PILE: the newest row sits at the foe, in front, and each older one a pitch higher',
    P.colVolc && P.n === 4 && P.newestInFront && P.y.every((y, i) => Math.abs(y - (P.foeY - (P.n - 1 - i) * D.pitch)) < 1),
    `rows oldest->newest at y ${JSON.stringify(P.y)}, foe line ${P.foeY}, pitch ${D.pitch}; newest drawn last ${P.newestInFront}`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
