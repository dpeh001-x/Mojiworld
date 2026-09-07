// Clockwork Spire (v0.30.387): the puzzle-piece chests ride their drifting floors
// (tagged and seated at spawn), the drifting bars hold a player who stands, jumps
// and drops onto them under the real loop at 60 and 30 fps, and party-quest EXP
// tapers from Lv 40 (4% of a level per stage) to 1% at Lv 70.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9985); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof _lxFrame === 'function' && typeof loadMap === 'function' && typeof _lxPqStageCapFrac === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.level = 57; player.hp = player.maxHp || 1000; player.invulnerable = 9e9; player._pqSpirePieces = {};
    try { loadMap('clockworkSpire'); } catch (e) { o.mapErr = String(e && e.message); return o; }
    await new Promise((r) => setTimeout(r, 900));   // the piece chests spawn on a timer after the map loads
    const md = game.mapData; const plats = md.platforms.filter((p) => p.type === 'platform');
    const pieces = () => (game.chests || []).filter((c) => c && c._pqPuzzlePiece);
    const gapOf = (c) => { const p = md.platforms.find((q) => q && q._spireFloor === c._spireFloor && q.type === 'platform'); return p ? { gap: +(p.y - (c.y + (c.h || 28))).toFixed(2), inside: c.x + (c.w || 36) / 2 > p.x && c.x + (c.w || 36) / 2 < p.x + p.w } : null; };
    o.pieceCount = pieces().length; o.tagged = pieces().filter((c) => c._spireFloor != null).length;
    o.seated0 = pieces().map(gapOf);
    // drift 600 steps by hand: chests must stay on their bars
    game.paused = true; for (let i = 0; i < 600; i++) { game.time++; _tickSpireDrift(); }
    o.seated600 = pieces().map(gapOf);
    // the bars under the real loop: stand / jump / drop at 60 and 30 fps
    const p3 = plats[3]; const standOn = (p) => { player.x = p.x + p.w / 2 - player.w / 2; player.y = p.y - player.h; player.vx = 0; player.vy = 0; player.onGround = true; };
    const orig = _lxNextFrame; _lxNextFrame = () => {}; await new Promise((r) => setTimeout(r, 200)); game.paused = false;
    const run = (frameMs, frames, keys, jumpEvery) => { let t = performance.now(); lastTime = t; _lxSimAccumMs = 0; standOn(p3); let fell = 0, landings = 0, air = false; for (let i = 0; i < frames; i++) { t += frameMs; game.keys = Object.assign({}, keys); if (jumpEvery && i % jumpEvery === 10) player.vy = -12; _lxFrame(t); if (!player.onGround) air = true; else if (air) { air = false; landings++; } if (player.y + player.h > p3.y + 40) { fell++; standOn(p3); } } return { fell, landings }; };
    o.stand60 = run(1000 / 60, 600, {}, 0); o.stand30 = run(33.3, 600, {}, 0); o.jump30 = run(33.3, 900, {}, 90); o.down60 = run(1000 / 60, 300, { ArrowDown: true, s: true }, 0);
    _lxNextFrame = orig; _lxNextFrame();
    // party-quest EXP cap per stage, by level
    o.cap = { 29: +_lxPqStageCapFrac(29).toFixed(4), 40: +_lxPqStageCapFrac(40).toFixed(4), 57: +_lxPqStageCapFrac(57).toFixed(4), 70: +_lxPqStageCapFrac(70).toFixed(4), 85: +_lxPqStageCapFrac(85).toFixed(4) };
    return o;
  });
  console.log('build ' + r.ver + (r.mapErr ? '  mapErr ' + r.mapErr : ''));
  ok('the four puzzle-piece chests spawn and every one is tagged to its floor', r.pieceCount === 4 && r.tagged === 4, JSON.stringify([r.pieceCount, r.tagged]));
  ok('at spawn each chest sits on its bar (gap 0) over the bar\'s width', Array.isArray(r.seated0) && r.seated0.length === 4 && r.seated0.every((g) => g && Math.abs(g.gap) < 0.6 && g.inside), JSON.stringify(r.seated0));
  ok('after 600 steps of drift the chests are still on their bars', Array.isArray(r.seated600) && r.seated600.length === 4 && r.seated600.every((g) => g && Math.abs(g.gap) < 0.6 && g.inside), JSON.stringify(r.seated600));
  ok('the drifting bars hold a standing player at 60 fps and at 30 fps', r.stand60.fell === 0 && r.stand30.fell === 0, JSON.stringify([r.stand60, r.stand30]));
  ok('a player jumping and landing on a drifting bar at 30 fps never falls through', r.jump30.fell === 0 && r.jump30.landings >= 8, JSON.stringify(r.jump30));
  ok('holding Down does not drop the player through a bar', r.down60.fell === 0, JSON.stringify(r.down60));
  ok('party-quest EXP cap: 4% of a level per stage to Lv 40, ~2.3% at Lv 57, 1% from Lv 70', r.cap[29] === 0.04 && r.cap[40] === 0.04 && Math.abs(r.cap[57] - 0.023) < 0.001 && r.cap[70] === 0.01 && r.cap[85] === 0.01, JSON.stringify(r.cap));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
