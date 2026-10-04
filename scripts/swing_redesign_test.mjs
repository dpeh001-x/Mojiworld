// HEAVY SWINGS DRAWN AS THE MOTION THAT MAKES THEM. Per user: "some of the strike hit such as this randomly plays and it
// may seem a little weird" (tg_swing), "Most of the swings needs to be thoroughly redesigned because the trajectory and
// shape does not match the attack that produces it", "All 26 at once", "make it in the similar art design style as the
// parry style sprite". Every swinger drew one image stretched over its hitbox; bosses warned with one orange crescent.
//   - TABLE: every runtime swinger is either shaped (LX_SWING_SHAPE: a class, or a PATH read off its attack animation
//     - per user "redraw the direction of the strike", "not just weapon but weather it is a swing or a punch") or kept on purpose
//     (Path's Bane and Pisces already matched); a new swinger fails here until it is classified
//   - FILES: the 25 redrawn arts are off the old 512x224 stretch canvas, have clear corners, long edge <= 640
//   - DRAWN AS ITS SHAPE (in game, every shaped type forced to swing): the art is drawn at its own aspect (+-2%), the
//     path ends 0.35-1.15 hitbox-widths ahead of the front edge and crosses the hit band, and the first frame is clipped
//     (the path sweeps in) while a late frame is whole
//   - GHOST: a boss swing too weak to be "devastating" is still marked during its windup, by its own art (it was
//     unmarked), and still does not stagger; a normal mob's swing stays unmarked
//   [PORT=13923] node scripts/swing_redesign_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core'); const sharp = require('sharp'); sharp.cache(false);
const PORT = process.env.PORT || '13923'; let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 600) : '')); ok ? pass++ : fail++; };
const KEPT = ['pathsBane', 'zodiac_pisces', 'miraFallen' /* v0.30.1627: her Twin Verdict X-slash is drawn in her own attack set */], REDRAWN = ['scorpion', 'mummy', 'nougatBear', 'thornmaw', 'smithgolem', 'shardlich', 'ossuaryTyrant', 'echoKnight',
  'pqConductor', 'blockPopo', 'blockHupo', 'blockRhirhi', 'blockGary', 'legosaurus', 'taiger', 'willeo', 'young_confused_barnaby', 'fatDragon',
  'sundered_smith', 'goblinMauler', 'graveReaver', 'zodiac_aries', 'zodiac_capricorn', 'towerArbiter', 'towerSovereign'];
