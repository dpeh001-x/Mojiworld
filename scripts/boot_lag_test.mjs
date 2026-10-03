// A quicker Continue (per user: "Ensure that the fix is good, and reduce the lag"). One real click on Continue the moment the menu
// shows, with a real hero; every decode() started while the boot ready gate runs is logged:
//   - the gate's window decodes the start map, not the world: under 450 decodes (v0.30.1574: ~1,000 / ~530 MP)
//   - no other map's monster frames and no character-creation part the hero does not wear are decoded in it
//   - the hero's own hair is ready when the world appears (not a bald frame)
//   - the deferred warmers still run: a neighbour of town is preloaded within 15 s of the world opening
// node scripts/boot_lag_test.mjs   (MOJI_GAME_FILE / PORT override)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core');
const PORT = +(process.env.PORT || 9188), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 400) + ']' : '')); };
try {
  let blob;   // a real save, made and signed by the game itself
  { const p = await b.newPage(); await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 90000 }); await p.waitForTimeout(11000);
    blob = await p.evaluate(() => { player.cls = 'warrior'; player.level = 40; player.look = player.look || {}; player.look.name = 'ProbeHero';
      window._prologuePending = false; window._prologueActive = false; window._lxAwaitingCreation = false;
      const c = document.getElementById('class-select-modal'); if (c) c.style.display = 'none'; _flushSaveStateNow(); return localStorage.getItem('levelx_save_v1'); });
    await p.close(); }
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage();
  await p.addInitScript((bl) => { try { if (!sessionStorage.getItem('_probe')) { localStorage.setItem('levelx_save_v1', bl); sessionStorage.setItem('_probe', '1'); } } catch (e) {} }, blob);
  await p.addInitScript(() => { const o = HTMLImageElement.prototype.decode; window.__dec = []; HTMLImageElement.prototype.decode = function () {
    if (window._lxReadyGateRunning) window.__dec.push([(this.src || '').split('/').slice(3).join('/'), this.naturalWidth * this.naturalHeight]); return o.call(this); }; });
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await p.waitForFunction(() => { const m = document.getElementById('menu-continue'); return m && m.offsetParent && getComputedStyle(m).display !== 'none'; }, null, { timeout: 150000 });
  const bx = await p.locator('#menu-continue').boundingBox();
  await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.waitForFunction(() => { const o = document.getElementById('loading-overlay'); return !o || o.classList.contains('fade'); }, null, { timeout: 180000 });
  const R = await p.evaluate(() => {
    let hair = null; try { const lc = player.lookCustom || {}; const im = LX_HAIR[_migrateHairId(lc.hairId)]; hair = { id: lc.hairId, ready: !!(im && im.complete && im.naturalWidth > 0) }; } catch (e) { hair = { err: String(e) }; }
    const lc = player.lookCustom || {}, mine = new Set();
    try { mine.add(LX_HAIR[_migrateHairId(lc.hairId)].src); mine.add(LX_EYES[lc.eyeId || 'default'].src); mine.add(LX_EYES['default'].src); mine.add(LX_MOUTH[lc.mouthId || 'default'].src); mine.add(LX_MOUTH['default'].src); } catch (e) {}
    const mineRel = [...mine].map((s) => String(s).split('/').slice(3).join('/'));
    return { dec: window.__dec.slice(), hair, mineRel, neighbours: (typeof _lxMapNeighbors === 'function') ? _lxMapNeighbors(game.currentMap) : [], map: game.currentMap };
  });
  const parts = R.dec.filter((d) => /^Sprites\/character\/(hair|eyes|mouth)\//.test(d[0]) && !R.mineRel.includes(d[0]));
  const mobs = R.dec.filter((d) => /^Sprites\/monsters\//.test(d[0]));
  const mp = R.dec.reduce((a, d) => a + (d[1] || 0), 0) / 1e6;
  ok('the gate window decodes the start map, not the world (< 450 decodes)', R.dec.length < 450, { decodes: R.dec.length, MP: Math.round(mp) });
  ok('no character-creation part the hero does not wear is decoded in it', parts.length === 0, { n: parts.length, e: parts.slice(0, 4).map((d) => d[0]) });
  ok('no other map\'s monster frames are decoded in it (town has no monsters)', R.map !== 'town' || mobs.length === 0, { n: mobs.length, e: mobs.slice(0, 4).map((d) => d[0]) });
  ok('the hero\'s own hair is ready when the world appears', R.hair && R.hair.ready === true, R.hair);
  const pre = await p.waitForFunction((ns) => { const m = window._lxMapPreloaded || {}; return ns.some((n) => m[n]); }, R.neighbours, { timeout: 15000 }).then(() => true, () => false);
  ok('the deferred warmers still run: a neighbour of the start map is preloaded within 15 s of the world opening', pre, R.neighbours);
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
