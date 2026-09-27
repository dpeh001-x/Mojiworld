// The minimap: its old panel and map, with pop-punk sticker SYMBOLS (final polish, minimap-symbols). Per user, after the full
// pop-punk-funk minimap (v0.30.1262): "I prefer the OLD minimap, but just ensure that the symbols are more pop punk style".
// Held: the panel, ground, platforms and camera box are the old ones again; each symbol is a sticker - a white die-cut rim and
// an ink keyline around a flat fill (portal gate, NPC ring, player star); the NPC ring is still hollow; the player's star keeps
// its green. minimap_symbols_test owns each symbol's colour identity; this pins the sticker treatment and the revert.
//   node scripts/minimap_pop_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9948);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof drawMinimap === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.waitForTimeout(3000);
const r = await page.evaluate(async () => {
  for (const x of ['loading-overlay', 'class-select-modal']) { const o = document.getElementById(x); if (o) o.style.display = 'none'; }
  window._prologueActive = false; loadMap('town'); await new Promise((res) => setTimeout(res, 1500));
  game.paused = false; game.monsters.length = 0; drawMinimap();
  const mm = getComputedStyle(document.getElementById('minimap')), nm = getComputedStyle(document.getElementById('minimap-name'));
  const c = document.getElementById('minimap-canvas'), ctx = c.getContext('2d');
  const W = game.mapData.worldWidth || 800, H = game.mapData.worldHeight || 540, sx = c.width / W, S = c.width / 208;
  const win = (cx, cy, rad) => { const x0 = Math.max(0, Math.round(cx - rad)), y0 = Math.max(0, Math.round(cy - rad)); return ctx.getImageData(x0, y0, Math.min(c.width - x0, rad * 2), Math.min(c.height - y0, rad * 2)).data; };
  const count = (d, pred) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (pred(d[i], d[i + 1], d[i + 2], d[i + 3])) n++; return n; };
  const white = (a, b, g, al) => al > 200 && a > 235 && b > 235 && g > 235, ink = (a, b, g, al) => al > 200 && a < 30 && b < 30 && g < 40;
  const po = (game.mapData.portals || [])[0], n0 = (game.npcs || [])[0];
  const sy = (y) => (typeof mmY === 'function') ? mmY(y) : y * (c.height / H);
  const portal = po ? win(po.x * sx, po.y * (c.height / H), 9 * S) : null;
  const npcX = n0 ? (n0.x + (n0.w || 40) / 2) * sx : 0, npcY = n0 ? (n0.y || 436) * (c.height / H) : 0;
  const npc = n0 ? win(npcX, npcY, 5 * S) : null;
  const centre = n0 ? ctx.getImageData(Math.round(npcX), Math.round(npcY), 1, 1).data : null;
  // a die-cut rim is CONTINUOUS: sample 24 points round the ring just outside its ink keyline
  let rimHits = 0;
  if (n0) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; let best = 0;
    for (const rr of [3.6, 3.8, 4.0, 4.2, 4.4]) { const px = ctx.getImageData(Math.round(npcX + Math.cos(a) * rr * S), Math.round(npcY + Math.sin(a) * rr * S), 1, 1).data; if (px[3] > 150) best = Math.max(best, Math.min(px[0], px[1], px[2])); }
    if (best > 190) rimHits++; }
  const pl = win((player.x + player.w / 2) * sx, player.y * (c.height / H), 7 * S);
  return {
    panelBg: mm.backgroundColor, panelImg: mm.backgroundImage, panelDrop: mm.boxShadow, nameBg: nm.backgroundImage,
    portal: portal ? { white: count(portal, white), ink: count(portal, ink), gold: count(portal, (a, b, g, al) => al > 200 && a > 230 && b > 180 && g < 110) } : null,
    npc: npc ? { white: count(npc, white), ink: count(npc, ink), teal: count(npc, (a, b, g, al) => al > 180 && b > 170 && g > 180 && a < 150) } : null,
    npcRim: rimHits,
    npcHollow: centre ? !(centre[3] > 200 && centre[1] > 170 && centre[2] > 180 && centre[0] < 150) : null,
    player: { white: count(pl, white), ink: count(pl, ink), green: count(pl, (a, b, g, al) => al > 200 && b > 200 && a < 180 && g < 200) },
  };
});
await browser.close(); server.kill();
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${c ? '' : JSON.stringify(x).slice(0, 260)}`); };
ok('the old minimap panel is back (plain ink plate, no berry tag, no hard drop)', r.panelImg === 'none' && r.nameBg === 'none' && r.panelDrop === 'none', r);
ok('the portal is a sticker: gold gate, white die-cut rim, ink keyline', r.portal && r.portal.gold > 20 && r.portal.white > 12 && r.portal.ink > 12, r.portal);
ok('the NPC is a sticker ring: teal, white rim, ink keyline', r.npc && r.npc.teal > 8 && r.npc.white > 8 && r.npc.ink > 4, r.npc);
ok('...its white die-cut rim runs round most of it (a sticker, not spray - the old graffiti ring scores ~7/24)', r.npcRim >= 11, { rimHitsOf24: r.npcRim });
ok('...and still hollow (someone to talk to, not a foe)', r.npcHollow === true, r.npcHollow);
ok('the player is a green star sticker with a white rim and ink keyline', r.player.green > 10 && r.player.white > 6 && r.player.ink > 6, r.player);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
