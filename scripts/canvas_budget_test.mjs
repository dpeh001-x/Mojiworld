// CANVAS MEMORY STAYS BOUNDED (per user, a tester's videos: "the monsters appear to be blinking as a glitch" and "his map
// background images are not loaded"). Every decode pin, shrink bake and backdrop bake used to live for the session:
// at DPR 2, 290 MB of canvas after the town, 1.8 GB after nine maps, 2.5 GB after the Gravitos arena. Past WebKit's
// canvas-memory cap (Safari, every iPad / iPhone browser) new canvases come back unusable and Chrome drops canvases under GPU
// memory pressure - so the backdrop baked at map entry and a monster's next frame drew nothing. A tour of 12 maps at
// DPR 2, every canvas the game makes recorded (WeakRefs, gc between maps):
//   1. live canvas memory after the tour stays under 1200 MB (the build before: ~1.8 GB by map 9)
//   2. the shared budget is in force: tracked copies stay near it (a soft line: copies drawn in the last 15 s are
//      never released) and copies were released
//   3. nothing draws empty: every backdrop and monster sprite drawn on the game canvas during the tour had pixels
//      (a released copy is never cleared - its slot gets the source image back)
//   4. the sprite heal list holds no canvas copies once boot is done (it held every pinned frame it was fed)
//   [MOJI_SERVE_ROOT / PORT] node scripts/canvas_budget_test.mjs      (serves mojiworld_game.html)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10057); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--js-flags=--expose-gc'] });
const page = await browser.newPage({ viewport: { width: 1512, height: 860 }, deviceScaleFactor: 2 });
await page.addInitScript(() => {
  try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
  const reg = window.__cv = []; const ce = Document.prototype.createElement;
  Document.prototype.createElement = function (t) { const el = ce.apply(this, arguments); if (String(t).toLowerCase() === 'canvas') reg.push(new WeakRef(el)); return el; };
  window.__cvMB = () => { if (window.gc) gc(); let px = 0; for (const r of reg) { const c = r.deref(); if (c) px += (c.width | 0) * (c.height | 0); } return Math.round(px * 4 / 1048576); };
});
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const MAPS = ['town', 'forest', 'mushroom', 'glimmerwood', 'everdawn_megamall', 'bastion', 'lavaCavern', 'coralReef', 'duneSands', 'cadetsStrand', 'tidalLagoon', 'candyCanyon'];
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const mb = [];
  const R = { empties: [], draws: 0 };
  await page.evaluate(() => {
    for (const o of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(o); if (e) e.style.display = 'none'; }
    window._lxBootGateDone = true; window._lxSpriteGateDone = true; window._prologueActive = false; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._god = true;
    // every drawImage onto the game canvas: a source with no pixels is an empty draw
    const P = CanvasRenderingContext2D.prototype, o = P.drawImage; window.__empty = []; window.__draws = 0;
    P.drawImage = function (im) { if (this === ctx) { window.__draws++; const w = im && (im.tagName === 'IMG' ? (im.complete ? im.naturalWidth : 1) : im.width); if (im && !w && window.__empty.length < 20) window.__empty.push(String(im.tagName) + ' ' + (im.src || im._lxSrc && im._lxSrc.src || '').slice(-60)); } return o.apply(this, arguments); };
  });
  for (const id of MAPS) {
    const r = await page.evaluate(async (id) => {
      loadMap(id, 400); const t = performance.now();
      while (performance.now() - t < 6000) { game.paused = false; player.x = 300 + ((performance.now() - t) / 6000) * 1400; await new Promise((r) => setTimeout(r, 100)); }
      return __cvMB();
    }, id);
    mb.push(r);
  }
  const S = await page.evaluate(() => ({ empties: window.__empty, draws: window.__draws, lru: typeof _lxCvLru === 'undefined' ? null : { px: _lxCvLruPx, budget: _LX_CV_BUDGET_PX, evicted: _lxCvEvicted },
    watch: (window._lxSpriteWatch || []).length, watchCv: (window._lxSpriteWatch || []).filter((im) => im && im.tagName === 'CANVAS').length, ver: GAME_VERSION }));
  console.log('build', S.ver, 'MB by map', mb.join(' '), 'lru', JSON.stringify(S.lru), 'draws', S.draws);
  ok('1. live canvas memory after a 12-map tour at DPR 2 stays under 1200 MB', mb[mb.length - 1] < 1200, mb.join(' '));
  ok('2. the shared budget is in force: tracked copies stay near it (recent ones are never released) and copies were released', !!S.lru && S.lru.px <= S.lru.budget * 1.5 && S.lru.evicted > 0, JSON.stringify(S.lru));
  ok('3. nothing drawn on the game canvas was empty (backdrops, monsters, props, NPCs)', S.draws > 1000 && S.empties.length === 0, S.empties.slice(0, 4).join(' | '));
  ok('4. the sprite heal list holds no canvas copies after boot (it held every pinned frame)', S.watchCv === 0, S.watchCv + ' copies of ' + S.watch);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL  the harness runs to the end  ' + JSON.stringify(String(e.message).slice(0, 300))); }
finally { await browser.close(); server.kill(); }
console.log(fail ? `FAIL(${fail}) - ${pass} passed, ${fail} failed` : `PASS(0) - ${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
