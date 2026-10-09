// SUMMONS STAND ON THE FLOOR (v0.30.x summon-plant). Per user: "ensure that the summons do not appear as floating and
// their feet are all grounded on the floor / platform", and "Ballista needs to be planted much more deeply to ensure that
// the back is also positioned below the hitbox foot".
//   node scripts/summon_footing_test.mjs      (MOJI_GAME_FILE=<build.html>, PORT=<port>, MOJI_DATA_REF=<git ref for data/>)
// Summons every ground summon on the forest floor and on a raised platform, records the real drawImage calls of
// drawMinions / drawWolf / drawBallistaTurrets, and measures the lowest opaque pixel each one paints against the surface
// it stands on (gap > 0 = floating). The pet art is three-quarter view, so the LOWEST paw must sit below the floor by the
// far paws' height (_LX_SUMMON_FAR_FOOT) - that is what plants the far paws; the undead keep their 3 px bite; the ballista's
// back edge (y 665 of its 768 canvas) must be under the foot line.
// Then per user: "the ballista is too deep down" (its back edge now sits ON the foot line, not 4 px under) and
// "werewolf is slightly deep down as well" (its far-foot height is 17/484: the dark middle paw is lifted mid-stride).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '11471', DATA_REF = process.env.MOJI_DATA_REF || '';
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  if (DATA_REF) await page.route((u) => /^[/]data[/][^/]+[.](js|json)$/.test(u.pathname), (r) => {
    try { r.fulfill({ status: 200, contentType: 'text/javascript', body: execFileSync('git', ['show', DATA_REF + ':' + decodeURIComponent(new URL(r.request().url()).pathname).slice(1)], { cwd: ROOT, maxBuffer: 1 << 26 }) }); } catch (e) { r.continue(); } });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof SKILL_FNS === 'object' && typeof raiseMinion === 'function', null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const colCache = new WeakMap();
    const cols = (img) => { if (colCache.has(img)) return colCache.get(img);
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0); const d = c.getImageData(0, 0, w, h).data, b = new Int32Array(w).fill(-1);
      for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0; y--) if (d[(y * w + x) * 4 + 3] > 40) { b[x] = y; break; }
      const r = { w, h, b }; colCache.set(img, r); return r; };
    const lowest = (call, inv) => {   // the lowest painted pixel of one drawImage call, in the draw function's own space
      const { img, a, T } = call, cb = cols(img); let sx = 0, sy = 0, sw = cb.w, sh = cb.h, dx, dy, dw, dh;
      if (a.length >= 8) [sx, sy, sw, sh, dx, dy, dw, dh] = a; else if (a.length >= 4) [dx, dy, dw, dh] = a; else return null;
      if (!(dw > 36 && dh > 30)) return null;
      const M = inv.multiply(T); let bot = -1e9, cx = 0, n = 0;
      for (let c = 0; c < cb.w; c++) { const yb = cb.b[c]; if (yb < 0) continue; const p = new DOMPoint(dx + (c + 0.5 - sx) / sw * dw, dy + (yb + 1 - sy) / sh * dh).matrixTransform(M); bot = Math.max(bot, p.y); cx += p.x; n++; }
      return n ? { bot, cx: cx / n, dy: new DOMPoint(dx, dy).matrixTransform(M).y, dh } : null; };
    const orig = {}, S = {};
    const wrap = (name, sink) => { orig[name] = window[name]; window[name] = function (...args) {
      const T0 = ctx.getTransform(), od = ctx.drawImage, calls = [];
      ctx.drawImage = function (img, ...a) { if (img) calls.push({ img, a, T: ctx.getTransform() }); return od.call(this, img, ...a); };
      try { return orig[name].apply(this, args); } finally { ctx.drawImage = od; const inv = T0.inverse(); sink(args, calls.map((c) => lowest(c, inv)).filter(Boolean)); } }; };
    const note = (k, v) => { (S[k] || (S[k] = [])).push(Math.round(v)); };
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; loadMap('forest'); await wait(2500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    const plats = (game.mapData.platforms || []).filter((p) => p.type === 'ground' || p.type === 'platform');
    const ground = plats.filter((p) => p.type === 'ground').sort((a, b) => b.w - a.w)[0];
    const ledge = plats.filter((p) => p.type === 'platform' && p.w >= 150 && p.y < ground.y - 40).sort((a, b) => b.w - a.w)[0];
    const out = { farFoot: typeof _LX_SUMMON_FAR_FOOT === 'object' ? _LX_SUMMON_FAR_FOOT : null };
    for (const [where, stand] of [['ground', ground], ['platform', ledge]]) {
      for (const master of ['', 'beastmaster', 'skyhunter']) {
        game.paused = false; player._god = true; player.master = master;
        game.monsters = []; game.minions = []; player.pet = null; player.ultPet = null; player.pack = []; player._ballistaTurrets = [];
        const mid = stand.x + Math.min(stand.w / 2, 420);
        player.x = mid - player.w / 2; player.y = stand.y - player.h - 1; player.vx = 0; player.vy = 0; player.facing = 1;
        await wait(400);
        raiseMinion(mid - 50, stand.y - 40, 'skeleton'); raiseMinion(mid + 50, stand.y - 40, 'zombie');
        SKILL_FNS.wildBond(); SKILL_FNS.beastmaster_ult(); SKILL_FNS.ballista_ult();
        const xs = { pet: mid - 30, ult: mid + 20 };
        const pin = setInterval(() => { game.monsters = []; player.vx = 0; player.x = mid - player.w / 2;
          for (const [e, x] of [[player.pet, xs.pet], [player.ultPet, xs.ult]]) if (e) { e.x = x - (e.w || 40) / 2; e.vx = 0; }
          for (const m of game.minions) { m.x = (m.type === 'skeleton' ? mid - 50 : mid + 50) - m.w / 2; m.vx = 0; } }, 16);
        await wait(2600);
        const key = where + ':' + (master || 'base');
        wrap('drawMinions', (args, L) => { const camX = game.camera.x; for (const r of L) {
          const mn = game.minions.slice().sort((a, b) => Math.abs(a.x - camX + a.w / 2 - r.cx) - Math.abs(b.x - camX + b.w / 2 - r.cx))[0];
          if (mn && mn.onGround && !(mn.spawn > 0)) note(key + ':' + mn.type, stand.y - r.bot); } });
        wrap('drawWolf', (args, L) => { const pet = args[0]; if (!pet.onGround) return;
          const k = pet === player.ultPet ? (pet.sprite || 'ultpet') : (master === 'skyhunter' ? 'wolf_sky' : master === 'beastmaster' ? 'wolf_alpha' : 'wolf');
          for (const r of L) note(key + ':' + k, stand.y - r.bot); });
        wrap('drawBallistaTurrets', (args, L) => { const tu = (player._ballistaTurrets || [])[0]; if (!tu) return; const foot = tu.anchorY + 18;
          for (const r of L) { note(key + ':ballista', foot - r.bot); note(key + ':ballistaBack', foot - (r.dy + r.dh * 665 / 768)); note(key + ':ballistaOnSurface', foot - stand.y); } });
        await wait(1200);
        for (const k of Object.keys(orig)) window[k] = orig[k];
        clearInterval(pin);
      }
    }
    out.S = S; return out;
  });
  const rng = (k) => { const a = R.S[k] || []; return a.length ? [Math.min(...a), Math.max(...a)] : null; };
  check(!!R.farFoot && ['wolf', 'wolf_alpha', 'wolf_sky', 'werewolf'].every((k) => R.farFoot[k] > 0), 'every ground pet has a measured far-foot height', R.farFoot);
  for (const where of ['ground', 'platform']) for (const m of ['base', 'beastmaster', 'skyhunter']) {
    const k = where + ':' + m, pet = m === 'skyhunter' ? 'wolf_sky' : m === 'beastmaster' ? 'wolf_alpha' : 'wolf';
    const u = [rng(k + ':skeleton'), rng(k + ':zombie')], p = rng(k + ':' + pet), w = rng(k + ':werewolf'), b = rng(k + ':ballista'), bb = rng(k + ':ballistaBack'), bs = rng(k + ':ballistaOnSurface');
    check(u.every((r) => r && r[0] >= -6 && r[1] <= -1), `${k}: the undead stand on the surface, 1-6 px into it (unchanged)`, u);
    check(!!p && p[1] <= -2 && p[0] >= -7, `${k}: the ${pet}'s lowest paw is 2-7 px under the surface, so its far paws meet it (was 0 - far paws floating)`, p);
    check(!!w && w[1] <= -10 && w[0] >= -17, `${k}: the werewolf's lowest paw is 10-17 px under, so its far HIND paw meets the floor (v0.30.1683, per user: "the back leg still is not on the ground"; 4-10 under before that, 0 - floating - at first)`, w);
    check(!!b && !!bb && !!bs && bs[0] === 0 && bs[1] === 0 && bb[1] <= 1 && bb[0] >= -1 && b[0] >= -26,
      `${k}: the ballista stands on the surface with the back of its base on the foot line (was 4 px under - too deep)`, { lowest: b, back: bb, onSurface: bs });
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); srv.kill(); }
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
