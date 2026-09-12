// HD first, and ready before the fight (v0.30.636).
//
// Per user: "help improve on the lag even more, also try to keep images as HD as possible". Checks the
// parts of that pass a frame-time probe cannot see directly:
//   1. the resolution governor runs on Medium and Low only - High keeps full resolution;
//   2. device-resolution caches round UP: the bake scale is never below the live render scale;
//   3. platforms and floors bake at device resolution, and easing the live scale does not re-bake them;
//   4. the character's own skill effects, and a pack's attack art (dash streak, poison cloud, quake
//      ring, swing and telegraph), are pinned before the fight - queued by the prewarm, not a draw;
//   5. the drawImage pin wrapper passes every arity through and still pins game-canvas draws;
//   6. growing slash/explosion sizes settle into a bounded set of bakes, 2.0-2.2x the box, reused;
//   7. the hero rig's memoised bone chains follow the rig, the hoisted leg tables still pose all three
//      attacks, and there are no page errors throughout.
//   node scripts/hd_prewarm_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11695), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxPrewarmDrain === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; loadMap('forest', 300); game.paused = false; });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const out = { build: GAME_VERSION }, frame = () => new Promise((res) => requestAnimationFrame(res));
    const prepared = (im) => !im || im.tagName === 'CANVAS' || (typeof _lxPinCache !== 'undefined' && _lxPinCache.has(im)) || (im.complete && !(im.naturalWidth > 0));
    // 1. the governor's policy, per preset
    const q0 = LX_GFX.quality; out.pol = {};
    for (const q of ['high', 'medium', 'low']) { LX_GFX.quality = q; out.pol[q] = { on: _lxDrsEnabled(), floor: _lxDrsFloorNow() }; }
    LX_GFX.quality = q0;
    // 2. the bake scale against the live scale
    out.dpr = _LX_DPR; out.bake = _lxBakeDpr();
    // 3. platform bakes hold their logical box at the platform bake scale (eased only for giant floors) ...
    const pb = (typeof _lxPlatBakeDpr === 'function') ? _lxPlatBakeDpr() : out.bake, plats = [];
    for (const cv of _CUTE_PLAT_CACHE.values()) if (cv && cv._lxLW > 0) {
      const s = Math.max(1, Math.min(pb, Math.sqrt((_CUTE_PLAT_MAX_PX * 2) / (cv._lxLW * cv._lxLH))));
      plats.push({ r: +(cv.width / cv._lxLW).toFixed(3), s: +s.toFixed(3) });
    }
    out.plats = { n: plats.length, pb, off: plats.filter((p) => Math.abs(p.r - p.s) > 0.05).slice(0, 4), maxR: plats.length ? Math.max(...plats.map((p) => p.r)) : 0 };
    // ... and the governor easing the LIVE scale (as Medium / Low do mid-fight) finds the same bake
    const tint = { top: '#c9a3ff', body: '#2a1e3c' }, pA = _cutePlatformSprite(120, 12, tint, false, 'grass', 0);
    _lxApplyRenderScale(1); const pB = _cutePlatformSprite(120, 12, tint, false, 'grass', 0); out.eased = _LX_DPR;
    _lxApplyRenderScale(_lxTargetDpr()); out.noRebake = !!pA && pA === pB;
    // 4. the character's own effects (stance + a job skill's set) and a pack's attack art, never drawn
    const wc = SKILLS.warlord_warcry, jb = !!wc; if (wc) { player.job = wc.job; player.master = wc.master; }   // job AND master: only castable skills warm
    const odm = window.drawMonster; window.drawMonster = function () {};
    const ww = (game.mapData && game.mapData.worldWidth) || 2400, gx = Math.min(ww - 260, player.x + 1300);
    out.spawned = [];
    for (const ty of ['skeleton', 'zombie', 'legosaurus']) if (monsterTypes[ty]) { try { spawnMonster(gx, player.y - 40, ty); out.spawned.push(ty); } catch (e) {} }
    const sets = () => ({ block: _fxAnimFrames('block_warrior'), banner: jb ? _fxAnimFrames('warlord_banner') : null,
      dash: VFX_ANIM_FRAMES.dashStreak, cloud: VFX_ANIM_FRAMES.poisonCloud, quake: _fxAnimFrames('quakeRing') });
    const singles = () => [LX_FX.swing_legosaurus, LX_FX.tg_col_legosaurus].filter((im) => im && im.tagName === 'IMG');
    const unready = () => {
      const S = sets(), bad = [];
      for (const k in S) { const a = S[k]; if (a === null) continue; if (!a || !a.length) { bad.push(k + ':missing'); continue; } const n = a.filter((im) => !prepared(im)).length; if (n) bad.push(k + ':' + n); }
      for (const im of singles()) if (!_lxPinCache.has(im)) bad.push('single:' + String(im.src).split('/').pop());
      return bad;
    };
    const t0 = performance.now(); let bad = unready(), readyMs = -1;
    while (performance.now() - t0 < 10000) { game.paused = false; await frame(); bad = unready(); if (!bad.length) { readyMs = performance.now() - t0; break; } }
    window.drawMonster = odm;
    const S = sets(); out.warm = { readyMs: Math.round(readyMs), bad: bad.slice(0, 8), queued: {} };
    for (const k in S) if (S[k]) out.warm.queued[k] = !!S[k]._lxFxWarmQ;
    // 5. the pin wrapper: every arity passes through, a bad one still throws, game-canvas draws still pin
    const big = Object.values(LX_FX).find((im) => im && im.tagName === 'IMG' && im.complete && im.naturalWidth >= 400);
    const oc = document.createElement('canvas'); oc.width = oc.height = 64; const g = oc.getContext('2d'); const ar = {};
    try { g.drawImage(big, 0, 0); g.drawImage(big, 0, 0, 32, 32); g.drawImage(big, 0, 0, 10, 10, 0, 0, 32, 32); ar.ok = true; } catch (e) { ar.err = String(e.message).slice(0, 80); }
    try { g.drawImage(big); ar.oneArgThrows = false; } catch (e) { ar.oneArgThrows = true; }
    const fresh = Object.values(LX_FX).find((im) => im && im.tagName === 'IMG' && im.complete && im.naturalWidth > 0 && !_lxPinCache.has(im) && im.naturalWidth * im.naturalHeight <= 2200000);
    if (fresh) { const p0 = _lxPinStats.pinned; ctx.drawImage(fresh, -9999, -9999, 1, 1); ar.pinnedNow = _lxPinStats.pinned > p0 && _lxPinCache.has(fresh); }
    out.arity = ar;
    // 6. a swing's growth: one pass mints a bounded set, the next pass reuses every bake
    delete big._lxProjCache;
    const first = new Map(); for (let b = 40; b <= 120; b++) first.set(b, _lxProjScaled(big, b, true));
    const nat = Math.max(big.naturalWidth, big.naturalHeight); let reused = 0; const band = [];
    for (let b = 40; b <= 120; b++) {
      const c = _lxProjScaled(big, b, true); if (c === first.get(b)) reused++;
      const L = Math.max(c.width, c.height); if (c === big || !(L >= 2 * b - 1 && (L <= 2.2 * b + 1 || L >= nat - 1))) band.push(b + ':' + L);
    }
    out.proj = { entries: big._lxProjCache ? big._lxProjCache.size : -1, reused, band: band.slice(0, 6) };
    // 7. the hero rig's chains and hoisted leg tables, then a second of basic attacks through them
    const hv = { n: 0, bad: [] };
    for (const bn of Object.keys(HERO_VEC_RIG)) {
      hv.n++; const c = _hvChain(bn);
      if (c !== _hvChain(bn)) hv.bad.push(bn + ':not memoised');
      if (c[c.length - 1] !== bn || HERO_VEC_RIG[c[0]].parent) hv.bad.push(bn + ':ends');
      for (let i = 1; i < c.length; i++) if (HERO_VEC_RIG[c[i]].parent !== c[i - 1]) hv.bad.push(bn + ':link');
    }
    out.hv = hv; const legs = {};
    for (const [nm, fn] of [['attack', _heroVecAttackLegPose], ['warrior', _heroVecWarriorSwingLegPose], ['rogue', _heroVecRogueLegPose]]) {
      try { legs[nm] = [0, 0.3, 0.6, 1, 1.3].map((t) => fn(t)).every((o) => o && isFinite(o.legR) && isFinite(o.legL) && isFinite(o.legRSy)); } catch (e) { legs[nm] = String(e.message).slice(0, 60); }
    }
    legs.intact = Object.isFrozen(_HV_WAR_LEG_KEYS) && Object.isFrozen(_HV_WAR_LEG_KEYS[0]) && _HV_WAR_LEG_KEYS[0].legR === -0.22 && _HV_ATK_LEG_KEYS.length === 5 && _HV_ROGUE_LEG_KEYS.length === 5;
    out.legs = legs;
    const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true }));
    for (let i = 0; i < 60; i++) { game.paused = false; if ((i & 7) === 0) { key('keydown', 'z'); setTimeout(() => key('keyup', 'z'), 60); } await frame(); }
    return out;
  });
  console.log(JSON.stringify(r));
  ok(`the governor runs on Medium and Low only; High keeps full resolution (${r.build})`, r.pol.high.on === false && r.pol.medium.on === true && r.pol.low.on === true && r.pol.medium.floor === 1 && r.pol.low.floor === 0.75, r.pol);
  ok('device-resolution caches round up: the bake scale is never below the live scale, at most an eighth above', r.bake >= r.dpr - 1e-9 && r.bake <= r.dpr + 0.125 + 1e-9, { dpr: r.dpr, bake: r.bake });
  ok('platforms and floors bake at device resolution', r.plats.n > 0 && r.plats.off.length === 0 && r.plats.maxR >= 1.25, r.plats);
  ok('easing the live scale (Medium / Low mid-fight) re-bakes no platform', r.noRebake === true && r.eased === 1, { eased: r.eased, noRebake: r.noRebake });
  ok(`the character's own effects and a pack's attack art are ready before the fight (${r.warm.readyMs} ms)`, r.spawned.length === 3 && r.warm.readyMs >= 0 && r.warm.bad.length === 0, r.warm);
  ok('...queued by the prewarm, not by a first draw', Object.keys(r.warm.queued).length >= 5 && Object.values(r.warm.queued).every(Boolean), r.warm.queued);
  ok('the pin wrapper passes 3-, 5- and 9-argument draws through; a 1-argument draw still throws', r.arity.ok === true && r.arity.oneArgThrows === true, r.arity);
  ok('...and still pins a decoded image drawn to the game canvas', r.arity.pinnedNow === true, r.arity);
  ok('a growing slash settles into <= 16 bakes at 2.0-2.2x the box, all reused on the next swing', r.proj.entries > 0 && r.proj.entries <= 16 && r.proj.reused === 81 && r.proj.band.length === 0, r.proj);
  ok('the hero rig memoises every bone chain, root to leaf', r.hv.n > 5 && r.hv.bad.length === 0, r.hv);
  ok('the hoisted leg tables still pose all three attacks (past the last key too), and stay intact', r.legs.attack === true && r.legs.warrior === true && r.legs.rogue === true && r.legs.intact === true, r.legs);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
