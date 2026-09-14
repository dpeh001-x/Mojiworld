// The damage you take is drawn like the damage you deal.
// ============================================================================
// Every check renders the SAME number twice at the SAME spot - once tagged as
// taken, once not - so the background is identical and the only difference is
// the treatment. No cross-build baseline needed; the control is in the run.
//   1. GRADIENT FILL: the tagged number's colour spans a real luminance range
//   2. INNER FOIL: light pixels ride the glyph (the control has none)
//   3. HALO: it paints more of its own colour than the flat number
//   4. CONTROL - WORD POPS UNTOUCHED: a tagged DODGE renders pixel-identical
//   5. CONTROL - GAINS UNTOUCHED: a tagged '+500' renders pixel-identical
//   6. CONTROL - CRITS KEEP GOLD: a crit still wears gold, not a red mix
// Run: node scripts/taken_foil_test.mjs   (MOJI_GAME_FILE=... for a baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12751);
const OUTPNG = process.env.LX_SHOT || '';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  // a persisted save from an earlier run changes the character level, and with it every
  // level-scaled number - start every run from a clean slate so results are reproducible
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
    const out = { cases: {} };
    try { loadMap('forest'); game.paused = false; } catch (e) { out.err = String(e); return out; }
    await sleep(1200);
    player._god = true; game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
    const cv = document.getElementById('game');
    const cx2 = cv.getContext('2d');
    out.canvas = cv.width + 'x' + cv.height;
    const waitFrames = async (n) => {
      const g0 = game.time | 0, t0 = performance.now();
      while (((game.time | 0) - g0) < n && performance.now() - t0 < 20000) await sleep(16);
    };
    // Find the number by DIFFING the frame against one drawn without it, rather
    // than trusting a hand-computed box: the canvas is its own size and the world
    // carries a camera transform, and a box that misses reads as "no effect".
    // The number is drawn in the game's LOGICAL space (W x H, 960x560) onto a
    // canvas whose backing store is its own size (1280x746) - the scale between
    // them is what my first attempt got wrong, reading an empty region. Put the
    // number at a known logical spot, convert once, and search only around it so
    // the moving background never lands in the bbox. Both captures are taken
    // while the world is PAUSED, so the only difference is the glyph itself.
    const LX = 300, LY = 220;                                  // logical
    const _WL = (typeof W === 'number' && W > 0) ? W : 960;
    const _HL = (typeof H === 'number' && H > 0) ? H : 560;
    const kx = cv.width / _WL, ky = cv.height / _HL;
    const cxp = Math.round(LX * kx), cyp = Math.round(LY * ky);
    const shot = async (extra) => {
      game.damageNumbers.length = 0;
      game.paused = false;
      await waitFrames(2);
      const camY = (game.camera && game.camera.y) || 0;
      game.damageNumbers.push(Object.assign({ x: game.camera.x + LX, y: camY + LY, vy: 0, life: 300, maxLife: 300, size: 15 }, extra));
      await waitFrames(20);          // let the pop-in settle (it animates on game.time)
      const cur = cx2.getImageData(0, 0, cv.width, cv.height);
      game.damageNumbers.length = 0;
      await waitFrames(2);           // the pair is 2 frames apart, so the background barely drifts
      const base = cx2.getImageData(0, 0, cv.width, cv.height);
      const W2 = cv.width, H2 = cv.height, a = base.data, b = cur.data;
      const RX = 200, RY = 160;
      const sx0 = Math.max(0, cxp - RX), sx1 = Math.min(W2 - 1, cxp + RX);
      const sy0 = Math.max(0, cyp - RY), sy1 = Math.min(H2 - 1, cyp + RY);
      let x0 = W2, y0 = H2, x1 = -1, y1 = -1;
      for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) {
        const i = (y * W2 + x) * 4;
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      const W = W2, H = H2;
      if (false) for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) {
        const i = (y * W + x) * 4;
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) return { empty: true, w: 0, h: 0, data: [] };
      const pad = 6;
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
      x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
      const d = cx2.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
      return { data: Array.from(d.data), w: d.width, h: d.height, box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] };
    };
    const stats = (img, hueTest) => {
      const d = img.data;
      let n = 0, mn = 1e9, mx = -1, light = 0, sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (d[i + 3] < 200) continue;
        if (r > 200 && g > 200 && b > 200) light++;
        if (!hueTest(r, g, b)) continue;
        const L = 0.299 * r + 0.587 * g + 0.114 * b;
        n++; sum += L; if (L < mn) mn = L; if (L > mx) mx = L;
      }
      return { n, range: n ? Math.round(mx - mn) : 0, mean: n ? Math.round(sum / n) : 0, light };
    };
    const red = (r, g, b) => r > 110 && r > g * 1.5 && r > b * 1.5;
    const gold = (r, g, b) => r > 180 && g > 150 && b < 140;
    const same = (a, b) => {
      if (a.empty || b.empty || a.w !== b.w || a.h !== b.h) return 99999;   // a different footprint IS a difference
      let diff = 0;
      for (let i = 0; i < a.data.length; i += 4) {
        if (Math.abs(a.data[i] - b.data[i]) > 12 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 12 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 12) diff++;
      }
      return diff;
    };
    // WHAT THE DRAW ACTUALLY DOES. Pixel forensics in a live scene kept measuring
    // the moving background, so the treatment is read where it happens: spy on the
    // canvas calls drawDamageNumbers makes for one number. The dealt design IS
    // those calls - a coloured halo stroke, a gradient fill, a light inner foil,
    // a clipped highlight band - so recording them is the check.
    const spy = async (extra) => {
      game.damageNumbers.length = 0;
      await waitFrames(2);
      const P = CanvasRenderingContext2D.prototype;
      const oGrad = P.createLinearGradient, oStroke = P.strokeText, oFill = P.fillText, oClip = P.clip;
      const rec = { grads: 0, strokes: [], fills: [], clips: 0 };
      P.createLinearGradient = function (...a) { rec.grads++; return oGrad.apply(this, a); };
      P.strokeText = function (...a) { rec.strokes.push({ w: +(+this.lineWidth).toFixed(2), c: String(this.strokeStyle) }); return oStroke.apply(this, a); };
      P.fillText = function (...a) { rec.fills.push(typeof this.fillStyle === 'string' ? String(this.fillStyle) : 'GRADIENT'); return oFill.apply(this, a); };
      P.clip = function (...a) { rec.clips++; return oClip.apply(this, a); };
      const camY = (game.camera && game.camera.y) || 0;
      game.damageNumbers.push(Object.assign({ x: game.camera.x + LX, y: camY + LY, vy: 0, life: 300, maxLife: 300, size: 15 }, extra));
      await waitFrames(14);            // settle past the pop-in, then a few drawn frames
      const snapshot = { grads: rec.grads, strokes: rec.strokes.slice(-6), fills: rec.fills.slice(-4), clips: rec.clips };
      P.createLinearGradient = oGrad; P.strokeText = oStroke; P.fillText = oFill; P.clip = oClip;
      game.damageNumbers.length = 0;
      return snapshot;
    };
    out.cases.taken = await spy({ text: '14', color: '#ff6666', taken: true });
    out.cases.plain = await spy({ text: '14', color: '#ff6666' });
    out.cases.dodgeT = await spy({ text: 'DODGE', color: '#88ffcc', size: 14, taken: true });
    out.cases.dodgeP = await spy({ text: 'DODGE', color: '#88ffcc', size: 14 });
    out.cases.gainT = await spy({ text: '+500', color: '#ffcc44', taken: true });
    out.cases.gainP = await spy({ text: '+500', color: '#ffcc44' });
    out.cases.crit = await spy({ text: '73708', color: '#ffcc44', crit: true, size: 22 });
    // one picture for the human, taken the old way
    const takenNum = await shot({ text: '14', color: '#ff6666', taken: true });
    const plainNum = await shot({ text: '14', color: '#ff6666' });
    out.shots = { taken: takenNum, plain: plainNum, w: takenNum.w, h: takenNum.h };
    return out;
  });
  if (R.err) console.log('  err ' + R.err);
  const T = (R.cases && R.cases.taken) || {}, P = (R.cases && R.cases.plain) || {}, C = (R.cases && R.cases.crit) || {};
  const DT = (R.cases && R.cases.dodgeT) || {}, DP = (R.cases && R.cases.dodgeP) || {};
  const GT = (R.cases && R.cases.gainT) || {}, GP = (R.cases && R.cases.gainP) || {};
  const sig = (x) => JSON.stringify({ grads: x.grads, clips: x.clips, strokes: (x.strokes || []).map((s) => s.w + '/' + s.c).join(' ') });
  console.log('  taken: ' + sig(T));
  console.log('  plain: ' + sig(P));
  console.log('  crit:  ' + sig(C));
  console.log('  dodge tagged ' + sig(DT) + ' vs plain ' + sig(DP));
  const lightFoil = (x) => (x.strokes || []).some((s) => s.w <= 2.2 && /^#/.test(s.c) && s.c.toLowerCase() !== '#000000' && s.c.toLowerCase() !== '#000');
  const halo = (x) => (x.strokes || []).some((s) => s.w >= 6);
  // Only the number's OWN marks count: the spy sees every canvas call in the frame,
  // so gradients and clips from the HUD and the world are noise. A coloured (non-black)
  // stroke on the glyph is the dealt treatment; a flat number has none.
  const isBlackStroke = (c) => { const t = String(c).toLowerCase(); return t === '#000000' || t === '#000' || t.indexOf('rgba(0, 0, 0') === 0; };
  const colouredStrokes = (x) => (x.strokes || []).filter((k) => !isBlackStroke(k.c));
  const haloOf = (x) => colouredStrokes(x).filter((k) => k.w >= 6).map((k) => k.c);
  const foilOf = (x) => colouredStrokes(x).filter((k) => k.w <= 2.5).map((k) => k.c);
  ok('GRADIENT FILL: the number the player took is filled with a gradient, like a dealt hit',
    (T.fills || []).includes('GRADIENT'), 'fills ' + JSON.stringify((T.fills || []).slice(-2)));
  ok('CONTROL: the same number untagged is still a flat fill, with no coloured marks',
    !(P.fills || []).includes('GRADIENT') && colouredStrokes(P).length === 0,
    'fills ' + JSON.stringify((P.fills || []).slice(-1)) + ', coloured strokes ' + JSON.stringify(colouredStrokes(P).map((k) => k.c)));
  ok('INNER FOIL: a light 2 px stroke mixed from its own colour rides the glyph',
    foilOf(T).length > 0, JSON.stringify(foilOf(T)));
  ok('HALO: a wide stroke in its own colour sits behind it',
    haloOf(T).some((c) => String(c).toLowerCase() === '#ff6666'), JSON.stringify(haloOf(T)));
  ok('CONTROL: a tagged word pop (DODGE) gets no coloured marks',
    colouredStrokes(DT).length === 0 && colouredStrokes(DP).length === 0,
    'tagged ' + JSON.stringify(colouredStrokes(DT).map((k) => k.c)) + ' vs plain ' + JSON.stringify(colouredStrokes(DP).map((k) => k.c)));
  ok('CONTROL: a tagged gain (+500) gets no coloured marks',
    colouredStrokes(GT).length === 0 && colouredStrokes(GP).length === 0,
    'tagged ' + JSON.stringify(colouredStrokes(GT).map((k) => k.c)) + ' vs plain ' + JSON.stringify(colouredStrokes(GP).map((k) => k.c)));
  ok('CONTROL: a crit still wears its own gold, not a red mix',
    haloOf(C).some((c) => String(c).toLowerCase() === '#ffcc44'), JSON.stringify(haloOf(C)));
  if (OUTPNG && R.shots && !R.shots.plain.empty && !R.shots.taken.empty) {
    const sharp = require(ROOT + '/node_modules/sharp');
    const mk = (o) => sharp(Buffer.from(Uint8Array.from(o.data)), { raw: { width: o.w, height: o.h, channels: 4 } })
      .extend({ top: 0, bottom: 0, left: 0, right: 0 }).png().toBuffer();
    const a = await mk(R.shots.plain), b = await mk(R.shots.taken);
    const W = Math.max(R.shots.plain.w, R.shots.taken.w), H = Math.max(R.shots.plain.h, R.shots.taken.h);
    const lab = (t, x) => ({ input: Buffer.from('<svg width="' + W + '" height="26" xmlns="http://www.w3.org/2000/svg"><text x="8" y="19" font-family="monospace" font-size="16" fill="#fff">' + t + '</text></svg>'), left: x, top: 2 });
    await sharp({ create: { width: W * 2, height: H + 30, channels: 4, background: { r: 40, g: 36, b: 54, alpha: 1 } } })
      .composite([{ input: a, left: 0, top: 30 }, { input: b, left: W, top: 30 }, lab('before', 0), lab('after', W)])
      .png().toFile(OUTPNG);
    console.log('  wrote ' + OUTPNG);
  }
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
