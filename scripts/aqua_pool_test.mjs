// AQUARIUS'S CONDUCTIVE POOL SHOCKS ONCE PER ELECTRIFY (v0.30.1425). The lightning shocked a player in the electrified lane
// every 36 frames through its 90-frame window - three 35%-of-max-HP shocks, 105%, each rooting you in water that slows
// you - with no i-frames and no block. In the running game, with a player standing still mid-lane:
//   1. one electrify = exactly one shock, of 35% of max HP (after the warrior / Aegis cut the hazards take);
//   2. the shock opens a hit-granted i-frame window;
//   3. holding block cuts it to 30%, like every hazard;
//   4. the NEXT electrify shocks again (one per electrify, not one ever).
//   node scripts/aqua_pool_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.argv[2] || process.env.PORT || 10251); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof monsterTypes === 'object', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION, runs: [] };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(600); player.level = 99; player._aegis = false;
    game.paused = false; { const tl = performance.now(); while (!player.onGround && performance.now() - tl < 4000) await sleep(30); } await sleep(200);
    const floor = player.y + player.h, px = player.x;
    game.monsters.length = 0; game.projectiles = []; game.hazards = [];
    spawnMonster(px + 1400, floor - 313, 'zodiac_aquarius', true); const m = game.monsters.filter((x) => x && x.type === 'zodiac_aquarius').pop();
    if (!m) return { err: 'no Aquarius' };
    const quiet = () => { m.x = px + 1400; m.y = floor - m.h; m.vx = 0; m.currentHp = m.maxHp; m._aquaFloodAt = 1e12; m._lightningAt = 1e12; m.patternState = 'idle'; m.patternTimer = -1e9;
      for (let i = game.projectiles.length - 1; i >= 0; i--) if (game.projectiles[i] && game.projectiles[i].owner === 'enemy') game.projectiles.splice(i, 1); };
    const lane = { type: 'meteor_warn', x: px + 14 - 170, y: floor - 20, cx: px + 14, w: 340, h: 36, radius: 170, life: 5400, maxLife: 5400, fireAt: 5400,
      owner: 'enemy', damage: 50, color: '#66aaff', _aquaFlood: true, _sourceLabel: 'a Tidal Lane' };
    const dr = () => (player.cls === 'warrior' && typeof _warriorDr === 'function') ? _warriorDr() : 1;
    // one electrify window, standing still mid-lane: every shock the pool lands, and the i-frames right after the first
    const run = async (block) => {
      game.hazards = [lane]; player.invulnerable = 0; player.hp = getMaxHp();
      const max = getMaxHp(), shocks = []; let iframe = null, lastHp = player.hp;
      lane._aquaElectrified = (game.time | 0) + 90; const t0 = game.time | 0;
      while ((game.time | 0) < t0 + 120) {
        quiet(); player.x = px; player.y = floor - player.h; player.vx = 0; player.vy = 0; player.onGround = true; player.blockTimer = block ? 9999 : 0;
        if (player.hp < lastHp - 0.5 && player._lastDamageSource === "Aquarius's Conductive Pool") { shocks.push(Math.round(lastHp - player.hp)); if (iframe == null) iframe = { inv: player.invulnerable, stamped: player._hitIframeAt === game.time || (game.time - (player._hitIframeAt || -99)) < 4 }; }
        player.hp = max; lastHp = max; await sleep(8);
      }
      player.blockTimer = 0;
      return { shocks, iframe, max, want: Math.floor(max * 0.35 * dr()), wantBlock: Math.floor(max * 0.35 * 0.3 * dr()) };
    };
    out.runs.push(await run(false));
    player.invulnerable = 0; await sleep(700);
    out.runs.push(await run(true));
    player.invulnerable = 0; await sleep(700);
    out.runs.push(await run(false));
    game.paused = true; return out;
  });
  console.log('build ' + r.ver);
  if (r.err) ok('HARNESS: ' + r.err, false);
  else {
    const [a, b, c] = r.runs;
    ok('one electrify, standing in the lane: exactly ONE shock (was one every 36 frames: three, 105% of max HP)', a.shocks.length === 1, a);
    ok('that shock is 35% of max HP (after the warrior cut)', a.shocks.length >= 1 && Math.abs(a.shocks[0] - a.want) <= 2, { got: a.shocks[0], want: a.want });
    ok('the shock opens a hit-granted i-frame window', !!(a.iframe && a.iframe.inv >= 400 && a.iframe.stamped), a.iframe);
    ok('holding block cuts it to 30%, like every hazard', b.shocks.length === 1 && Math.abs(b.shocks[0] - b.wantBlock) <= 2, { got: b.shocks, want: b.wantBlock });
    ok('the next electrify shocks again - one per electrify, not one ever', c.shocks.length === 1, c.shocks);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
