// Taxi rides into a tower set you down at its base (v0.30.x taxi-tower).
//   node scripts/taxi_tower_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Bug hunt: the taxi panel and the world map's "back to" row both overrode loadMap's placement with y=400 - near the
// top of a 14,400-px tower, a few jumps from its summit portals. Driven through the real UI clicks.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10981';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof openTaxi === 'function' && typeof toggleWorldMap === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 120;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player._god = true; player.mojicoins = 1e7;
  });
  const groundOf = () => p.evaluate(() => { const md = game.mapData || {}; return (md.platforms || []).filter((pl) => pl.type === 'ground').reduce((a, pl) => Math.max(a, pl.y), -1); });

  // 1) the taxi panel into each tall tower, and into an ordinary map
  for (const id of ['frozenPeak', 'interdimensionalAscension', 'mushroom']) {
    const r = await p.evaluate(async (id) => {
      const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
      try { closeAllModals(); } catch (e) {}
      loadMap('town', 600); await sleep(900); game.paused = false;
      game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[id] = true; game.taxiCombatRecent = [id];
      openTaxi(); await sleep(400);
      const node = document.querySelector('#taxi-grid [data-map-id="' + id + '"][data-wm-pick]');
      if (!node) return { id, err: 'not pickable' };
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(3500);
      return { id, map: game.currentMap, y: Math.round(player.y + player.h), wh: (game.mapData || {}).worldHeight || null };
    }, id);
    const g = await groundOf();
    console.log('taxi', JSON.stringify({ ...r, groundTop: g }));
    check(!r.err && r.map === id && Math.abs(r.y - g) <= 40, `the taxi panel sets you down on the ground floor of ${id} (feet ${r.y}, ground ${g})`, r);
  }

  // 2) the world map's "back to" row into Frozen Peak
  const W = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    const tower = 'frozenPeak', via = 'frostbiteHollow';
    try { closeAllModals(); } catch (e) {}
    loadMap(via, 300); await sleep(900); game.paused = false;
    let po = game.portals.find((q) => q.dest === tower);
    player.x = po.x - player.w / 2; player.y = ((typeof po.y === 'number') ? po.y : _defaultPortalY(po.x)) - player.h; tryPortal(); await sleep(2500);
    po = game.portals.find((q) => q.dest === via);
    player.x = po.x - player.w / 2; player.y = ((typeof po.y === 'number') ? po.y : _defaultPortalY(po.x)) - player.h; game.paused = false; tryPortal(); await sleep(2000);
    toggleWorldMap(); await sleep(800);
    const btn = document.querySelector('#worldmap-recent button[data-map-id="' + tower + '"]');
    if (!btn) return { err: 'no back-to button' };
    btn.click(); await sleep(3500);
    return { map: game.currentMap, y: Math.round(player.y + player.h) };
  });
  const g2 = await groundOf();
  console.log('worldmap', JSON.stringify({ ...W, groundTop: g2 }));
  check(!W.err && W.map === 'frozenPeak' && Math.abs(W.y - g2) <= 40, 'the world map "back to" row sets you down at Frozen Peak\'s base too', { ...W, groundTop: g2 });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
