// Boss fights, smoother: each of the six stalls is reproduced against the shipped logic and then shown gone.
// ============================================================================
// Per user: "work on reducing the lags for boss fights even more such as gravitos, it needs to run ultrasmooth".
//
//   1. FRAMES RAN: the sim actually stepped
//   2. THE FADE TAIL BLITS THE BAKE: a settled number in its fade draws ONE bitmap and no text passes; a number
//      still popping in draws its text live (the crisp overshoot is kept)
//   3. THE STAND-IN IS THE LAST DRAWN CANVAS: a set with nothing baked yet is stood in by the boss's last canvas,
//      not by its raw 1656 px first frame; without a last canvas the old hold is unchanged
//   4. A FRAME WAITING FOR ITS BAKE IS NOT PINNED: _lxPinned hands back the image itself
//   5. GRAVITOS'S RING ART IS DECODED, THEN PINNED, AT SPAWN: all five sprites, through the prewarm drain
//   6. THE COMBAT FONTS ARE WARM: the boot gate touched them
//   7. STAMP MINTS ARE BUDGETED: 30 fresh particles over budget mint nothing and still draw; under budget they mint
//   8. THE TITLE CLEARANCE STOPS FORCING LAYOUT: two calls inside a second read the DOM rect once
//   9. END TO END, forms 1 -> 3 with the boss on screen: no full-size (>= 1.5 Mpx) boss frame is pinned or
//      plain-baked on the main thread at any form change or first cast
// Run: node scripts/grav_smooth_test.mjs   (MOJI_GAME_FILE=... for a private build)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
// v0.30.x — the tree this test lives in (it hardcoded the SHARED working copy, which grades whatever build that checkout
// holds). MOJI_SERVE_ROOT overrides.
const ROOT = (process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')).replace(/\\/g, '/');
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 13511);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 300) });
// the working copy's generated tables lag origin (plumbing pushes never touch it); serve origin's so the run
// sees the game the player gets
const T = path.join(process.env.TEMP || ROOT, 'gs_tables'); mkdirSync(T, { recursive: true });
for (const f of ['data/sprite_bbox.js', 'data/sprite_edges.js', 'data/sprite_frame_index.js']) {
  try { writeFileSync(path.join(T, path.basename(f)), execFileSync('git', ['-C', ROOT, 'show', 'origin/main:' + f], { maxBuffer: 64e6 })); } catch (e) {}
}
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1920, height: 1080 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  page.on('pageerror', () => {});
  for (const f of ['sprite_bbox.js', 'sprite_edges.js', 'sprite_frame_index.js']) {
    try { const body = readFileSync(path.join(T, f)); await page.route('**/data/' + f + '*', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body })); } catch (e) {}
  }
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function', null, { timeout: 120000 });
  await page.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 100; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; player._god = true;
    loadMap('gravitosArena'); game.paused = false;
  });
  await page.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => ![...document.querySelectorAll('video')].some((v) => v.offsetParent && !v.paused && v.id.indexOf('map-bg-video') !== 0), null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => { for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } game.paused = false; });
  await page.waitForTimeout(2500);

  // ---- units, in the live game ----
  const U = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const t0 = game.time, w0 = performance.now();
    while (game.time - t0 < 30 && performance.now() - w0 < 9000) await sleep(30);
    out.framesRan = game.time - t0;
    const P = CanvasRenderingContext2D.prototype;
    const count = (fn) => { const c = { fillText: 0, strokeText: 0, drawImage: 0 }; const o = {}; for (const k in c) { o[k] = P[k]; P[k] = function () { c[k]++; return o[k].apply(this, arguments); }; } try { fn(); } finally { for (const k in c) P[k] = o[k]; } return c; };
    // 2. numbers: one settled-and-fading, one popping
    const saved = game.damageNumbers; game.damageNumbers = [];
    const mk = (life, maxLife) => ({ x: game.camera.x + 400, y: 300, vy: 0, text: '1234', life, maxLife, color: '#ffd24a', size: 18, crit: true, wobbleDir: 1 });
    const fading = mk(3, 40);                                      // age 37 of 40: deep in the fade tail
    const uiK = (game._uiScale > 0) ? game._uiScale : 1;
    fading._bk = _dnBake(fading, '1234\u2605', '#ffd24a', (18 + 4) * uiK);   // it settled earlier and holds its bake
    game.damageNumbers = [fading];
    drawDamageNumbers();   // (dn-atlas: the first fading figure of a size builds its glyph atlas - text, once. Count the warm draw.)
    out.fade = count(() => drawDamageNumbers());
    const popping = mk(37, 40);                                    // age 3: mid pop
    game.damageNumbers = [popping];
    // (dn-atlas, later build: in a boss scene the pop blits glyphs. This check is about the LIVE path, so the atlas is held off for it;
    //  scripts/dn_atlas_pop_test.mjs covers the atlas.)
    const _atWas = (typeof _LX_DN_ATLAS_ON !== 'undefined') ? _LX_DN_ATLAS_ON : null; if (_atWas !== null) _LX_DN_ATLAS_ON = false;
    // v0.30.x — ...and the FX tier is pinned for this one draw. A popping crit draws its halo and the black outline (plus
    // the gold foil off lowFx); in the VERY-low tier it is the black outline alone - the designed cheap path (_dnStress).
    // Headless reaches that tier by missing frames (_perfTick sets LX_PERF.veryLowFx for 8 s), and a boss scene with 40+
    // live projectiles trips it on its own, so this count read 1 about one run in three. The check is about the LIVE
    // path's passes, not about which tier the machine happened to be in.
    const _vlWas = window._perfVeryLowFx; window._perfVeryLowFx = () => false;
    try { out.pop = count(() => drawDamageNumbers()); } finally { window._perfVeryLowFx = _vlWas; }
    if (_atWas !== null) _LX_DN_ATLAS_ON = _atWas;
    game.damageNumbers = saved;
    // 3. the stand-in
    const boss = game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
    const cap = _lxShrinkCap(720);
    const fakeImg = new Image(); Object.defineProperty(fakeImg, 'naturalWidth', { value: cap + 200 }); Object.defineProperty(fakeImg, 'naturalHeight', { value: cap + 100 }); Object.defineProperty(fakeImg, 'complete', { value: true });
    const set = [fakeImg]; fakeImg._lxSet = set; fakeImg._lxFi = 0; fakeImg._lxBaking = true;   // a set with nothing baked, its frame mid-bake
    const m = { type: 'gravitos', _phaseSprite: boss && boss._phaseSprite };
    const lastCv = document.createElement('canvas'); lastCv.width = 8; lastCv.height = 8;
    m._lxStandInCv = lastCv;
    const r1 = _lxBossStandIn(fakeImg, m);
    out.standIn = { withLast: r1 === lastCv ? 'last canvas' : (r1 === fakeImg ? 'RAW frame' : 'other') };
    delete m._lxStandInCv; set._lxHoldRaw = undefined;
    const r2 = _lxBossStandIn(fakeImg, m);
    out.standIn.withoutLast = r2 === fakeImg ? 'raw (as before)' : 'other';
    // 4. the pin guard
    // two FRESH images (an already-pinned one answers from its cache before any guard, rightly)
    const freshImg = async () => { const i = new Image(); i.src = LX_FX.gravitos_slamring.src + '?fresh=' + Math.random(); try { await i.decode(); } catch (e) {} return i; };
    const im = await freshImg();
    const pinned0 = _lxPinned(im); out.pinNormal = pinned0 && pinned0.tagName;
    const im2 = await freshImg(); im2._lxBaking = true;
    const p2 = _lxPinned(im2); out.pinBaking = p2 === im2 ? 'image itself' : (p2 && p2.tagName); im2._lxBaking = false;
    // 5. ring art warm
    const keys = ['gravitos_blackhole', 'gravitos_laserring', 'gravitos_soulring', 'gravitos_slamzone', 'gravitos_slamring'];
    _LX_MOB_FX_SEEN.delete('gravitos|boss');
    _lxPrewarmMobFx('gravitos', true);
    out.queued = _LX_PREWARM_FXQ.filter((j) => j.pin && keys.indexOf((j.pin.src || '').split('/').pop().replace('.webp', '')) >= 0).length;
    const d0 = performance.now();
    while (performance.now() - d0 < 6000) { _lxPrewarmFxDrain(true); const left = _LX_PREWARM_FXQ.filter((j) => j.pin && keys.indexOf((j.pin.src || '').split('/').pop().replace('.webp', '')) >= 0).length; if (!left) break; await sleep(50); }
    out.warm = keys.map((k) => { const i = LX_FX[k]; return k + ':' + (i && _lxPinCache.get(i) ? 'pinned' : 'not') + '/dec' + (i && i._lxPinDecoded); });
    // 6. fonts
    out.fontsWarm = !!window._lxFontsWarm;
    // 7. stamp budget
    const fresh = () => Array.from({ length: 30 }, (_, i) => ({ x: game.camera.x + 300 + i * 9, y: 320, vx: 0, vy: 0, life: 100, color: '#' + (0x100000 + (i * 0x1235 + 0x4f0000)).toString(16).slice(0, 6), size: 4 }));
    const psave = game.particles; const lowSave = LX_PERF.lowFx;
    _lxMintFrame = game.time | 0; _lxMintN = 9999;   // this frame's budget is spent
    const s0 = _FX_STAMPS.size; game.particles = fresh(); const c1 = count(() => drawParticles()); out.stampOver = { minted: _FX_STAMPS.size - s0, drew: c1.drawImage + (c1.fillText | 0) };
    _lxMintFrame = -1; _lxMintN = 0;                                // budget open
    const s1 = _FX_STAMPS.size; game.particles = fresh(); drawParticles(); out.stampUnder = _FX_STAMPS.size - s1;
    game.particles = psave; LX_PERF.lowFx = lowSave;
    // 8. clearance layout
    let rects = 0; const gb = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = function () { rects++; return gb.apply(this, arguments); };
    _LX_BT_CLR.t = 0; _lxBossTitleClearX(10, 40); _lxBossTitleClearX(10, 40); _lxBossTitleClearX(10, 40);
    Element.prototype.getBoundingClientRect = gb;
    out.rects = rects;
    return out;
  });

  // ---- end to end: forms 1 -> 3, boss kept on screen, every big pin / plain bake recorded ----
  const E = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const boss = () => game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
    const clear = () => { for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } game.paused = false; };
    const big = { pins: [], plains: [] };
    const rp = window._lxPinned; window._lxPinned = function (img) { const b = _lxPinCount; const r = rp.apply(this, arguments); if (_lxPinCount > b && img.naturalWidth * img.naturalHeight >= 1.5e6) big.pins.push((img.src || '').split('/').pop() + ' ' + img.naturalWidth + 'x' + img.naturalHeight); return r; };
    const rpo = window._lxPlainOf; window._lxPlainOf = function (img) { const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; if (img.tagName === 'IMG' && w * h >= 1.5e6) big.plains.push((img.src || '').split('/').pop() + ' ' + w + 'x' + h); return rpo.apply(this, arguments); };
    const L = window.loop, worst = []; window.loop = function () { const t0 = performance.now(); try { return L.apply(this, arguments); } finally { const d = performance.now() - t0; if (d > 40) worst.push(+d.toFixed(0)); } };
    const pinIv = setInterval(() => { const m = boss(); if (!m) return; player.x = m.x + m.w / 2 - 300; player.vx = 0; if (player.y > 470) player.y = 430; }, 400);
    const hitIv = setInterval(() => { const m = boss(); if (!m) return; const k = m.currentHp; try { hitMonster(m, 2000, Math.random() < 0.3, 'phys'); } catch (e) {} m.currentHp = Math.max(k, m.maxHp * 0.5); }, 250);
    const kill = async (want) => { let m = boss(), tries = 0; while (m && ((m._gravitosPhase || m.phase) | 0) < want && tries++ < 6) { clear(); m.evasion = 0; m._dying = false; m.currentHp = 1; try { hitMonster(m, 99999999, false, 'phys'); } catch (e) {} for (let k = 0; k < 30; k++) { await sleep(250); clear(); const b = boss(); if (b && ((b._gravitosPhase || b.phase) | 0) >= want) break; } m = boss(); } };
    const t0 = performance.now();
    await sleep(9000); await kill(2); await sleep(9000); await kill(3); await sleep(9000);
    clearInterval(pinIv); clearInterval(hitIv); window.loop = L; window._lxPinned = rp; window._lxPlainOf = rpo;
    const m = boss();
    return { secs: +((performance.now() - t0) / 1000).toFixed(1), form: m ? ((m._gravitosPhase || m.phase) | 0) : 0, pins: big.pins, plains: big.plains, worst: worst.sort((a, b) => b - a).slice(0, 8), over40: worst.length };
  });

  console.log(`  fade ${JSON.stringify(U.fade)} pop ${JSON.stringify(U.pop)} | standIn ${JSON.stringify(U.standIn)} | pin normal ${U.pinNormal} baking ${U.pinBaking}`);
  console.log(`  ring art queued ${U.queued}: ${U.warm.join(', ')} | fonts warm ${U.fontsWarm} | stamps over ${JSON.stringify(U.stampOver)} under ${U.stampUnder} | rects ${U.rects}`);
  console.log(`  end to end ${E.secs}s -> form ${E.form} | big pins ${JSON.stringify(E.pins)} | big plain bakes ${JSON.stringify(E.plains)} | loop frames >40ms ${E.over40} worst ${JSON.stringify(E.worst)}`);

  ok('FRAMES RAN: the sim actually stepped', (U.framesRan | 0) > 10, `${U.framesRan} frames`);
  ok('THE FADE TAIL BLITS THE BAKE: one bitmap, no text passes; the pop still draws live text',
    U.fade.drawImage >= 1 && U.fade.fillText === 0 && U.fade.strokeText === 0 && U.pop.strokeText >= 2 && U.pop.fillText >= 1,   // (dn-atlas: a fading FIGURE blits glyph cells now - several blits, still no text)
    `fading number: ${JSON.stringify(U.fade)} (previous build: 4+ text passes); popping number: ${JSON.stringify(U.pop)}`);
  ok('THE STAND-IN IS THE LAST DRAWN CANVAS, never the raw first frame; without one the old hold is unchanged',
    U.standIn.withLast === 'last canvas' && U.standIn.withoutLast === 'raw (as before)', JSON.stringify(U.standIn));
  ok('A FRAME WAITING FOR ITS BAKE IS NOT PINNED', U.pinBaking === 'image itself' && U.pinNormal === 'CANVAS', `baking: ${U.pinBaking}; ordinary image: ${U.pinNormal}`);
  ok('GRAVITOS\'S RING ART IS DECODED, THEN PINNED, AT SPAWN', U.queued === 5 && U.warm.every((w) => /:pinned\/dec2$/.test(w)), `${U.queued} queued; ${U.warm.join(', ')}`);
  ok('THE COMBAT FONTS ARE WARM at the boot gate', U.fontsWarm, `marker ${U.fontsWarm}`);
  ok('STAMP MINTS ARE BUDGETED: over budget mints nothing and still draws; under budget mints',
    U.stampOver.minted === 0 && U.stampOver.drew === 0 && U.stampUnder > 0, `over budget: ${JSON.stringify(U.stampOver)} (drew = stamp blits, 0 means the cheap square was used); under budget minted ${U.stampUnder}`);
  ok('THE TITLE CLEARANCE READS THE DOM RECT ONCE for three calls inside a second', U.rects === 2, `${U.rects} getBoundingClientRect calls (one call reads two rects; previous build: every call)`);
  ok('END TO END: no full-size boss frame is pinned or plain-baked on the main thread across forms 1 -> 3',
    E.form === 3 && E.pins.length === 0 && E.plains.length === 0,
    `reached form ${E.form}; full-size pins ${JSON.stringify(E.pins)}; full-size plain bakes ${JSON.stringify(E.plains)}; loop frames >40 ms: ${E.over40} (worst ${JSON.stringify(E.worst)})`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let nbad = 0;
for (const r of res) { if (!r.pass) nbad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(nbad ? `\n${nbad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(nbad ? 1 : 0);
