// CHESTS STAND ON THE FLOOR (v0.30.x chest-plant). Per user: "ensure they are all grounded to the floor / platform".
//   node scripts/chest_grounding_test.mjs        (MOJI_GAME_FILE=<build.html>, PORT=<port>)
// Every tier, closed and open, on the forest floor and on a raised platform, spawned both ways the game does it (p.y - 24 like
// the map spawner, p.y - 28 like the clockwork spire). It records the real drawImage calls of drawChests and measures the
// lowest painted pixel against the surface: each must sit 0.4-1.6 px INTO it (the 1 px bite the pets use). Before: closed
// chests sank 2-5 px, open ones 6-10 px, and the spire's closed chests floated 2 px.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '11497';
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })).newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnChest === 'function' && typeof drawChests === 'function', null, { timeout: 180000 });
  const out = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; loadMap('forest'); await wait(2500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) { o.classList.remove('on'); o.style.display = 'none'; } }
    game.paused = false; player._god = true;
    const P = game.mapData.platforms, G = P.filter((q) => q.type === 'ground').sort((a, c) => c.w - a.w)[0];
    const ledge = P.filter((q) => q.type === 'platform' && q.w >= 170 && q.y < G.y - 60).sort((a, c) => c.w - a.w)[0];
    const cache = new WeakMap();
    const bottomFrac = (img) => { if (cache.has(img)) return cache.get(img); const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0); const d = c.getImageData(0, 0, w, h).data; let bot = -1;
      for (let y = h - 1; y >= 0 && bot < 0; y--) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { bot = y; break; }
      const f = (bot + 1) / h; cache.set(img, f); return f; };
    const rows = [];
    for (const [where, surf] of [['ground', G], ['platform', ledge]]) for (const off of [24, 28]) {
      game.chests = []; game.monsters = [];
      const x0 = surf.x + 16; player.x = x0 + 60; player.y = surf.y - player.h - 1;
      ['wood', 'silver', 'gold'].forEach((t, i) => { spawnChest(x0 + i * 24, surf.y - off, t); spawnChest(x0 + 80 + i * 24, surf.y - off, t); game.chests[game.chests.length - 1].opened = true; });
      await wait(900);
      game.camera.x = x0 - 200;   // pin the camera on the row: an off-screen chest is culled, not drawn
      const od = ctx.drawImage, calls = [];
      ctx.drawImage = function (img, ...a) { if (img && a.length >= 4 && (a.length >= 8 ? a[6] : a[2]) >= 30) calls.push({ img, a }); return od.call(this, img, ...a); };
      try { drawChests(); } finally { ctx.drawImage = od; }
      calls.forEach((c, i) => { const ch = game.chests[i]; if (!ch) return; const [, dy, , dh] = c.a.length >= 8 ? c.a.slice(4) : c.a;
        rows.push({ where, off, tier: ch.tier, open: !!ch.opened, gap: Math.round((surf.y - (dy + dh * bottomFrac(c.img))) * 10) / 10 }); });
      if (calls.length !== game.chests.length) rows.push({ where, off, missingDraws: game.chests.length - calls.length });
    }
    return rows;
  });
  const drawn = out.filter((r) => r.gap !== undefined);
  check(drawn.length === 24 && !out.some((r) => r.missingDraws), 'all 24 chests drawn (3 tiers x closed/open x floor/platform x both spawn offsets)', { drawn: drawn.length });
  for (const open of [false, true]) {
    const set = drawn.filter((r) => r.open === open), off = set.filter((r) => !(r.gap <= -0.4 && r.gap >= -1.6));
    check(set.length && !off.length, `every ${open ? 'OPEN' : 'closed'} chest sits 0.4-1.6 px into its floor or platform - not floating, not sunk`, off.length ? off : set.map((r) => r.gap));
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); srv.kill(); }
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
