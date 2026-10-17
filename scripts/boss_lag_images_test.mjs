// Boss-fight image work off the main thread, pixels unchanged (v0.30.x boss-lag-images).
//   node scripts/boss_lag_images_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "work on reducing the lags especially on boss fights while preserving the quality of the sprites and images".
// In the Singularity (Gravitos's arena), as a level-200 Berserker:
//   - the boss's own art (shots, rifts, rings, swing / column art, the shackle sigil sets) and the hero's kit are pinned or baked
//     BEHIND the veil, and drawing every one of them after it lifts makes no synchronous decode (origin: dozens, 20-100 ms each);
//   - every copy the new paths make is pixel-identical to the old path's: an off-thread pin vs a sync pin (QTE, boss FX, kit FX),
//     a worker resize vs the main-thread resize (boss frames), drawn through the game's own sprite blit at both facings; the
//     worker's size scan vs the main-thread scan;
//   - with the worker gone (file://, no Worker) every path falls back to the old one and still produces the same pixels.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11755';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _lxPinned === 'function' && typeof _lxFxMobTags === 'function' && typeof _lxCvTrim === 'function', null, { timeout: 150000 });
  await p.waitForTimeout(2000);
  const api = await p.evaluate(() => ['_lxDecodeOff', '_lxPinAsync', '_lxBitmapOffThreadMain', '_lxBoxesOff', '_lxWarmBossFx'].filter((k) => typeof window[k] !== 'function'));
  // enter the arena as a fighter would: the veil (loadMap's ready gate) runs its warm, then lifts
  const up = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    try { if (typeof applyClass === 'function') applyClass('warrior'); } catch (e) {}
    const master = Object.keys(MASTERS).find((k) => MASTERS[k].from === 'berserker' || MASTERS[k].job === 'berserker') || null;
    player.cls = 'warrior'; player.job = 'berserker'; player.master = master; player.masteries = master ? { [master]: true } : {}; player.level = 200;
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.invulnerable = 999999; player.hp = player.maxHp = 999999;
    try { if (typeof _closeTutorial === 'function') _closeTutorial(true); } catch (e) {} window.startTutorial = function () {};
    // the sync-pin probe: a pin made from an <img> (not from an off-thread bitmap) is a main-thread decode at its first flush
    const P = window.__blP = { sync: 0, list: [], on: false };
    const o = window._lxPinned;
    window._lxPinned = function (img) {
      const cold = P.on && img && img.tagName === 'IMG' && img.complete && img.naturalWidth > 0 && !_lxPinCache.get(img) && !(typeof _lxPinBmpFor !== 'undefined' && _lxPinBmpFor === img);
      const t = performance.now(); const r = o.apply(this, arguments);
      if (cold && r !== img) { try { r.getContext('2d').getImageData(0, 0, 1, 1); } catch (e) {} P.sync++; if (P.list.length < 12) P.list.push(String(img.src).split('/').pop() + ' ' + Math.round(performance.now() - t) + 'ms'); P.max = Math.max(P.max || 0, performance.now() - t); }
      return r;
    };
    const clear = () => { for (const id of ['grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) b.click(); }
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e && e.classList.contains('on')) e.classList.remove('on'); } if (game.paused) game.paused = false; };
    const t0 = performance.now();
    loadMap('gravitosArena'); game.paused = false;
    let boss = null;
    for (let i = 0; i < 300 && !boss; i++) { await sleep(100); clear(); boss = game.monsters.find((m) => m && m.type === 'gravitos' && m.currentHp > 0) || null; }
    const fe = document.getElementById('map-fade-overlay');
    for (let i = 0; i < 150 && fe && fe.classList.contains('on'); i++) { await sleep(100); clear(); }
    const veilMs = Math.round(performance.now() - t0);
    // what is left of the warm drains in play: give it what the first seconds of a fight give it, in game frames (bounded)
    const g0 = game.time | 0, w0 = performance.now();
    while (((game.time | 0) - g0 < 240 || (typeof _LX_PREWARM_FXQ !== 'undefined' && _LX_PREWARM_FXQ.length)) && performance.now() - w0 < 45000) { await sleep(100); clear(); if (boss) { boss.patternState = 'idle'; boss.patternTimer = 0; } }
    return { veilMs, boss: !!boss, frames: (game.time | 0) - g0, fxq: _LX_PREWARM_FXQ.length, gate: (window._lxReadyGateLog || []).slice(-1)[0] || null, warm: window._lxFxWarmRec || null };
  });
  console.log('arena', JSON.stringify(up).slice(0, 400));
  check(up.boss && up.frames > 0, 'the Singularity loaded, Gravitos is up and the game steps', up);
  // 1. the boss's art and the kit, warm behind the veil: every loaded pin-size image the arena's boss and this hero's kit name is
  //    pinned or baked (origin: the kit got a 600 ms slice and the boss art none)
  const cov = await p.evaluate(() => {
    const tags = [];
    // the chain sigil is not his theme (the shackle here is gravity)
    for (const ty of _lxFxMapTypes('gravitosArena')) for (const t of _lxFxMobTags(ty)) if (tags.indexOf(t) < 0 && t.slice(3) !== 'qte_chains') tags.push(t);
    for (const t of _lxFxClassTags()) if (tags.indexOf(t) < 0) tags.push(t);
    const out = { loaded: 0, warm: 0, cold: [] }, seen = new Set();
    const MAXPX = _LX_PIN_MAX_PX;
    const one = (x, set) => {
      if (!x || seen.has(x)) return; seen.add(x);
      if (x.tagName === 'CANVAS') { out.loaded++; out.warm++; return; }
      if (x.tagName !== 'IMG' || !(x.complete && x.naturalWidth > 0) || x.naturalWidth * x.naturalHeight > (set ? MAXPX : _LX_PIN_MAX_PX)) return;
      out.loaded++;
      if (_lxPinCache.get(x) || (x._lxBakedCv && x._lxBakedCv.tagName === 'CANVAS')) out.warm++; else if (out.cold.length < 10) out.cold.push(String(x.src).split('/').slice(-2).join('/'));
    };
    window.__blArt = [];
    for (const t of tags) {
      const kind = t.slice(0, 2), k = t.slice(3);
      if (/^(fx|pp|bp|mp|mc)$/.test(kind)) { const im = _lxFxImg(t); one(im, false); if (im) __blArt.push(im); }
      else if (kind === 'fa' || kind === 'pa') { const arr = kind === 'fa' ? FX_ANIM_FRAMES[k] : PROJ_ANIM_FRAMES[k]; if (Array.isArray(arr)) for (const f of arr) { one(f, true); if (f) __blArt.push(f); } }
    }
    return out;
  });
  check(cov.loaded > 150 && cov.warm >= cov.loaded * 0.97, 'the boss art + kit art the arena names is warm behind the veil (' + cov.warm + ' of ' + cov.loaded + ')', cov);
  // 2. drawing every one of them now makes no synchronous decode (the perf line: none over 30 ms, and in fact none at all)
  const sp = await p.evaluate(() => {
    const P = window.__blP; P.on = true; P.sync = 0; P.list = []; P.max = 0;
    for (const x of window.__blArt) { try { ctx.drawImage(x, -4000, -4000, 8, 8); } catch (e) {} }
    P.on = false;
    return { n: window.__blArt.length, sync: P.sync, max: Math.round(P.max || 0), list: P.list };
  });
  check(sp.n > 150 && sp.sync === 0 && sp.max <= 30, 'no synchronous decode drawing the boss + kit art after the veil (' + sp.sync + ' of ' + sp.n + ', worst ' + sp.max + ' ms)', sp);
  check(api.length === 0, 'the off-thread paths exist (decode worker, async pin, worker scan, boss art warm)', api);
  if (!api.length) {
    // 3. pixel identity: each copy the new paths make, against the old path's, raw and drawn through the game's sprite blit (both facings)
    const id = await p.evaluate(async () => {
      const load = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = u; });
      const wait = async (f, ms) => { const t = performance.now(); while (!f() && performance.now() - t < ms) await new Promise((r) => setTimeout(r, 20)); return f(); };
      const px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const diff = (a, b) => { if (a.length !== b.length) return { len: [a.length, b.length], mx: 255 }; let n = 0, mx = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) { n++; if (d > mx) mx = d; } } return { n, mx }; };
      const drawn = (cv, face) => { const w = Math.max(8, Math.round(cv.width * 0.55)), h = Math.max(8, Math.round(cv.height * 0.55)); const t = document.createElement('canvas'); t.width = w; t.height = h; const g = t.getContext('2d');
        if (face < 0) { g.translate(w, 0); g.scale(-1, 1); } _lxDrawSoft(g, cv, 0, 0, w, h); return t; };
      const same = (a, b) => { const r = { raw: diff(px(a), px(b)) }; r.r = diff(px(drawn(a, 1)), px(drawn(b, 1))); r.l = diff(px(drawn(a, -1)), px(drawn(b, -1))); r.mx = Math.max(r.raw.mx, r.r.mx, r.l.mx); return r; };
      const src = (x) => String(x && (x._lxSrc ? x._lxSrc.src : x.src) || '');
      const out = { pins: [], bakes: [], boxes: [], fb: {} };
      // a. off-thread pins vs sync pins: the shackle sigil, the boss's effects, the kit's
      const pinUrls = [];
      for (const [k, i] of [['qte_gravity', 0], ['qte_gravity', 4], ['qte_gravity', 8], ['gravitos2_voidrift', 2], ['grav_impact', 3], ['rush', 2], ['warcry', 5]]) { const a = FX_ANIM_FRAMES[k]; if (a && a[i]) pinUrls.push(src(a[i])); }
      for (const k of ['gravitos_blackhole', 'gravitos_laserring', 'power_strike']) if (LX_FX[k]) pinUrls.push(src(LX_FX[k]));
      for (const u of pinUrls) {
        if (!u) continue;
        const A = await load(u + (u.indexOf('?') < 0 ? '?' : '&') + 'blA=1'), B = await load(u + (u.indexOf('?') < 0 ? '?' : '&') + 'blB=1');
        if (!A || !B) { out.pins.push({ u, err: 'load' }); continue; }
        const st = _lxPinAsync(A); await wait(() => _lxPinCache.get(A), 10000);
        const pa = _lxPinCache.get(A), pb = _lxPinned(B);
        out.pins.push(pa && pb && pb !== B ? { u: u.split('/').pop(), st, ...same(pa, pb) } : { u, err: 'nopin', st });
      }
      // b. worker resize vs main-thread resize: boss frames at the boss cap, then baked and drawn
      const frames = [];
      for (const S of [BOSS_IDLE_FRAMES, BOSS_WALK_FRAMES, BOSS_ATTACK_FRAMES]) for (const k of ['gravitos', 'gravitos2', 'gravitos3']) { const a = S[k]; if (a && a.length) frames.push(src(a[0]), src(a[a.length >> 1])); }
      for (const u of frames.filter(Boolean).slice(0, 8)) {
        const A = await load(u + '?blA=2'), B = await load(u + '?blB=2');
        if (!A || !B) { out.bakes.push({ u, err: 'load' }); continue; }
        const cap = _lxShrinkCap(720), k = Math.min(1, cap / Math.max(A.naturalWidth, A.naturalHeight)), bw = Math.max(1, Math.round(A.naturalWidth * k)), bh = Math.max(1, Math.round(A.naturalHeight * k));
        const wa = await _lxBitmapOffThread(A, bw, bh), mb = await _lxBitmapOffThreadMain(B, bw, bh);
        out.bakes.push({ u: u.split('/').slice(-2).join('/'), w: bw, viaWorker: !!_lxDecW && !_lxDecWDead, ...same(_lxBitmapToCanvas(wa, A), _lxBitmapToCanvas(mb, B)) });
      }
      // c. the worker's size scan vs the main-thread scan (both thresholds), capped and uncapped scans
      for (const u of frames.filter(Boolean).slice(0, 6)) {
        const A = await load(u + '?blA=3'), B = await load(u + '?blB=3');
        if (!A || !B) continue;
        const pr = _lxBoxesOff(A, true); if (pr) { try { await pr; } catch (e) {} }
        _lxBossBoxesOnce(B, true, null);
        out.boxes.push({ u: u.split('/').slice(-2).join('/'), h: A.naturalHeight, ok: !!pr && JSON.stringify([A._lxCBox, A._lxBBox]) === JSON.stringify([B._lxCBox, B._lxBBox]) && A._lxCBox !== undefined, a: [A._lxCBox, A._lxBBox], b: [B._lxCBox, B._lxBBox] });
      }
      // d. the worker gone: every path takes the old one, and the pixels still match
      { const u = frames[0], A = await load(u + '?blA=5'), B = await load(u + '?blB=5');
        const dead = _lxDecWDead; _lxDecWDead = true;
        const cap = _lxShrinkCap(720), k = Math.min(1, cap / Math.max(A.naturalWidth, A.naturalHeight)), bw = Math.max(1, Math.round(A.naturalWidth * k)), bh = Math.max(1, Math.round(A.naturalHeight * k));
        const fbB = await _lxBitmapOffThread(B, bw, bh);
        out.fb = { pin: _lxPinAsync(B), box: _lxBoxesOff(B, true), w: fbB && fbB.width, want: bw };
        _lxDecWDead = dead;
        const wa = await _lxBitmapOffThread(A, bw, bh);
        out.fb.px = same(_lxBitmapToCanvas(wa, A), _lxBitmapToCanvas(fbB, B)); }
      return out;
    });
    const pinBad = id.pins.filter((r) => r.err || r.mx > 0);
    check(id.pins.length >= 8 && !pinBad.length, 'an off-thread pin = the sync pin, pixel for pixel, raw and drawn both ways (' + id.pins.length + ': shackle, boss effects, kit)', pinBad.length ? pinBad : id.pins.slice(0, 2));
    const bakeBad = id.bakes.filter((r) => r.err || r.mx > 1);
    check(id.bakes.length >= 4 && !bakeBad.length && id.bakes.every((r) => r.viaWorker), 'a worker resize = the main-thread resize (within 1/255), raw and drawn both ways (' + id.bakes.length + ' boss frames, worst ' + Math.max(0, ...id.bakes.map((r) => r.mx || 0)) + ')', bakeBad.length ? bakeBad : id.bakes.slice(0, 2));
    check(id.boxes.length >= 4 && id.boxes.every((r) => r.ok), 'the worker\'s size scan = the main-thread scan (' + id.boxes.length + ' frames, both thresholds)', id.boxes.filter((r) => !r.ok).slice(0, 3));
    check(id.fb.pin === 0 && id.fb.box === null && id.fb.w === id.fb.want && id.fb.px && id.fb.px.mx === 0, 'with no worker every path falls back to the old one, same pixels', id.fb);
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
