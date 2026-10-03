#!/usr/bin/env node
// v0.30.1576 - LEFTOVER MONSTER / NPC PLANT EDITS CHANGE NOTHING (per user, after v0.30.1569 did the same for gear).
// The R-key Monster Plant and key-4 NPC Plant editors are gone, but their edits saved in the browser (localStorage
// lx_mob_yoff / lx_mob_scale / lx_npc_yoff / lx_npc_scale) still beat data/mob_offsets.js and data/npc_offsets.js, so on the
// one browser that ran them every re-plant since July was hidden. This test plants July-style leftovers in a fresh browser:
//   RESOLVE   every planted monster / NPC offset and scale resolves to the committed table - re-planted rows, rows dropped
//             since (blockGary, stormKitty, deranged_kuro) and keys the tables never had
//   DRAW      the foot line (_lxMobPlantDy) and a drawn Emberling are identical with the leftovers in memory and without them
//   ANIMATOR  monster_animator.html (same origin, same leftovers) reports the committed plant values too
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/plant_leftover_edits_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11805);
const LEFT = {   // roughly what the editors left behind in July, plus keys the tables never had
  lx_mob_yoff: { voltipup: 37, mournshade: 2, orange: 1, towerHexer: 12, blockGary: 3, stormKitty: 2, emberling: 25, zz_probe_mob: 9 },
  lx_mob_scale: { bellowsbat: 1.33, cherub: 1.41, emberling: 1.52, deranged_kuro: 1.14, zz_probe_mob: 2 },
  lx_npc_yoff: { Will: -2, Daisy: 9, 'Zz Probe': 7 },
  lx_npc_scale: { Will: 2.5, Guguma: 1.6, 'Zz Probe': 1.8 },
};
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript((L) => { try { localStorage.mojiworld_prologue_seen = '1'; for (const k in L) localStorage.setItem(k, JSON.stringify(L[k])); } catch (e) {} }, LEFT);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof drawMonster === 'function' && typeof _lxMobPlantDy === 'function'
    && window.LX_MOB_OFFSET_DATA && window.LX_MOB_SCALE_DATA && window.LX_NPC_OFFSET_DATA && window.LX_NPC_SCALE_DATA, null, { timeout: 180000 });
  await page.evaluate(() => { if (typeof _lxArt2WantMon === 'function') _lxArt2WantMon('emberling', true); });
  await page.waitForFunction(() => MONSTER_SPRITES.emberling && MONSTER_SPRITES.emberling.naturalWidth > 0 && MONSTER_SPRITE_META.emberling
    && (!window._lxBootHold || window._lxBootHold.stats().open), null, { timeout: 120000 });
  const R = await page.evaluate((L) => {
    const out = {}, cs = (v) => (v > 0 ? Math.max(0.3, Math.min(4, v)) : 1);
    const MO = window.LX_MOB_OFFSET_DATA, MS = window.LX_MOB_SCALE_DATA, NO = window.LX_NPC_OFFSET_DATA, NS = window.LX_NPC_SCALE_DATA;
    out.planted = [Object.keys(_lxMobYOffMap()).length, Object.keys(_lxMobScaleMap()).length, Object.keys(_lxNpcYOffMap()).length, Object.keys(_lxNpcScaleMap()).length];
    out.mobOff = Object.keys(L.lx_mob_yoff).filter((t) => _lxMobYOff(t) !== ((+MO[t]) || 0)).map((t) => t + '=' + _lxMobYOff(t));
    out.mobScale = Object.keys(L.lx_mob_scale).filter((t) => _lxMobScale(t) !== cs(+MS[t])).map((t) => t + '=' + _lxMobScale(t));
    out.npcOff = Object.keys(L.lx_npc_yoff).filter((n) => _lxNpcYOff(n) !== ((+NO[n]) || 0)).map((n) => n + '=' + _lxNpcYOff(n));
    out.npcScale = Object.keys(L.lx_npc_scale).filter((n) => _lxNpcScale(n) !== cs(+NS[n])).map((n) => n + '=' + _lxNpcScale(n));
    // the foot line and a drawn Emberling, with the leftovers in memory (A) and with the in-memory maps emptied (B)
    try { window._lxIsSanctuary = () => false; } catch (e) {}
    game.monsters = []; spawnMonster(600, 380, 'emberling', false); const m = game.monsters[0];
    if (!game.camera) game.camera = { x: 0, y: 0 }; game.camera.x = 0; game.camera.y = 0; player.x = 1400; player.y = 400;
    const main = document.getElementById('game'), P = CanvasRenderingContext2D.prototype, d0 = P.drawImage, pn = performance.now, dn = Date.now;
    const shot = () => { let best = null;
      P.drawImage = function (im, ...a) { if (this.canvas === main && a.length >= 4) { const r = a.slice(-4), t = this.getTransform();
        if (!best || r[2] * r[3] > best.area) best = { area: r[2] * r[3], rect: r.map((v) => +v.toFixed(2)), t: [t.a, t.d, t.e, t.f].map((v) => +v.toFixed(2)) }; }
        return d0.call(this, im, ...a); };
      try { for (let i = 0; i < 4; i++) { best = null; drawMonster(m); } } finally { P.drawImage = d0; }
      return { foot: +_lxMobPlantDy('emberling', false, 768, 100).toFixed(2), blit: best && JSON.stringify([best.rect, best.t]) }; };
    performance.now = () => 50000; Date.now = () => 1.7e12;
    try { out.A = shot(); _LX_MOB_YOFF_LS = {}; _LX_MOB_SCALE_LS = {}; out.B = shot(); } finally { performance.now = pn; Date.now = dn; }
    out.drew = !!m;
    return out;
  }, LEFT);
  ok('setup: the leftovers are planted in all four browser layers', R.planted.join() === '8,5,3,3', R.planted.join());
  ok('RESOLVE: monster offsets - re-planted, dropped and never-committed types - come from mob_offsets.js', R.mobOff.length === 0, R.mobOff.join(', ') || 'all committed');
  ok('RESOLVE: monster sizes come from mob_offsets.js (incl. a row dropped since)', R.mobScale.length === 0, R.mobScale.join(', ') || 'all committed');
  ok('RESOLVE: NPC offsets come from npc_offsets.js', R.npcOff.length === 0, R.npcOff.join(', ') || 'all committed');
  ok('RESOLVE: NPC sizes come from npc_offsets.js', R.npcScale.length === 0, R.npcScale.join(', ') || 'all committed');
  ok('DRAW: the Emberling\'s foot line is the same with the leftovers in memory as without', R.A.foot === R.B.foot, R.A.foot + ' vs ' + R.B.foot);
  ok('DRAW: the drawn Emberling is the same blit with the leftovers in memory as without', R.drew && !!R.A.blit && R.A.blit === R.B.blit, R.A.blit + (R.A.blit === R.B.blit ? '' : ' vs ' + R.B.blit));
  // the animator, same origin and same leftovers
  const ap = await ctx.newPage(); ap.on('pageerror', (e) => errs.push('animator: ' + String(e).slice(0, 120)));
  await ap.goto(`http://localhost:${PORT}/monster_animator.html?nojump`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await ap.waitForFunction(() => window.__core && window.__core.plantScale && window.LX_MOB_SCALE_DATA && window.LX_MOB_OFFSET_DATA, null, { timeout: 120000 });
  const A = await ap.evaluate((L) => { const cs = (v) => (v > 0 ? Math.max(0.3, Math.min(4, v)) : 1), C = window.__core, MO = window.LX_MOB_OFFSET_DATA, MS = window.LX_MOB_SCALE_DATA;
    return { off: Object.keys(L.lx_mob_yoff).filter((t) => C.plantYOff(t) !== ((+MO[t]) || 0)), scale: Object.keys(L.lx_mob_scale).filter((t) => C.plantScale(t) !== cs(+MS[t])) }; }, LEFT);
  ok('ANIMATOR: plant offsets and sizes come from mob_offsets.js too', A.off.length === 0 && A.scale.length === 0, [...A.off, ...A.scale].join(', ') || 'all committed');
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
