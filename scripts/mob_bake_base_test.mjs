// Live test: A MONSTER'S BAKED RASTER IS NEVER UP-SCALED ON SCREEN.
//
// Per user: "ossuarytyrant sprites look blur could you please assist to make it
// more HQ similar to other sprites". The lazy frame shrink (v0.29.284) bakes each
// frame to a right-sized canvas and promises the final blit is always a DOWN-scale
// of it. v0.29.707 sized the monster base as box x 4 with a 480 ceiling; the
// v0.30.420 boxes outgrew the ceiling, so the tyrant drew a 789 px blit from a
// 710 px raster (11% up-scale = the blur). The base now follows the draw formula.
//
// Measured the way the game draws it: each type spawned alone in the forest with
// the loop running, pinned in view and out of attack range, its idle/walk arrays
// baked at the current cap. Two views of the same invariant:
//   1. end to end, for the two big types: drawImage spied for one window, the
//      monster's own blit resolved through the bake's source pointers, raster
//      size vs the on-screen dest rect;
//   2. per frame, for every type: each baked raster in MONSTER_FRAMES against the
//      draw it serves (m._visW/_visH x the state's scales x render scale) and
//      against its cap. (Small types draw through a blit-sized cache canvas that
//      carries no source pointer, so view 1 cannot name them; view 2 can.)
//   node scripts/mob_bake_base_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8731; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof loadMap === 'function' && typeof _mobFrameBase === 'function' && typeof _lxShrinkCap === 'function', null, { timeout: 120000 });
await page.waitForTimeout(6000);
await page.evaluate(async () => {
  try { _lxBootGateDone = true; } catch (e) {} try { _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  try { window._lxIsSanctuary = () => false; } catch (e) {}
  try { loadMap('forest', 300); } catch (e) {}
  await new Promise(r => setTimeout(r, 600));
  player.invulnerable = 9e9; player.hp = player.maxHp = 999999; player.level = 99;
  game.paused = false;
  await new Promise(r => setTimeout(r, 400));
});
const TYPES = ['ossuaryTyrant', 'blightElder', 'echoKnight', 'pathsBane', 'slime'];
const out = {};
for (const type of TYPES) {
  out[type] = await page.evaluate(async (type) => {
    const def = monsterTypes[type]; if (!def) return { err: 'no def' };
    game.monsters = [];
    player.x = 60; player.vx = 0;
    const spawnX = player.x + 420;   // in the 960-logical view, out of attack range
    try { spawnMonster(spawnX, player.y + player.h - (def.h || 40), type, false); } catch (e) { return { err: String(e).slice(0, 120) }; }
    const m = game.monsters.filter((x) => x && x.type === type).pop(); if (!m) return { err: 'not spawned' };
    game.paused = false;
    const pin = setInterval(() => { m.x = spawnX; m.vx = 0; player.x = 60; player.vx = 0; }, 30);
    const t0 = performance.now();
    while (performance.now() - t0 < 12000) {
      const set = MONSTER_FRAMES[type]; const cap = _lxShrinkCap(_mobFrameBase(m));
      if (set && set.idle && set.walk && set.idle._lxShrunk && set.walk._lxShrunk && set.idle._lxShrunkCap === cap && set.walk._lxShrunkCap === cap) break;
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 400));
    // view 1: the blit
    const blits = []; const orig = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      try { if (this === ctx) {
        const dr = a.length >= 8 ? [a[4], a[5], a[6], a[7]] : a.length >= 4 ? [a[0], a[1], a[2], a[3]] : [a[0], a[1], img.width || img.naturalWidth, img.height || img.naturalHeight];
        if (dr[2] > 24 && dr[3] > 24) { const t = this.getTransform(); const px = (x, y) => ({ x: t.a * x + t.c * y + t.e, y: t.b * x + t.d * y + t.f });
          const c1 = px(dr[0], dr[1]), c2 = px(dr[0] + dr[2], dr[1] + dr[3]);
          let under = img, hops = 0; while (under && !under.src && hops++ < 4) under = under._lxBboxSrc || under._lxEdgeSrc || under._lxSrc || under._lxTintSrc || null;
          blits.push({ rasterW: img.width || img.naturalWidth, rasterH: img.height || img.naturalHeight, src: under && under.src ? under.src.split('/').slice(-2).join('/') : null, w: Math.abs(c2.x - c1.x), h: Math.abs(c2.y - c1.y) }); } } } catch (e) {}
      return orig.call(this, img, ...a);
    };
    await new Promise(r => setTimeout(r, 400));
    CanvasRenderingContext2D.prototype.drawImage = orig; clearInterval(pin);
    const mine = blits.filter((bl) => bl.src && bl.src.toLowerCase().includes(type.toLowerCase())); const p = mine[mine.length - 1] || null;
    // view 2: every frame against the draw it serves
    const dpr = _LX_DPR, base = _mobFrameBase(m), cap = _lxShrinkCap(base);
    const oldRule = Math.max(160, Math.min(480, Math.ceil(Math.max(m.w || 0, m.h || 0) * 4)));
    const visLong = Math.max(m._visW || 0, m._visH || 0);
    const set = MONSTER_FRAMES[type] || {}; let minRatio = Infinity, maxBaked = 0, nBaked = 0, nDecoded = 0, worst = null;
    for (const st of ['idle', 'walk', 'attack']) {
      const c = _lxAnimCalib(type, st); let s = (c && +c.s > 0) ? +c.s : 1; if (st === 'attack') s *= (_ATK_FRAME_SCALE[type] || 1);
      for (const im of (set[st] || [])) {
        if (!im) continue; const rl = Math.max(im.naturalWidth || im.width || 0, im.naturalHeight || im.height || 0); if (!(rl > 0)) continue;
        let fs = 1; if (st === 'attack' && c && Array.isArray(c.fs) && c.fs[im._lxFi] > 0) fs = c.fs[im._lxFi];
        const need = visLong * s * fs * dpr; nDecoded++;
        const ratio = rl / need; if (ratio < minRatio) { minRatio = ratio; worst = st + '/' + (im._lxFi ?? '?') + ' ' + rl + ' vs ' + Math.round(need); }
        if (im.tagName === 'CANVAS' && !(im.src)) { nBaked++; if (rl > maxBaked) maxBaked = rl; }   // pinned canvases carry src and are not bakes
      }
    }
    return { state: m._frameIsAttack ? 'attack' : (_mobWalking(m) ? 'walk' : 'idle'), box: m.w + 'x' + m.h, vis: Math.round(m._visW) + 'x' + Math.round(m._visH), dpr: +dpr.toFixed(3), base, cap, oldRule,
      blit: p ? { raster: p.rasterW + 'x' + p.rasterH, blit: Math.round(p.w) + 'x' + Math.round(p.h), upscale: +(Math.max(p.w, p.h) / Math.max(p.rasterW, p.rasterH)).toFixed(3), src: p.src } : null,
      frames: { decoded: nDecoded, baked: nBaked, minRatio: +minRatio.toFixed(3), worst, maxBaked } };
  }, type);
  console.log(type.padEnd(14), JSON.stringify(out[type]));
}
const T = out.ossuaryTyrant, B = out.blightElder;
ok('end to end: the Ossuary Tyrant draws from a raster at least as large as its blit (was 789 px from 710, an 11% up-scale = the blur)', T && T.blit && T.blit.upscale <= 1.02, T && T.blit);
ok('end to end: Blight Elder too (was 4% over)', B && B.blit && B.blit.upscale <= 1.02, B && B.blit);
ok('per frame: no decoded frame of any type is smaller than the draw it serves (state scales and render scale in)', TYPES.every((k) => out[k] && !out[k].err && out[k].frames.decoded > 0 && out[k].frames.minRatio >= 0.99), TYPES.map((k) => k + ':' + (out[k] && out[k].frames && out[k].frames.minRatio)));
ok('per frame: no baked raster exceeds its cap (memory stays bounded by the base rule)', TYPES.every((k) => out[k] && !out[k].err && out[k].frames.maxBaked <= out[k].cap + 1), TYPES.map((k) => k + ':' + (out[k] && out[k].frames && out[k].frames.maxBaked + '<=' + out[k].cap)));
ok('the base covers the observed draw in logical px and never drops below the old rule', TYPES.every((k) => out[k] && !out[k].err && out[k].base >= out[k].oldRule && out[k].base * 1.001 >= Math.max(...out[k].vis.split('x').map(Number))), TYPES.map((k) => k + ':' + (out[k] && out[k].base + ' vs ' + out[k].vis)));
ok('types the old rule already covered keep exactly their old base (slime 188, Paths Bane 480)', ['slime', 'pathsBane'].every((k) => out[k] && !out[k].err && out[k].base === out[k].oldRule), ['slime', 'pathsBane'].map((k) => k + ':' + (out[k] && out[k].base + '/' + out[k].oldRule)));
const ek = out.echoKnight;
ok('a type whose attack padding outgrows the old rule carries its need (Echo Knight 480 -> ~508)', ek && !ek.err && ek.base > ek.oldRule && ek.base <= ek.oldRule * 1.12, ek && { base: ek.base, oldRule: ek.oldRule });
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); try { srv.kill(); } catch (e) {}
process.exit(results.every(q => q.pass) ? 0 : 1);
