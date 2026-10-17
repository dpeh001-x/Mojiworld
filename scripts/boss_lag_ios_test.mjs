// Boss art stays made on an iPhone-class memory budget, every pixel unchanged (v0.30.x boss-lag-ios).
//   node scripts/boss_lag_ios_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "fix it" (the iPhone item v0.30.1844 left open: boss poses re-baked mid-fight on an iOS-class canvas budget).
// iPhone (Safari UA -> the 40M px budget) at render scale 3, in the Singularity as a level-200 Berserker:
//   - Gravitos's frames are stored as their inked row bands (a fraction of the canvas) and his form is kept whole by the budget
//     (origin: 154M px of canvas for form 1, too big to keep: his poses were released and re-baked during the fight);
//   - in a fight window with the kit bot casting, none of his poses is released or baked again;
//   - every band-stored frame draws EXACTLY the old frame's pixels: raw, through the game's sprite blit (direct, plain-copy and
//     hit-flash paths), a sub-rectangle draw and the real _drawBossSprite, both facings;
// desktop (DPR 2): bands stay off on its budget, and the band path forced on is pixel-identical there too.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11775';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const IPHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
const DESK = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 };
const errs = [];
async function open(opts, dpr) {
  const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _lxDrawSoft === 'function' && typeof _lxCvTrim === 'function' && typeof _drawBossSprite === 'function', null, { timeout: 150000 });
  await p.waitForTimeout(2000);
  await p.evaluate((dpr) => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    try { if (typeof applyClass === 'function') applyClass('warrior'); } catch (e) {}
    const master = Object.keys(MASTERS).find((k) => MASTERS[k].from === 'berserker' || MASTERS[k].job === 'berserker') || null;
    player.cls = 'warrior'; player.job = 'berserker'; player.master = master; player.masteries = master ? { [master]: true } : {}; player.level = 200; player.baseAtk = 3000;
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.invulnerable = 999999; player.hp = player.maxHp = 999999; player.maxMp = player.mp = 99999; player.skillCooldowns = player.skillCooldowns || {};
    try { if (typeof _closeTutorial === 'function') _closeTutorial(true); } catch (e) {} window.startTutorial = function () {};
    if (dpr && Math.abs(_LX_DPR - dpr) > 0.01) _lxApplyRenderScale(dpr);
  }, dpr);
  return p;
}
// in-page: one frame file decoded twice - the old bake (bands off) and the new one - and every way the game draws it compared
const IDENT = async ({ urls, scales, real }) => {
  const load = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = u; });
  const data = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const diff = (a, b) => { if (a.length !== b.length) return 255; let mx = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > mx) mx = d; } return mx; };
  const scratch = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(8, Math.ceil(w)); c.height = Math.max(8, Math.ceil(h)); return c; };
  const drawn = (cv, face, s, opts, tint) => {   // the game's sprite blit, at a fractional spot, either facing, optionally under a tint
    const W = cv.naturalWidth, H = cv.naturalHeight, dw = W * s, dh = H * s, c = scratch(dw + 24, dh + 24), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.translate(7.37, 5.61); if (face < 0) { g.translate(dw, 0); g.scale(-1, 1); }
    const t0 = _lxMobTintFilter; _lxMobTintFilter = tint || null;
    try { _lxDrawSoft(g, cv, 0, 0, dw, dh, opts); } finally { _lxMobTintFilter = t0; }
    return c;
  };
  const sub = (cv) => { const W = cv.naturalWidth, H = cv.naturalHeight, c = scratch(W * 0.4 + 10, H * 0.35 + 10), g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cv, W * 0.25, H * 0.3, W * 0.5, H * 0.4, 3.3, 4.7, W * 0.4, H * 0.35); return c; };
  const full = (cv) => { const c = scratch(cv.naturalWidth, cv.naturalHeight); c.getContext('2d').drawImage(cv, 0, 0); return c; };
  const out = [], mb = window._lxMintBypass; window._lxMintBypass = true;   // every mint now, in both builds alike (the per-frame mint budget would split them)
  try { for (const u of urls) {
    const A = await load(u), B = await load(u);   // two images of the same file (the same URL: the edge / box tables answer both alike)
    if (!A || !B) { out.push({ u, err: 'load' }); continue; }
    A._lxSet = B._lxSet = []; A._lxFi = B._lxFi = 0;   // a boss frame (what _loadBossFrames tags), as the band path asks
    const cap = _lxShrinkCap(720), k = Math.min(1, cap / Math.max(A.naturalWidth, A.naturalHeight)), bw = Math.max(1, Math.round(A.naturalWidth * k)), bh = Math.max(1, Math.round(A.naturalHeight * k));
    const fa = await _lxBitmapOffThread(A, bw, bh, 1), fb = await _lxBitmapOffThread(B, bw, bh);
    const F = _lxBitmapToCanvas(fa, A), T = _lxBitmapToCanvas(fb, B);
    try { fa.close(); } catch (e) {} try { fb.close(); } catch (e) {}
    const r = { u: u.split('/').slice(-2).join('/'), w: bw, h: bh, band: !!(T && T._lxBand), sheet: T && T._lxBand ? +(T._lxBand.px / (bw * bh)).toFixed(3) : 1, dims: !!T && T.width === bw && T.height === bh && T.naturalWidth === bw, mx: 0, n: 0 };
    if (!F || !T) { r.err = 'bake'; out.push(r); continue; }
    const cmp = (a, b, what) => { const d = diff(data(a), data(b)); r.n++; if (d > r.mx) r.mx = d; if (d && (r.bad = r.bad || []).length < 4) r.bad.push(what + ':' + d); return d; };
    cmp(full(F), full(T), 'raw');
    for (const face of [1, -1]) for (const s of scales) {
      cmp(drawn(F, face, s, { deep: true, xs: 1 }), drawn(T, face, s, { deep: true, xs: 1 }), 'blit' + face + '@' + s);
      cmp(drawn(F, face, s, { deep: true, xs: 1, force: true }), drawn(T, face, s, { deep: true, xs: 1, force: true }), 'feather' + face + '@' + s);   // the feather composite
      cmp(drawn(F, face, s, { deep: true, xs: 1 }, 'brightness(2.5)'), drawn(T, face, s, { deep: true, xs: 1 }, 'brightness(2.5)'), 'flash' + face + '@' + s);   // the hit flash
      cmp(drawn(F, face, s, { deep: true, xs: 1 }, 'brightness(0.9) hue-rotate(60deg) saturate(1.1)'), drawn(T, face, s, { deep: true, xs: 1 }, 'brightness(0.9) hue-rotate(60deg) saturate(1.1)'), 'freeze' + face + '@' + s);
    }
    cmp(sub(F), sub(T), 'sub');
    if (real && real.boss) {   // the real boss draw on the game canvas, both facings: the same boss state, his frame swapped for F, then for T
      const m = game.monsters.find((q) => q && q.type === 'gravitos' && q.currentHp > 0);
      if (m) for (const face of [1, -1]) {
        const shot = (sp) => { const m2 = Object.assign({}, m, { facing: face, _lxCalE: null, _lxGg: null, _lxGgE: null, _lxStandInCv: null, x: m.x, y: m.y });
          const gg = _LX_GRAV_GHOST; _LX_GRAV_GHOST = 'off'; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#2a4'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
          ctx.save(); ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); try { _drawBossSprite(sp, m2, canvas.width / (2 * _LX_DPR) - m.w / 2 + 0.37, canvas.height / (2 * _LX_DPR) - m.h / 2 + 0.61, false, true); } finally { ctx.restore(); _LX_GRAV_GHOST = gg; }
          return ctx.getImageData(0, 0, canvas.width, canvas.height).data; };
        const d = diff(shot(F), shot(T)); r.n++; if (d > r.mx) r.mx = d; r.boss = (r.boss || 0) + 1; if (d && (r.bad = r.bad || []).length < 4) r.bad.push('boss' + face + ':' + d);
      }
    }
    out.push(r);
  } } finally { window._lxMintBypass = mb; }
  return out;
};
const FRAMES = ['idle/gravitos_0', 'walk/gravitos_7', 'attack/gravitospunch_4', 'attack/gravitos3star_5', 'walk/gravitos3_3', 'attack/gravitos2soul_2'].map((f) => 'Sprites/bosses/' + f + '.webp');
try {
  // ---- iPhone, render scale 3: the 40M px budget
  const pa = await open(IPHONE, 3);
  const api = await pa.evaluate(() => ({ miss: ['_lxBandView', '_lxBandOff', '_lxBandCanvas'].filter((k) => typeof window[k] !== 'function'), budget: _LX_CV_BUDGET_PX, dpr: _LX_DPR }));
  check(api.budget === 40e6 && Math.abs(api.dpr - 3) < 0.01, 'iPhone UA: the iOS-class canvas budget (40M px), render scale 3', api);
  check(!api.miss.length, 'the band store exists (worker band op, the frame canvas, the full-size view)', api.miss);
  const fight = await pa.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clear = () => { for (const id of ['grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) b.click(); }
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e && e.classList.contains('on')) e.classList.remove('on'); } if (game.paused) game.paused = false; };
    // churn probe: a boss frame released by the budget, and the same file baked again afterwards (his pose held meanwhile)
    const T = window.__ios = { rel: 0, relCur: 0, rebake: 0, on: false, list: [] };
    const fam = (k, p) => k === p || (k.length > p.length && k.indexOf(p) === 0 && k.charCodeAt(p.length) >= 97 && k.charCodeAt(p.length) <= 122);
    { const o = window._lxCvRelease; window._lxCvRelease = function (cv, e) { try { const s = cv && cv._lxSrc; if (T.on && s && s._lxSet) { T.rel++; s._iosRel = 1; const m = game.monsters.find((q) => q && q.type === 'gravitos' && q.currentHp > 0); const key = String(s.src).split('/').pop().replace(/_\d+\.webp.*$/, ''); if (m && fam(key, m._phaseSprite || m.type)) { T.relCur++; if (T.list.length < 6) T.list.push(key); } } } catch (x) {} return o.apply(this, arguments); }; }
    { const o = window._lxBitmapToCanvas; window._lxBitmapToCanvas = function (bmp, src) { try { if (T.on && src && src._iosRel && !(bmp && bmp._lxBandRes)) T.rebake++; } catch (x) {} return o.apply(this, arguments); }; }
    const t0 = performance.now();
    loadMap('gravitosArena'); game.paused = false;
    let boss = null;
    for (let i = 0; i < 300 && !boss; i++) { await sleep(100); clear(); boss = game.monsters.find((m) => m && m.type === 'gravitos' && m.currentHp > 0) || null; }
    const fe = document.getElementById('map-fade-overlay');
    for (let i = 0; i < 150 && fe && fe.classList.contains('on'); i++) { await sleep(100); clear(); }
    const veilMs = Math.round(performance.now() - t0);
    // a fight window: the hero beside him casting the whole kit, his HP held in a band, his own AI running
    const kit = Object.keys(SKILLS).filter((id) => { const s = SKILLS[id]; return s.cls === 'warrior' && (!s.job || s.job === player.job) && (!s.master || s.master === player.master); });
    let stop = false, last = 0, kept = 0, samples = 0;
    const tick = () => { if (stop) return; const m = game.monsters.find((q) => q && q.type === 'gravitos' && q.currentHp > 0);
      if (m) { player.x = m.x + m.w / 2 - (m.w / 2 + 60) - player.w / 2; player.vx = 0; player.facing = 1; if (m.currentHp < m.maxHp * 0.4) m.currentHp = m.maxHp * 0.9; m._instaTimer = m._soulTimer = 99999; }
      player.hp = player.maxHp; player.mp = 99999; game.dying = false;
      const now = performance.now(); if (now - last > 90) { last = now; for (const id of kit) if ((player.skillCooldowns[id] || 0) <= 0) { try { castSkill(id); } catch (e) {} } }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    for (let i = 0; i < 30; i++) { await sleep(100); clear(); }   // the first casts land, his first sets bake
    T.on = true;
    const g0 = game.time | 0, w0 = performance.now();
    while (((game.time | 0) - g0 < 600 || performance.now() - w0 < 25000) && performance.now() - w0 < 60000) { await sleep(250); clear(); samples++; if (_lxCvUseStamp() > 0) kept++; }
    T.on = false; stop = true;
    const fr = { n: 0, band: 0, px: 0, full: 0 };
    for (const S of [BOSS_IDLE_FRAMES, BOSS_WALK_FRAMES, BOSS_ATTACK_FRAMES]) for (const k in S) if (fam(k, 'gravitos')) for (const f of S[k]) if (f && f.tagName === 'CANVAS') { fr.n++; if (f._lxBand) { fr.band++; fr.px += f._lxBand.px; } else fr.px += f.width * f.height; fr.full += f.naturalWidth * f.naturalHeight; }
    return { veilMs, boss: !!boss, frames: (game.time | 0) - g0, secs: Math.round((performance.now() - w0) / 1000), kept, samples, rel: T.rel, relCur: T.relCur, rebake: T.rebake, list: T.list, fr,
      pool: (typeof _LX_BAND_POOL !== 'undefined') ? { n: _LX_BAND_POOL.length, px: _lxBandPoolPx() } : null };
  });
  console.log('iphone fight', JSON.stringify(fight));
  check(fight.boss && fight.frames >= 300, 'the Singularity loaded, Gravitos is up and the fight steps (' + fight.frames + ' game frames)', fight);
  check(fight.fr.n >= 20 && fight.fr.band >= fight.fr.n * 0.9 && fight.fr.px <= fight.fr.full * 0.45, 'his baked frames are stored as their inked bands (' + fight.fr.band + ' of ' + fight.fr.n + ', ' + Math.round(100 * fight.fr.px / Math.max(1, fight.fr.full)) + '% of the canvas pixels)', fight.fr);
  check(fight.samples > 0 && fight.kept >= fight.samples * 0.9, 'the budget keeps his form whole at render scale 3 (kept in ' + fight.kept + ' of ' + fight.samples + ' samples)', fight);
  check(fight.relCur === 0 && fight.rebake === 0, 'no pose of his current form released or baked again during the fight window (released ' + fight.relCur + ', re-baked ' + fight.rebake + ')', fight);
  check(!fight.pool || (fight.pool.n <= 3 && fight.pool.px <= 3 * 2256 * 1516), 'the full-size views stay a pool of at most three', fight.pool);
  const ia = await pa.evaluate(IDENT, { urls: FRAMES, scales: [0.18, 0.55, 1.3], real: { boss: true } });
  const iaBad = ia.filter((r) => r.err || !r.band || !r.dims || r.mx > 0 || r.sheet > 0.8);
  check(ia.length === FRAMES.length && !iaBad.length, 'iPhone DPR 3: every band-stored frame draws exactly the old pixels - raw, the sprite blit (direct, plain copy, feather, hit flash, freeze tint), a sub-rectangle and his real draw, both facings (' + ia.reduce((t, r) => t + r.n, 0) + ' comparisons, worst ' + Math.max(...ia.map((r) => r.mx || 0)) + ')', iaBad.length ? iaBad : ia.slice(0, 2));
  await pa.context().close();
  // ---- desktop, DPR 2: its budget keeps the old path; the band path forced on draws the same pixels there too
  const pd = await open(DESK, 2);
  const dk = await pd.evaluate(async () => { const im = new Image(); await new Promise((r) => { im.onload = r; im.onerror = r; im.src = 'Sprites/bosses/idle/gravitos_0.webp'; }); im._lxSet = [];
    return { budget: _LX_CV_BUDGET_PX, on: typeof _LX_BAND_ON === 'undefined' ? null : _LX_BAND_ON, wants: typeof _lxBandWants === 'function' ? _lxBandWants(im) : null }; });
  check(dk.budget === 160e6 && dk.on !== true && dk.wants !== true, 'desktop budget: boss frames bake the old way (bands off)', dk);
  await pd.evaluate(() => { try { _LX_BAND_ON = true; } catch (e) {} });
  const id2 = await pd.evaluate(IDENT, { urls: FRAMES, scales: [0.25, 0.6, 1.2], real: null });
  await pd.evaluate(() => { try { _LX_BAND_ON = false; } catch (e) {} });
  const idBad = id2.filter((r) => r.err || !r.band || !r.dims || r.mx > 0);
  check(id2.length === FRAMES.length && !idBad.length, 'desktop DPR 2, bands forced on: the same pixels, every path, both facings (' + id2.reduce((t, r) => t + r.n, 0) + ' comparisons, worst ' + Math.max(...id2.map((r) => r.mx || 0)) + ')', idBad.length ? idBad : id2.slice(0, 2));
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