// FILES
const bad = [];
for (const t of REDRAWN) {
  const f = path.join(ROOT, 'Sprites', 'fx', `swing_${t}.webp`); if (!fs.existsSync(f)) { bad.push(t + ' missing'); continue; }
  const { data, info } = await sharp(fs.readFileSync(f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), W = info.width, H = info.height;
  let c = 0; for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) c += data[(y * W + x) * 4 + 3];
  if ((W === 512 && H === 224) || Math.max(W, H) > 640 || c > 40) bad.push(`${t} ${W}x${H} corners ${c}`);
}
check(bad.length === 0, 'FILES: 25 redrawn swing arts, off the old 512x224 stretch canvas, clear corners, long edge <= 640', bad);
// IN GAME
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
const R = await page.evaluate(async (REDRAWN) => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), raf = () => new Promise((r) => requestAnimationFrame(r));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  player._tutorialSeen = true; player._gravitosCineSeen = true; loadMap('forest', 1500); await W8(2500); try { closeAllModals(); } catch (e) {}
  const out = { swingers: Object.keys(monsterTypes).filter((t) => { const bm = monsterTypes[t] && monsterTypes[t].traits && monsterTypes[t].traits.bigMelee; return bm && (bm.kind || 'swing') === 'swing'; }),
    shape: typeof LX_SWING_SHAPE === 'object' ? JSON.parse(JSON.stringify(LX_SWING_SHAPE)) : null, drawn: {}, ghost: {} };
  if (!out.shape) return out;
  // instrument: every drawImage of the current type's swing art, with its transform and whether a clip is live
  const c2 = document.querySelector('canvas').getContext('2d'), P = CanvasRenderingContext2D.prototype, oDraw = P.drawImage, oClip = P.clip, oSave = P.save, oRest = P.restore;
  let want = null, log = null, clipDepth = [], inZones = false;
  P.save = function () { clipDepth.push(false); return oSave.apply(this, arguments); };
  P.restore = function () { clipDepth.pop(); return oRest.apply(this, arguments); };
  P.clip = function () { if (clipDepth.length) clipDepth[clipDepth.length - 1] = true; return oClip.apply(this, arguments); };
  P.drawImage = function (img) { const fr = log && want && want.frames ? want.frames() : null, idx = fr ? fr.indexOf(img) : -1;
    if (log && want && (img === want.art || img === want.pin() || idx >= 0)) { const t = this.getTransform(), a = arguments;
    const w = a.length >= 5 ? a[3] : img.width, h = a.length >= 5 ? a[4] : img.height;
    log.push({ dw: Math.hypot(t.a, t.b) * w, dh: Math.hypot(t.c, t.d) * h, iw: img.naturalWidth || img.width, ih: img.naturalHeight || img.height, idx, firing: !!(want.m && want.m._bigMeleeFiring), clipped: clipDepth.some(Boolean), zone: inZones, live: game.projectiles.some((q) => q.skill === 'swing') }); }
    return oDraw.apply(this, arguments); };
  const oZ = window._drawAttackZones; if (typeof _drawAttackZones === 'function') window._drawAttackZones = function () { inZones = true; try { return oZ.apply(this, arguments); } finally { inZones = false; } };
  const force = async (type, asBoss, keepHp) => {
    game.paused = false; game.monsters.length = 0; game.projectiles.length = 0;
    player._god = true; player.invulnerable = 9e9; player.hp = player.maxHp = 9e9; player.x = 1500; player.vx = 0;
    for (let k = 0; k < 20; k++) await raf();
    const m = spawnMonster(player.x + 260, player.y - 200, type, asBoss); if (!m) return null;
    const g = (game.platforms || []).find((q) => q.type === 'ground'); if (g) { m.y = g.y - m.h; m.vy = 0; }
    m.traits = Object.assign({}, m.traits, { activeBoss: true }); m.shootTimer = -9e9; m._columnCd = 9e9; m._hgCd = 9e9; m._bigMeleeCd = 300; m.facing = -1;
    const hasAnim = typeof _FX_ANIM_KEYS !== 'undefined' && _FX_ANIM_KEYS.has('swing_' + type);
    if (hasAnim) for (let k = 0; k < 300 && !_lxSwingAnim(type); k++) await raf();   // an animated swing plays its frames once all have decoded
    const art = LX_FX['swing_' + type]; want = { art, m, pin: () => (typeof _lxPinned === 'function' ? _lxPinned(art) : art), frames: () => (hasAnim ? _fxAnimFrames('swing_' + type) : null) }; log = [];   // the pinned copy appears after the first draws
    const bm = m.traits.bigMelee; let zones = null, sw = null, t0 = performance.now();
    while (performance.now() - t0 < 12000) {
      await raf(); player.x = m.x + m.w / 2 - bm.range * 0.8 - player.w / 2; player.y = m.y + m.h - player.h; player.vx = 0; player.vy = 0; m._zSpentMs = 0; m._dirOpenT = 0; m._dirFleeT = 0;
      if (m._bigMeleeFiring && m._bigMeleeT < bm.telegraphMs * 0.5 && !zones) zones = _lxAttackZones().filter((z) => z.kind === 'swing').map((z) => ({ sg: !!z.sg, tg: z.tg }));
      sw = sw || game.projectiles.find((q) => q.skill === 'swing' && q._swingType === type);
      if (sw && sw.life <= 6) break;
    }
    const nw = art.naturalWidth || art.width, nh = art.naturalHeight || art.height, sh = LX_SWING_SHAPE[type];
    const geo = sw && sh && sh[0] === 'PATH' ? { path: true, far: sh[1].e[0] * sw.w } : sw && sh ? _lxSwingArtRect(sh[0], { x: sw.x + sw._sgM.dx, y: sw.y + sw._sgM.dy, w: sw._sgM.w, h: sw._sgM.h }, sw.w, sw.h, sw.y, sh[1], nw, nh) : null;
    const r = { fired: !!sw, zoneAttack: sw ? !!sw._zoneAttack : null, zones, art: [nw, nh], sw: sw && [sw.w, sw.h], geo, anim: typeof _lxSwingAnimInfo === 'function' ? _lxSwingAnimInfo(sh) : null, orb: log.filter((q) => q.idx >= 0 && q.firing && !q.live).map((q) => q.idx), draws: log.filter((q) => !q.zone && q.live), ghost: log.filter((q) => q.zone).length };   // live: not the loader's warm-up draw
    log = null; return r;
  };
  for (const t of REDRAWN.concat(['towerWarden'])) out.drawn[t] = await force(t, !!(monsterTypes[t].boss || /^zodiac_/.test(t)));
  out.ghost.boss = await force('legosaurus', true); out.ghost.mob = await force('mummy', false);
  // BOSS HITBOX: the hero stands with its centre k AUTHORED swing widths out from the swinger's front edge (moved there in
  // the windup's last 60 ms, once the swing is committed); does the swing take any HP? Rolls pinned high (no dodge).
  const strip = async (type, asBoss, k) => {
    game.paused = false; game.monsters.length = 0; game.projectiles.length = 0;
    player._god = true; player.invulnerable = 9e9; player.x = 1500; player.vx = 0;
    for (let i = 0; i < 20; i++) await raf();
    const m = spawnMonster(player.x + 260, player.y - 200, type, asBoss); if (!m) return null;
    const g = (game.platforms || []).find((q) => q.type === 'ground'); if (g) { m.y = g.y - m.h; m.vy = 0; }
    m.traits = Object.assign({}, m.traits, { activeBoss: true }); const bm = m.traits.bigMelee;
    m.shootTimer = -9e9; m._columnCd = 9e9; m._hgCd = 9e9; m._bigMeleeCd = 300; m.facing = -1;
    const sw0 = bm.swingW || 180, sh0 = bm.swingH || 80, oR = Math.random; let zone = null, sw = null, hit = false, moved = false, fired = 0, H0 = 0, px = 0;
    // the swing is caught as it is pushed: one that lands on its first update is gone before the next frame can look for it
    const arr = game.projectiles, oPush = arr.push;
    arr.push = function (...a) { for (const q of a) if (q && q.skill === 'swing' && q._swingType === type && !sw) sw = { w: q.w, h: q.h }; return oPush.apply(this, a); };
    try {
      const t0 = performance.now();
      while (performance.now() - t0 < 12000) {
        await raf(); m._zSpentMs = 0; m._dirOpenT = 0; m._dirFleeT = 0;
        if (moved && sw) { fired++; if (player.hp < H0) hit = true; if (fired > 20) break; }   // any HP lost after the swing is out
        player.x = moved ? px : m.x + m.w / 2 - bm.range * 0.8 - player.w / 2; player.y = m.y + m.h - player.h; player.vx = 0; player.vy = 0;
        if (moved) { player.maxHp = getMaxHp(); player.hp = H0 = player.maxHp; }   // the game recomputes max HP; measure from its own value
        if (m._bigMeleeFiring && !zone) { const z = _lxAttackZones().find((q) => q.kind === 'swing'); if (z) zone = [z.w, z.h]; }
        if (m._bigMeleeFiring && m._bigMeleeT > 0 && m._bigMeleeT < 60 && !moved) {
          moved = true; px = player.x = (m.x + 8) - k * sw0 - player.w / 2;
          player._god = false; player.invulnerable = 0; player.maxHp = getMaxHp(); player.hp = H0 = player.maxHp; Math.random = () => 0.99; }
      }
    } finally { arr.push = oPush; delete arr.push; Math.random = oR; player._god = true; player.invulnerable = 9e9; player.hp = player.maxHp; }
    return { moved, hit, proj: sw && [sw.w, sw.h], authored: [sw0, sh0], zone };
  };
  out.big = { inBoss: await strip('legosaurus', true, 1.15), inMob: await strip('willeo', false, 1.15), outBoss: await strip('legosaurus', true, 1.45) };
  return out;
}, REDRAWN);
const classified = R.swingers.filter((t) => !(R.shape && R.shape[t]) && !KEPT.includes(t));
check(!!R.shape && classified.length === 0 && R.swingers.length >= 28, 'TABLE: every swinger is shaped or kept on purpose (Path\'s Bane, Pisces)', { swingers: R.swingers.length, unclassified: classified });
const off = [];
for (const [t, d] of Object.entries(R.drawn || {})) {
  if (!d || !d.fired || !d.geo || !d.draws.length) { off.push({ t, why: 'no swing / no draw', fired: d && d.fired, n: d && d.draws.length }); continue; }
  const g = d.geo, sw = d.sw[0], str = d.draws.filter((q) => Math.abs((q.dw / q.dh) / (q.iw / q.ih) - 1) > 0.02);   // every image at its own aspect
  const far = g.path ? g.far : g.rot ? g.u + g.w * Math.cos(g.rot) : g.u + g.w, farY = g.rot ? g.y + g.h / 2 + g.w * Math.sin(g.rot) : null;
  const why = [];
  if (str.length) why.push('stretched ' + str.map((q) => (q.dw / q.dh).toFixed(2) + ' vs ' + (q.iw / q.ih).toFixed(2)).join(' / '));
  if (far < 0.35 * sw || far > 1.15 * sw) why.push('path ends ' + (far / sw).toFixed(2) + ' sw ahead');
  if (d.anim) { if (!(d.orb.length && Math.min(...d.orb) < d.anim.k)) why.push('no orb in the windup'); if (d.draws[0].idx !== d.anim.k) why.push('the hit shows frame ' + d.draws[0].idx + ', not the strike ' + d.anim.k); }
  else if (!d.draws[0].clipped) why.push('first frame not swept in');
  if (d.draws[d.draws.length - 1].clipped) why.push('late frame still clipped');
  if (why.length) off.push({ t, why: why.join('; ') });
}
check(Object.keys(R.drawn || {}).length === 26 && off.length === 0, 'DRAWN AS ITS SHAPE: 26 swings at their own aspect, ending inside the reach, sweeping in on the first frame (an animated one: its orb in the windup, the strike frame on the hit)', off);
const gb = R.ghost && R.ghost.boss, gm = R.ghost && R.ghost.mob;
check(!!(gb && gb.zones && gb.zones.length && gb.zones[0].sg && gb.ghost > 0 && gb.zoneAttack === false),
  'GHOST: a boss swing too weak to be devastating is marked by its own art during the windup, and still does not stagger', gb && { zones: gb.zones, ghostDraws: gb.ghost, zoneAttack: gb.zoneAttack });
check(!!(gm && gm.fired && (!gm.zones || gm.zones.length === 0) && gm.ghost === 0), 'GHOST: a normal mob\'s swing stays unmarked', gm && { zones: gm.zones, ghostDraws: gm.ghost });
const B = R.big || {}, ib = B.inBoss || {}, im = B.inMob || {}, ob = B.outBoss || {};
check(!!(ib.proj && ib.proj[0] === Math.round(ib.authored[0] * 1.3) && ib.proj[1] === Math.round(ib.authored[1] * 1.15) && ib.zone && ib.zone[0] === ib.proj[0] && ib.zone[1] === ib.proj[1]
  && im.proj && im.proj[0] === im.authored[0] && im.proj[1] === im.authored[1]),
  'BOSS HITBOX: a boss swing is 1.3x wider and 1.15x taller than authored, its windup warning the same box; a normal monster\'s keeps its size', { boss: ib, mob: im });
check(!!(ib.moved && ib.hit === true && im.moved && im.hit === false && ob.moved && ob.hit === false),
  'BOSS HITBOX: standing past the authored reach but inside the larger one, a boss swing hits and a normal monster\'s misses; past the larger reach it misses too', { inBoss: ib.hit, inMob: im.hit, outBoss: ob.hit });
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
