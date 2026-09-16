// Knight GUARDIAN: the winged aegis loop, larger, and never cut off.
// ============================================================================
// Per user: "For knight's skill guarding skill sprite and animation need to be larger and grander,
// more grandiose looking, ensure no cutoffs of canvas edges".
//
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. THE LOOP LOADS: listed in _FX_ANIM_KEYS, indexed at 9, all nine frames decode, no 404s -
//      each of those fails SILENTLY and leaves the static sprite on screen
//   3. NO CUT-OFF IN THE ART: every frame and the static base read clear on a 2px border
//   4. LARGER: the cast is size 400 / 84 frames / looping, and the drawn emblem at full swell is
//      more than twice the old one's largest (198 px)
//   5. IT RIDES THE KNIGHT: move the knight and the emblem moves with them
//   6. NEVER OFF SCREEN, measured from the real drawImage call: knight low on the ground (the case
//      that clipped in the first sample), knight high near the top, and knight at the left edge
//   7. THE KNIGHT STANDS IN FRONT: the emblem draws in the behind pass
//   8. CONTROL - clampView is opt-in: a burst without it still crosses the screen edge exactly as before
//   9. PREWARMED: _LX_SKILL_FX lists the set for Guardian
// Run: node scripts/knight_guardian_fx_test.mjs   (MOJI_GAME_FILE=... for a private build)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 13181);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 260) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  // serviceWorkers 'block': the game registers sw.js, and a request the worker serves never reaches
  // page.route - the staged art 404'd from serve.js instead of being intercepted.
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 747 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  // KG_STAGE / KG_INDEX: serve staged art and a staged frame index by interception, so the test can
  // run before anything is written under Sprites/ (used to validate the art before it was approved).
  if (process.env.KG_STAGE) {
    const { readFileSync } = await import('node:fs');
    const ST = process.env.KG_STAGE;
    if (process.env.KG_INDEX) await page.route('**/data/sprite_frame_index.js*', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(process.env.KG_INDEX) }));
    await page.route('**/Sprites/fx/knight_guardian.webp*', (r) => r.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(path.join(ST, 'knight_guardian.webp')) }));
    await page.route(/Sprites\/fx\/anim\/knight_guardian_(\d)\.webp/, (r) => {
      const i = /knight_guardian_(\d)\.webp/.exec(r.request().url())[1];
      r.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(path.join(ST, 'anim', 'knight_guardian_' + i + '.webp')) });
    });
  }
  const bad = [];
  page.on('response', (r) => { if (/knight_guardian/.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url().split('/').slice(-2).join('/')); });
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
    const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
    const out = {};
    const t0 = game.time, w0 = performance.now();
    while (game.time - t0 < 30 && performance.now() - w0 < 9000) await sleep(30);
    out.framesRan = game.time - t0;

    // ---- 2. the loop loads ----
    out.listed = _FX_ANIM_KEYS.has('knight_guardian');
    out.indexed = _lxFrameCount('fx/anim', 'knight_guardian', 9);
    const arr = _fxAnimFrames('knight_guardian') || [];
    const d0 = performance.now();
    while (performance.now() - d0 < 12000 && !(arr.length && arr.every((im) => im && im.complete && im.naturalWidth > 0) && _lxFxReady(LX_FX.knight_guardian))) await sleep(100);
    out.decoded = arr.filter((im) => im && im.complete && im.naturalWidth > 0).length;
    out.frameW = arr.map((im) => (im && im.naturalWidth) | 0);

    // ---- 3. no ink on any border (the ORIGINAL images, not the shrunk copies the draw may use) ----
    const borderInk = (src) => new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
        const { data, width: w, height: h } = g.getImageData(0, 0, c.width, c.height);
        let worst = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (x > 1 && y > 1 && x < w - 2 && y < h - 2) continue;
          worst = Math.max(worst, data[(y * w + x) * 4 + 3]);
        }
        resolve(worst);
      };
      im.onerror = () => resolve(-1);
      im.src = src;
    });
    out.borderAlpha = [];
    for (let i = 0; i < 9; i++) out.borderAlpha.push(await borderInk('Sprites/fx/anim/knight_guardian_' + i + '.webp?t=' + Date.now()));
    out.baseBorderAlpha = await borderInk('Sprites/fx/knight_guardian.webp?t=' + Date.now());

    // ---- the drawn box, read off the real drawImage call ----
    // Membership is checked at CALL time: _lxShrinkFrames swaps a set's entries in place for shrunk
    // canvases after decode, so a Set of the original images misses every frame actually drawn.
    const isKg = (img) => img === LX_FX.knight_guardian || ((FX_ANIM_FRAMES.knight_guardian || []).indexOf(img) >= 0);
    const P = CanvasRenderingContext2D.prototype, realDI = P.drawImage;
    let boxes = [];
    P.drawImage = function (img) {
      if (arguments.length >= 5 && isKg(img)) {
        const m = this.getTransform(), dx = arguments[1], dy = arguments[2], dw = arguments[3], dh = arguments[4];
        boxes.push({ x0: m.e + dx * m.a, y0: m.f + dy * m.d, x1: m.e + (dx + dw) * m.a, y1: m.f + (dy + dh) * m.d, cw: this.canvas.width, ch: this.canvas.height, k: m.a });
      }
      return realDI.apply(this, arguments);
    };
    // Ages are held with a margin: the sim can run two steps inside one rAF on a heavy frame, and a
    // burst pinned at life 2 then expires for real (the first version of this test lost one exactly so).
    const castAt = async (age, place) => {
      game.smoothFx = (game.smoothFx || []).filter((f) => f.spriteKey !== 'knight_guardian');
      if (place) place();
      SKILL_FNS.guardian();
      const fx = game.smoothFx.find((f) => f.spriteKey === 'knight_guardian');
      let hold = true;
      const h = () => { if (!hold) return; fx.life = fx.maxLife - age; requestAnimationFrame(h); };
      h();
      for (let i = 0; i < 6; i++) await raf();
      boxes = [];
      // the set's shrunk copies are baked asynchronously after decode, and a frame mid-bake is skipped
      // for that draw - wait for real draws (up to ~2 s) instead of measuring an empty moment
      for (let i = 0; i < 120 && boxes.length < 2; i++) await raf();
      hold = false;
      const b = boxes[boxes.length - 1] || null;
      return { fx, b };
    };

    // ---- 4 + 7. larger; drawn in the behind pass ----
    const c1 = await castAt(78);
    out.opts = { size: c1.fx.size, life: c1.fx.maxLife, frameGap: c1.fx.frameGap, behind: c1.fx.behind, follow: c1.fx.follow === player, clampView: c1.fx.clampView };
    out.drawnMaxH = c1.b ? Math.round((c1.b.y1 - c1.b.y0) / c1.b.k) : -1;   // logical px

    // ---- 6. never off screen: low (as spawned), high, left edge ----
    const onScreen = (b) => !!b && b.x0 >= -0.5 && b.y0 >= -0.5 && b.x1 <= b.cw + 0.5 && b.y1 <= b.ch + 0.5;
    const fmt = (b) => b ? `[${Math.round(b.x0 / b.k)},${Math.round(b.y0 / b.k)} .. ${Math.round(b.x1 / b.k)},${Math.round(b.y1 / b.k)}] of ${Math.round(b.cw / b.k)}x${Math.round(b.ch / b.k)}` : 'not drawn';
    const home = { x: player.x, y: player.y };
    out.low = fmt(c1.b); out.lowOk = onScreen(c1.b);
    const camY = () => Math.round((game.camera && game.camera.y) || 0);
    const high = await castAt(78, () => { player.y = camY() + 30; player.vy = 0; });
    out.high = fmt(high.b); out.highOk = onScreen(high.b);
    player.x = home.x; player.y = home.y; player.vy = 0;
    const left = await castAt(78, () => { player.x = game.camera.x + 6; player.vy = 0; });
    out.left = fmt(left.b); out.leftOk = onScreen(left.b);
    player.x = home.x; player.y = home.y; player.vy = 0;

    // ---- 5. it rides the knight ----
    const c2 = await castAt(20);
    const fx2 = c2.fx; let hold2 = true;
    const h2 = () => { if (!hold2) return; fx2.life = fx2.maxLife - 20; requestAnimationFrame(h2); }; h2();
    const x0 = fx2.x; player.x += 120;
    for (let i = 0; i < 4; i++) await raf();
    out.follow = { before: Math.round(x0), after: Math.round(fx2.x), playerCx: Math.round(player.x + player.w / 2) };
    hold2 = false; player.x = home.x;
    game.smoothFx = (game.smoothFx || []).filter((f) => f.spriteKey !== 'knight_guardian');

    // ---- 8. control: the same big burst WITHOUT clampView still crosses the bottom edge ----
    spawnSpriteBurst(player.x + player.w / 2, camY() + 540, 'knight_guardian', { size: 400, life: 84, scaleStartX: 1, scaleEndX: 1, scaleStartY: 1, scaleEndY: 1 });
    const ctl = game.smoothFx[game.smoothFx.length - 1];
    let holdC = true; const hc = () => { if (!holdC) return; ctl.life = ctl.maxLife - 2; requestAnimationFrame(hc); }; hc();
    for (let i = 0; i < 4; i++) await raf();
    boxes = []; for (let i = 0; i < 4; i++) await raf();
    holdC = false;
    const cb = boxes[boxes.length - 1];
    out.ctl = fmt(cb); out.ctlCrosses = !!cb && cb.y1 > cb.ch + 0.5;
    game.smoothFx = (game.smoothFx || []).filter((f) => f !== ctl);
    P.drawImage = realDI;

    // ---- 9. prewarm ----
    out.prewarm = (_LX_SKILL_FX.guardian || []).includes('knight_guardian');
    return out;
  });

  console.log(`  listed ${R.listed} indexed ${R.indexed} decoded ${R.decoded}/9 widths ${JSON.stringify(R.frameW)} | border alpha ${JSON.stringify(R.borderAlpha)} base ${R.baseBorderAlpha}`);
  console.log(`  opts ${JSON.stringify(R.opts)} | drawn at full swell ${R.drawnMaxH}px tall`);
  console.log(`  low ${R.low} | high ${R.high} | left ${R.left} | control ${R.ctl} | follow ${JSON.stringify(R.follow)} | 404s ${JSON.stringify(bad)}`);

  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('THE LOOP LOADS: listed, indexed at 9, nine frames decode, nothing 404s',
    R.listed && R.indexed === 9 && R.decoded === 9 && bad.length === 0,
    `listed ${R.listed}, index ${R.indexed}, decoded ${R.decoded}/9, failed requests ${bad.length} — any one of these missing fails silently to the static sprite`);
  ok('NO CUT-OFF IN THE ART: every frame and the base are clear on a 2px border',
    R.borderAlpha.length === 9 && R.borderAlpha.every((a) => a >= 0 && a <= 8) && R.baseBorderAlpha >= 0 && R.baseBorderAlpha <= 8,
    `worst border alpha per frame ${JSON.stringify(R.borderAlpha)}, base ${R.baseBorderAlpha} (8/255 is the ink threshold)`);
  ok('LARGER: 400 / 84 frames / looping, and more than twice the old emblem at full swell',
    R.opts.size === 400 && R.opts.life === 84 && R.opts.frameGap === 5 && R.drawnMaxH > 2 * 198,
    `drawn ${R.drawnMaxH}px tall at full swell against the old maximum of 198px (180 x 1.1)`);
  ok('IT RIDES THE KNIGHT: move the knight 120px and the emblem follows',
    R.opts.follow && Math.abs(R.follow.after - R.follow.playerCx) <= 1 && Math.abs(R.follow.after - R.follow.before - 120) <= 1,
    `emblem x ${R.follow.before} -> ${R.follow.after}, knight centre ${R.follow.playerCx}`);
  ok('NEVER OFF SCREEN: knight low on the ground, high near the top, and at the left edge',
    R.opts.clampView && R.lowOk && R.highOk && R.leftOk,
    `low ${R.low}; high ${R.high}; left ${R.left}`);
  ok('THE KNIGHT STANDS IN FRONT: the emblem draws in the behind pass', R.opts.behind === true, `behind: ${R.opts.behind}`);
  ok('CONTROL — clampView is opt-in: the same burst without it still crosses the bottom edge',
    R.ctlCrosses, `unclamped burst drawn ${R.ctl}`);
  ok('PREWARMED: _LX_SKILL_FX lists the loop for Guardian', R.prewarm, `guardian -> knight_guardian: ${R.prewarm}`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let nbad = 0;
for (const r of res) { if (!r.pass) nbad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(nbad ? `\n${nbad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(nbad ? 1 : 0);
