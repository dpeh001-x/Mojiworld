// A boss's dex picture survives meeting him.
// Per the 2026-09-26 bug hunt: once a boss had been drawn, _lxShrinkSlot swapped his over-cap static sprite for its
// right-sized bake (a canvas, no .src), and every dex surface built <img src="${spr.src}"> from it - the MojiDex and
// the Ledger showed a broken picture and the page asked for a file named "undefined". Aetherion after one visit.
//   node scripts/dex_sprite_src_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html', PORT = String(process.argv[3] || 9973);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
const bad404 = []; page.on('response', (r) => { if (r.status() === 404 && /\/undefined$/.test(r.url())) bad404.push(r.url()); });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof openMojidex === 'function', null, { timeout: 180000 });
await page.waitForTimeout(8000);
const r = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player.level = 60; player._god = true; player.invulnerable = 9e9;
  loadMap('sanctum'); game.paused = false;
  // wait until his static sprite has been swapped for its bake - the state that broke the picture
  const t0 = performance.now();
  while (performance.now() - t0 < 20000 && !(BOSS_SPRITES.aetherion && BOSS_SPRITES.aetherion.tagName === 'CANVAS')) { game.paused = false; await sleep(250); }
  const baked = !!(BOSS_SPRITES.aetherion && BOSS_SPRITES.aetherion.tagName === 'CANVAS');
  const dex = _monsterDexSprite('aetherion', monsterTypes.aetherion);
  if (!game.mojidexSeen) game.mojidexSeen = {}; if (!game.bestiary) game.bestiary = {};
  game.mojidexSeen.aetherion = true; game.bestiary.aetherion = 1;
  try { closeAllModals(); } catch (e) {}
  openMojidex(); await sleep(700);
  const imgs = [...document.querySelectorAll('#mojidex-modal img')];
  const broken = imgs.filter((i) => /undefined$/.test(i.getAttribute('src') || '')).map((i) => i.dataset.mk || '?');
  const aeImg = imgs.find((i) => i.dataset.mk === 'aetherion');
  return { baked, dexSrc: dex ? String(dex.src || '').split('/').slice(-2).join('/') : null, imgs: imgs.length, broken, aeSrc: aeImg ? aeImg.getAttribute('src').split('/').slice(-2).join('/') : null };
});
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(r.baked, 'CONTROL: after the Sanctum his static sprite is a baked canvas (the state that broke it)', r.baked);
ok(!!r.dexSrc, 'the dex sprite still names its file', r.dexSrc);
ok(r.imgs >= 1 && r.broken.length === 0, 'no MojiDex picture points at "undefined"', { imgs: r.imgs, broken: r.broken });
ok(!!r.aeSrc && /aetherion/.test(r.aeSrc), "Aetherion's own entry shows his art", r.aeSrc);
ok(bad404.length === 0, 'the page never requested a file named undefined', bad404.length);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
