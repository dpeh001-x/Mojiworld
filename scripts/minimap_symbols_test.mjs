// The minimap speaks a symbol language, crisply.
//
// Per user (screenshot of Octopus Grotto): "add further polish and finishing
// on the mini map, especially the symbols." Before: a flat gold rectangle for
// portals, bare colored squares for mobs, no NPCs at all, and a 208x50 backing
// store upscaled soft on any HiDPI screen.
//
// Now: 2x backing store (416x100 behind the same 208x50 element), portals are
// outlined gold ARCHWAYS with a dark doorway cut and a pulsing glow, NPCs are
// hollow teal rings, mobs are dark-ringed dots, bosses are pulsing outlined
// diamonds with a glint, and the player marker gains a grounding ring.
//
// Verified by PIXEL SAMPLING the real minimap canvas after a real loadMap +
// drawMinimap — colors are read back, not assumed.
//   node scripts/minimap_symbols_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof drawMinimap === 'function' && typeof loadMap === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const cs2 = document.getElementById('class-select-modal'); if (cs2) cs2.style.display = 'none';
  player.cls = 'warrior'; player.hp = getMaxHp();
  window._prologueActive = false;
  if (typeof STORY_BEATS === 'object') { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; }
  try { loadMap('town'); } catch (e) {}
  game.paused = true;

  const canvas = document.getElementById('minimap-canvas');
  out.backing = { w: canvas.width, h: canvas.height };
  out.cssW = Math.round(canvas.getBoundingClientRect().width);

  const mctx = canvas.getContext('2d');
  const scaleX = canvas.width / (game.mapData.worldWidth || 2000);
  const scaleY = canvas.height / (game.mapData.worldHeight || 540);
  const S = canvas.width / 208;

  // scan a window for any pixel matching a predicate
  const scan = (cx, cy, rad, pred) => {
    const x0 = Math.max(0, Math.round(cx - rad)), y0 = Math.max(0, Math.round(cy - rad));
    const w = Math.min(canvas.width - x0, rad * 2), h = Math.min(canvas.height - y0, rad * 2);
    if (w <= 0 || h <= 0) return false;
    const d = mctx.getImageData(x0, y0, w, h).data;
    for (let i = 0; i < d.length; i += 4) if (pred(d[i], d[i + 1], d[i + 2], d[i + 3])) return true;
    return false;
  };
  const gold = (r2, g2, b2, a) => a > 200 && r2 > 200 && g2 > 150 && b2 < 130;
  const darkCut = (r2, g2, b2, a) => a > 200 && r2 < 90 && g2 < 60 && b2 < 40;
  const teal = (r2, g2, b2, a) => a > 180 && g2 > 170 && b2 > 180 && r2 < 150;
  const green = (r2, g2, b2, a) => a > 200 && g2 > 200 && r2 < 180 && b2 < 200;
  const bossRed = (r2, g2, b2, a) => a > 200 && r2 > 200 && g2 < 120 && b2 < 140;

  try { drawMinimap(); } catch (e) { out.threw = String(e).slice(0, 120); }

  // portal glyph: gold arch + the dark doorway cut INSIDE it
  const po = (game.mapData.portals || [])[0];
  if (po) {
    const px = po.x * scaleX;
    const py = (typeof po.y === 'number') ? po.y * scaleY : (canvas.height - 7 * S);
    out.portalGold = scan(px, py, 8 * S, gold);
    out.portalDoorway = scan(px, py + 2 * S, 3 * S, darkCut);
  }
  // NPC ring
  const n0 = (game.npcs || [])[0];
  if (n0) {
    const nx = (n0.x + (n0.w || 40) / 2) * scaleX;
    const ny = (n0.y || 436) * scaleY;
    out.npcTeal = scan(nx, ny, 5 * S, teal);
  }
  out.npcCount = (game.npcs || []).length;
  // player marker
  out.playerGreen = scan((player.x + player.w / 2) * scaleX, player.y * scaleY, 6 * S, green);

  // boss diamond
  const t = monsterTypes.legosaurus;
  const m = Object.assign({}, t, { type: 'legosaurus', w: t.w, h: t.h, x: 900, y: 300,
    currentHp: 100000, maxHp: 100000, isBoss: true, boss: true, level: 59 });
  game.monsters.length = 0; game.monsters.push(m);
  try { drawMinimap(); } catch (e) {}
  out.bossRed = scan((m.x + m.w / 2) * scaleX, m.y * scaleY, 6 * S, bossRed);
  const glint = (r2, g2, b2, a) => a > 200 && r2 > 230 && g2 > 230 && b2 > 230;
  out.bossGlint = scan((m.x + m.w / 2) * scaleX, m.y * scaleY, 6 * S, glint);

  game.monsters.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('backing:', JSON.stringify(r.backing), '| css width:', r.cssW);
console.log('portal gold:', r.portalGold, '| doorway cut:', r.portalDoorway);
console.log('npc teal:', r.npcTeal, '(npcs on map:', r.npcCount + ')');
console.log('player green:', r.playerGreen, '| boss red:', r.bossRed, '| glint:', r.bossGlint);

ok('the backing store is 2x (416x100) for crisp symbols',
   r.backing && r.backing.w === 416 && r.backing.h === 100, r.backing);
// The HUD scales the panel (~267 CSS px on this viewport) — which means the
// OLD 208 store was upscaled soft even on 1x screens; the 416 store now
// downsamples crisp. The invariant worth pinning: the on-screen element does
// not grow with the backing store.
ok('...while the on-screen element does NOT grow with the backing store', r.cssW < 350, { cssW: r.cssW });
ok('a portal draws its gold archway', r.portalGold === true, {});
ok('...with the dark doorway cut that makes it read as a gate', r.portalDoorway === true, {});
ok('NPCs appear on the map at all now — as teal rings', r.npcCount > 0 && r.npcTeal === true, { npcs: r.npcCount });
ok('the player marker still reads green', r.playerGreen === true, {});
ok('a boss draws its red diamond', r.bossRed === true, {});
ok('...with the white glint', r.bossGlint === true, {});
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
