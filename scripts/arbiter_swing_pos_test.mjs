// THE ARBITER'S SWING STARTS AT HIM (v0.30.x arbiter-swing-pos). Per user: "for this swing on the left, it should be positioned
// closer to the arbiter instead of being so far out". His overhead CHOP's art was pinned to the far end of a box 572 px wide, so
// his purple crescent (and its windup ghost, orb and trail) hung 60-125 screen px clear of his drawn armour and blade, both facings.
// In the real fight loop, for each facing, at the strike frame: the gap between his drawn armour's front edge and the nearest
// opaque pixel of the swing art (both redrawn on clean layers with the game's own transforms) is <= 24 px; the windup ghost too;
// the crescent still sweeps well out; the swing hitbox still overlaps the drawn art. Then (per user, "Ship + shorten reach") his hit
// area ends where the crescent ends: the hitbox's far edge is within 24 px of the crescent's, a real hero standing inside the
// crescent is hit and one 14 px past its tip is not. Three other bosses' swing art is drawn exactly where the shared class rule
// (_lxSwingArtRect) puts it, on every draw of a swing (ghost, orb, strike, trail).
//   node scripts/arbiter_swing_pos_test.mjs        (MOJI_GAME_FILE=<build.html>, PORT=<port>)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11614';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const cache = new Map(), MIME = { js: 'application/javascript', webp: 'image/webp', png: 'image/png', woff2: 'font/woff2' };
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  // fonts, the data tables, boss frames and fx art come from origin (the working copy is stale), as does any file missing locally
  await p.route((u) => { const rel = decodeURIComponent(u.pathname).replace(/^[/]/, ''); return rel !== FILE && rel !== 'mojiworld_game.html' && (/^(assets[/]fonts[/].*[.]woff2|data[/].*[.]js|Sprites[/](bosses|fx)[/].*)$/.test(rel) || (rel && !existsSync(path.join(ROOT, rel)))); }, async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    try { if (!cache.has(rel)) cache.set(rel, execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }));
      r.fulfill({ status: 200, contentType: MIME[rel.split('.').pop()] || 'application/octet-stream', body: cache.get(rel) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxDrawSwingArt === 'function' && typeof _lxSwingArtRect === 'function', null, { timeout: 200000 });
  await p.evaluate(async () => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; try { if (window._lxBootHold && window._lxBootHold.release) window._lxBootHold.release('menu'); } catch (e) {}
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player._tutorialSeen = true; player.cls = 'warrior'; player.level = 60; player._god = true; player.invulnerable = 999999; player.maxHp = player.hp = 9e9;
    try { Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 }); } catch (e) {}
    loadMap('tower_b5', 200); await W8(2500); document.getElementById('everdawn-welcome-overlay')?.remove();
    { const o = document.getElementById('boss-intro-overlay'); if (o) o.classList.remove('on'); }
    game.paused = false; game.monsters.length = 0;
    const S = window.__sp = { raf: 0 }, cv = document.getElementById('game');
    { const o = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => o((t) => { S.raf = t; cb(t); }); }   // one id per painted frame
    const mk = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c._raf = -1; return c; };
    S.bodyIso = mk(); S.swIso = mk();
    const prep = (c) => { const g = c.getContext('2d', { willReadFrequently: true }); if (c._raf !== S.raf) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); c._raf = S.raf; } return g; };
    const oSoft = window._lxDrawSoft;   // the boss's own frames, redrawn with the game's transform on a clean layer (not the ward, not the fx)
    window._lxDrawSoft = function (c, img, dx, dy, dw, dh) {
      try { const s = String((img && (img.src || (img._lxSrc && img._lxSrc.src))) || '');
        if (c === ctx && S.type && s.indexOf('bosses/') >= 0 && new RegExp('/' + S.type + '\\w*_\\d+\\.webp').test(s)) { const g = prep(S.bodyIso); g.setTransform(c.getTransform()); if (dw != null) g.drawImage(img, dx, dy, dw, dh); else g.drawImage(img, dx, dy); S.bodyKey = s.replace(/^.*bosses[/]/, ''); } } catch (e) {}
      return oSoft.apply(this, arguments);
    };
    const P = CanvasRenderingContext2D.prototype, oDI = P.drawImage;   // every image the swing draw puts on screen, on its own clean layer
    P.drawImage = function (im, dx, dy, dw, dh) {
      if (S.inSw && this === ctx && this.globalCompositeOperation !== 'lighter' && arguments.length === 5) { try {
        const g = prep(S.swIso), t = this.getTransform(); g.setTransform(t); g.globalAlpha = 1; oDI.apply(g, arguments);
        if (!S.drawn) { const X = [dx, dx + dw].map((x) => [t.a * x + t.c * dy + t.e, t.a * x + t.c * (dy + dh) + t.e]).flat(), Y = [dy, dy + dh].map((y) => [t.b * dx + t.d * y + t.f, t.b * (dx + dw) + t.d * y + t.f]).flat();
          S.drawn = [Math.min(...X), Math.max(...X), Math.min(...Y), Math.max(...Y)]; } } catch (e) {} }
      return oDI.apply(this, arguments);
    };
    const oSA = window._lxDrawSwingArt;   // and where the shared class rule says that image goes
    window._lxDrawSwingArt = function (img, shape, mb, facing, hx, hy, hw, hh, reveal, alpha, camX, frame) {
      const fr = _lxSwingAnim(S.type), t = ctx.getTransform(), L = S.last = { raf: S.raf, fi: frame ? (fr ? fr.indexOf(frame) : -2) : -1, facing, hx, hy, hw, hh, a: t.a, F: t.a * ((facing > 0 ? hx : hx + hw) - camX) + t.e, yd0: t.d * hy + t.f, yd1: t.d * (hy + hh) + t.f };
      try { if (shape && shape[0] !== 'PATH') {
        const A = frame && shape[2] ? shape[2] : null, src = A ? frame : img, w0 = (src.naturalWidth || src.width) / (A ? 1 + 2 * A.p[0] : 1), h0 = (src.naturalHeight || src.height) / (A ? 1 + 2 * A.p[1] : 1);
        const r = _lxSwingArtRect(shape[0], mb, hw, hh, hy, shape[1], w0, h0);
        if (r && !r.rot) { const dx = A ? -A.p[0] * r.w : 0, dw = A ? r.w * (1 + 2 * A.p[0]) : r.w, dy = A ? -A.p[1] * r.h : 0, dh = A ? r.h * (1 + 2 * A.p[1]) : r.h, F = facing > 0 ? hx : hx + hw;
          const x0 = facing > 0 ? F + r.u + dx : F - r.u - dx - dw, X = (x) => t.a * (x - camX) + t.e, Y = (y) => t.d * y + t.f;
          L.rule = [X(x0), X(x0 + dw), Y(r.y + dy), Y(r.y + dy + dh)]; } } } catch (e) {}
      S.inSw = true; S.drawn = null; try { return oSA.apply(this, arguments); } finally { S.inSw = false; L.drawn = S.drawn; }
    };
    // opaque columns of a layer (>= n pixels of alpha >= A; solid = his armour and blade only, not the violet / pink / white glow of his own sword arc or sparks)
    S.cols = (c, A, n, solid) => {
      const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height, cnt = new Uint16Array(W);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if (d[k + 3] < A) continue; if (solid && (d[k + 2] > d[k + 1] + 30 || Math.min(d[k], d[k + 1], d[k + 2]) > 185)) continue; cnt[x]++; }
      let x0 = -1, x1 = -1; for (let x = 0; x < W; x++) if (cnt[x] >= n) { if (x0 < 0) x0 = x; x1 = x; }
      return x0 < 0 ? null : { x0, x1, d };
    };
    S.measure = () => {   // css px gap (body front -> nearest art pixel), art reach in world px, share of art pixels inside the hitbox
      const L = S.last, sc = cv.width / cv.getBoundingClientRect().width, b = S.cols(S.bodyIso, 200, 8, true), s = S.cols(S.swIso, 110, 3);
      if (!L || !b || !s || S.bodyIso._raf !== S.raf || S.swIso._raf !== S.raf) return null;
      const hx0 = L.F + (L.facing > 0 ? 0 : -L.hw * L.a), hx1 = hx0 + L.hw * L.a;   // the swing hitbox on the device
      let tot = 0, inn = 0; const W = S.swIso.width;
      for (let k = 3; k < s.d.length; k += 4) if (s.d[k] >= 110) { tot++; const x = (k >> 2) % W, y = (k >> 2) / W | 0; if (x >= hx0 && x <= hx1 && y >= L.yd0 && y <= L.yd1) inn++; }
      return { fi: L.fi, gap: (L.facing > 0 ? s.x0 - b.x1 : b.x0 - s.x1) / sc, far: (L.facing > 0 ? s.x1 - L.F : L.F - s.x0) / L.a, near: (L.facing > 0 ? s.x0 - L.F : L.F - s.x1) / L.a, hbFar: (L.facing > 0 ? hx1 - s.x1 : s.x0 - hx0) / sc, inHb: tot ? inn / tot : 0, body: [b.x0, b.x1], art: [s.x0, s.x1], F: L.F, key: S.bodyKey };
    };
  });
  // one heavy swing of `type`, facing f, through the real loop: every swing draw is recorded, the strike frame measured
  const swing = (type, f, measure) => p.evaluate(async ({ type, f, measure }) => {
    const S = window.__sp, W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r)), t0 = performance.now();
    S.type = type; game.monsters.length = 0; game.projectiles.length = 0; game._lxSwingFx = [];
    for (let i = 0; i < 400 && performance.now() - t0 < 60000; i++) {   // lazy art: his frames and his swing art, asked for and decoded
      try { _lxBossArtWant(type, true); } catch (e) {} const a = BOSS_ATTACK_FRAMES[type], id = BOSS_IDLE_FRAMES[type], st = LX_FX['swing_' + type], fr = _fxAnimFrames('swing_' + type);
      _lxFxReady(st); if (fr) fr.forEach((q) => q && _lxFxReady(q));
      if ((!a || _lxFtReadyN(a) >= a.length) && (!id || _lxFtReadyN(id) >= id.length) && _lxFxReady(st) && (!fr || _lxSwingAnim(type))) break; await W8(100);
    }
    const G = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, b) => b.w - a.w)[0];
    const m = spawnMonster(G.x + 450, G.y - 200, type, true, false) || game.monsters[game.monsters.length - 1]; if (!m) return { err: 'no spawn' };
    if (/^zodiac_/.test(type)) { m.zodiacBoss = true; m.zodiacSign = type.slice(7); }
    m.currentHp = m.maxHp = 9e9; m._bigMeleeCd = 1e9; m._columnCd = 1e9; m._hgCd = 1e9; m.invulnerable = true;
    const oAI = window.bossAI; window.bossAI = function (mm) { if (mm === m) { mm.patternState = 'idle'; return; } return oAI.apply(this, arguments); };   // its patterns sit out
    const px = f < 0 ? G.x + 380 : G.x + Math.min(G.w - 600, 820), place = () => { player.x = px; player.y = G.y - player.h; player.vx = 0; player.invulnerable = 999999; player.hp = player.maxHp; };
    const park = () => { m.x = px + player.w / 2 + (f < 0 ? 170 : -170) - m.w / 2; m.vx = 0; m.facing = f; m._wardUntil = 0; };
    const K = _lxSwingAnimInfo(_lxSwingShapeOf(type)), rec = { draws: [], ghost: [], strike: null, g0: game.time | 0 };
    try {
      for (let i = 0; i < 120 && performance.now() - t0 < 90000; i++) { place(); park(); m.aggroTarget = player; await frame(); }
      let fired = false, after = 0;
      for (let i = 0; i < 700 && performance.now() - t0 < 150000; i++) {
        place(); if (!fired && !m._bigMeleeFiring) { park(); m._bigMeleeCd = 0; } if (m._bigMeleeFiring) fired = true;
        await frame();
        const L = S.last;
        if (L && L.raf === S.raf) {
          rec.draws.push({ fi: L.fi, rule: L.rule, drawn: L.drawn });
          if (measure && L.fi === -1 && m._bigMeleeFiring) { const q = S.measure(); if (q) rec.ghost.push(q.gap); }
          if (measure && !rec.strike && L.fi === (K ? K.k : -1) && !m._bigMeleeFiring) rec.strike = S.measure();
        }
        if (fired && !m._bigMeleeFiring && ++after > 40) break;
      }
      return Object.assign(rec, { fired, frames: (game.time | 0) - rec.g0, k: K && K.k, pin: (_lxSwingShapeOf(type) || {}).pin || null, reach: _lxSwingDims(m, m.traits.bigMelee)[0] });
    } finally { window.bossAI = oAI; m._bigMeleeCd = 1e9; game.monsters.length = 0; game.projectiles.length = 0; }
  }, { type, f, measure });
  const R = {};
  for (const f of [-1, 1]) R[f] = await swing('towerArbiter', f, true);
  for (const f of [-1, 1]) {
    const r = R[f], s = r.strike, side = f < 0 ? 'facing left' : 'facing right';
    console.log(`  ${side}: frames ${r.frames}, draws ${r.draws.length}, strike ${s ? `gap ${s.gap.toFixed(1)} px, far ${s.far.toFixed(0)} of ${r.reach}, hitbox past it ${s.hbFar.toFixed(1)} px, in hitbox ${(s.inHb * 100).toFixed(0)}%, body ${s.key}` : 'not seen'}, ghost ${r.ghost.map((x) => Math.round(x)).join(',')}`);
    check(!!(r.fired && s && s.gap <= 24), `the Arbiter's strike starts at his drawn armour, ${side}: <= 24 px from his front edge to the nearest pixel of the crescent`, { fired: r.fired, frames: r.frames, strike: s && { gap: s.gap, body: s.body, art: s.art, key: s.key } });
    check(!!(r.ghost.length >= 2 && r.ghost[r.ghost.length - 1] <= 24), `his windup ghost (the same art, faint) starts at him too, ${side} (<= 24 px on its last windup frame)`, { ghost: r.ghost.map((x) => Math.round(x)) });   // early windup poses swing the blade far forward; the last one is the stance the strike leaves from
    check(!!(s && s.far >= 0.6 * r.reach && s.far <= 1.05 * r.reach), `the crescent still sweeps out from him, ${side}: its far end 0.6-1.05 of his reach ahead`, s && { far: s.far, reach: r.reach });
    check(!!(s && Math.abs(s.hbFar) <= 24), `his hit area ends where the crescent ends, ${side}: the hitbox's far edge within 24 px of the crescent's (per user, "shorten reach")`, s && { hbFar: s.hbFar, far: s.far, reach: r.reach });
    check(!!(s && s.inHb >= 0.2), `the swing hitbox still overlaps the drawn art, ${side} (>= 20% of the strike's opaque pixels inside it)`, s && { inHb: s.inHb });
  }
  const sL = R[-1].strike, sR = R[1].strike;
  check(!!(sL && sR && Math.abs(sL.near - sR.near) <= 4 && Math.abs(sL.far - sR.far) <= 4), 'both facings mirror each other: the strike art spans the same distances in front of him (within 4 px)', { L: sL && [sL.near, sL.far], R: sR && [sR.near, sR.far] });
  // does his swing land where it is drawn? A real hero (vulnerable, no dodge roll) is moved into place in the windup's last 200 ms,
  // once the swing is committed: inside the crescent (near edge at 35% of it), then just past its tip (14 px beyond its far edge)
  const reachHit = (f, uNear) => p.evaluate(async ({ f, uNear }) => {
    const S = window.__sp, frame = () => new Promise((r) => requestAnimationFrame(r)), t0 = performance.now();
    S.type = 'towerArbiter'; game.monsters.length = 0; game.projectiles.length = 0; game._lxSwingFx = [];
    const G = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, b) => b.w - a.w)[0];
    const m = spawnMonster(G.x + 450, G.y - 200, 'towerArbiter', true, false) || game.monsters[game.monsters.length - 1]; if (!m) return { err: 'no spawn' };
    m.currentHp = m.maxHp = 9e9; m._bigMeleeCd = 1e9; m._columnCd = 1e9; m._hgCd = 1e9; m.invulnerable = true;
    const oAI = window.bossAI; window.bossAI = function (mm) { if (mm === m) { mm.patternState = 'idle'; return; } return oAI.apply(this, arguments); };
    const px = f < 0 ? G.x + 380 : G.x + Math.min(G.w - 600, 820), place = () => { player.x = px; player.y = G.y - player.h; player.vx = 0; player.invulnerable = 999999; player.hp = player.maxHp; };
    const park = () => { m.x = px + player.w / 2 + (f < 0 ? 170 : -170) - m.w / 2; m.vx = 0; m.facing = f; m._wardUntil = 0; };
    let touched = 0, lost = 0, moved = false, H0 = 0, fired = false, after = 0, hx = 0;
    const oA = window.aabb, oR = Math.random, g0 = game.time | 0;
    window.aabb = function (a, b) { const r = oA.apply(this, arguments); if (r && b === player && a && a.skill === 'swing' && a._swingType === 'towerArbiter') touched++; return r; };   // the hit test his swing runs against the hero
    try {
      for (let i = 0; i < 120 && performance.now() - t0 < 60000; i++) { place(); park(); m.aggroTarget = player; await frame(); }
      for (let i = 0; i < 700 && performance.now() - t0 < 120000; i++) {
        if (!moved) { place(); if (!fired && !m._bigMeleeFiring) { park(); m._bigMeleeCd = 0; } }
        if (m._bigMeleeFiring) fired = true;
        if (!moved && m._bigMeleeFiring && m._bigMeleeT > 0 && m._bigMeleeT < 200) {
          moved = true; const F = f > 0 ? m.x + m.w - 8 : m.x + 8; hx = f > 0 ? F + uNear : F - uNear - player.w;
          player._god = false; player.invulnerable = 0; player.maxHp = getMaxHp(); player.hp = H0 = player.maxHp; Math.random = () => 0.99;
        }
        if (moved) { player.x = hx; player.y = G.y - player.h; player.vx = 0; player.vy = 0; }
        await frame();
        if (moved && player.hp < H0) { lost += H0 - player.hp; player.hp = H0; }   // measure the hit, never a death
        if (fired && !m._bigMeleeFiring && ++after > 30) break;
      }
      return { fired, moved, touched, lost: Math.round(lost), frames: (game.time | 0) - g0 };
    } finally { window.aabb = oA; Math.random = oR; player._god = true; player.invulnerable = 999999; player.maxHp = player.hp = 9e9; window.bossAI = oAI; m._bigMeleeCd = 1e9; game.monsters.length = 0; game.projectiles.length = 0; }
  }, { f, uNear });
  for (const f of [-1, 1]) {
    const s = R[f].strike, side = f < 0 ? 'facing left' : 'facing right'; if (!s) { check(false, `reach probes, ${side}`, 'no strike measured'); continue; }
    const inn = await reachHit(f, 0.35 * s.far), out = await reachHit(f, s.far + 14);
    console.log(`  ${side}: hero inside the crescent ${JSON.stringify(inn)}, just past its tip ${JSON.stringify(out)}`);
    check(!!(inn.fired && inn.moved && inn.touched > 0 && inn.lost > 0), `he still lands his swing on a hero standing inside the crescent, ${side}`, inn);
    check(!!(out.fired && out.moved && out.touched === 0 && out.lost === 0), `a hero just past the crescent's tip (14 px) is NOT hit, ${side}`, out);
  }
  for (const t of ['sundered_smith', 'young_confused_barnaby', 'zodiac_capricorn']) {
    const r = await swing(t, -1, false), cmp = r.draws.filter((d) => d.rule && d.drawn), off = cmp.filter((d) => d.rule.some((v, i) => Math.abs(v - d.drawn[i]) > 2));
    check(!!(r.fired && cmp.length >= 3 && off.length === 0 && r.pin == null), `${t}'s swing art is drawn where the shared class rule puts it, on all ${cmp.length} swing draws (ghost, orb, strike, trail)`, { fired: r.fired, n: cmp.length, pin: r.pin, off: off.slice(0, 2) });
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
