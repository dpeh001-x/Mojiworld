// TALL ORDINARY MONSTERS ARE IN REACH (v0.30.1434). The body-distance rule bosses get (_lxBossy / _lxMonHitD2) now covers
// any monster whose box is 150 px or more tall or wide. In the running game, the player pressed against the LEFT and the
// RIGHT side of a Blight Elder (240x244), an Elderbark (159x238) and one of Octobaby's legs (octoLegStun, 116x204):
//   Ground Slam (a 140 px blast), a Rampage tick (90 px), Soul Siphon and Nova Step all reach it;
//   CONTROL: a slime 120 px away (centre to centre) is still missed by the 90 px Rampage tick - small monsters keep
//   their exact centre test.
//   node scripts/tall_mob_reach_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.argv[2] || process.env.PORT || 10259); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof SKILL_FNS === 'object' && typeof performAround === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION, mobs: {} };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(600); player.level = 99; player._god = true; player.invulnerable = 1e9;
    game.paused = false; { const tl = performance.now(); while (!player.onGround && performance.now() - tl < 4000) await sleep(30); } await sleep(200);
    const floor = player.y + player.h; player.mods = player.mods || {};
    let cur = null; const hits = {}; const oHit = window.hitMonster;
    window.hitMonster = function (m, dmg, crit, tag) { if (m === cur) hits[tag] = (hits[tag] || 0) + 1; return oHit.apply(this, arguments); };
    const total = () => Object.values(hits).reduce((a, b) => a + b, 0);
    try {
      for (const type of ['blightElder', 'elderbark', 'octoLegStun', 'slime']) {
        game.monsters.length = 0; game.projectiles = []; game.hazards = [];
        const def = monsterTypes[type]; spawnMonster(1200, floor - def.h, type, false);
        const m = game.monsters.filter((x) => x && x.type === type).pop(); if (!m) { out.mobs[type] = { err: 'no spawn' }; continue; }
        cur = m; const bx = 1200, hold = () => { m.x = bx; m.y = floor - m.h; m.vx = 0; m.vy = 0; m.currentHp = m.maxHp = 1e12; m.evasion = 0; };
        const res = { w: Math.round(m.w), h: Math.round(m.h) }; out.mobs[type] = res;
        { const tv = performance.now(); while (!(m._visW > 0) && performance.now() - tv < 5000) { hold(); player.x = bx - 120; player.y = floor - player.h; await sleep(16); } } res.drawn = m._visW > 0;
        game.paused = true;
        if (type === 'slime') {   // control: centre 120 px from the player's, a 90 px tick must still miss it
          hold(); player.x = bx + m.w / 2 - 120 - player.w / 2; player.y = floor - player.h;
          const b = total(); performAround(90, 0.1); res.rampage120 = total() - b; continue;
        }
        for (const side of ['left', 'right']) {
          const place = () => { hold(); player.x = side === 'left' ? bx - player.w - 2 : bx + m.w + 2; player.y = floor - player.h; player.vx = 0; player.vy = 0; player.facing = side === 'left' ? 1 : -1; };
          const once = (name, fn) => { place(); const b = total(); try { fn(); } catch (e) { res[name + ':' + side] = 'ERR ' + e.message; return; } res[name + ':' + side] = total() - b; };
          once('groundSlam', () => performAround(140, 0.1));
          once('rampage', () => performAround(90, 0.1));
          once('siphon', () => SKILL_FNS.soulSiphon());
          once('nova', () => { player.mods.dashNova = 1; player._novaAt = -1e9; _dashNovaBurst(); });
        }
      }
    } finally { window.hitMonster = oHit; game.paused = true; }
    return out;
  });
  console.log('build ' + r.ver);
  for (const [type, res] of Object.entries(r.mobs)) {
    if (res.err) { ok(type + ': ' + res.err, false); continue; }
    ok(`${type} (${res.w}x${res.h}) was drawn before measuring (its attack box is the drawn body)`, res.drawn, null);
    if (type === 'slime') { ok('CONTROL: a slime 120 px away is still missed by a 90 px Rampage tick (small monsters keep the exact test)', res.rampage120 === 0, res.rampage120); continue; }
    for (const side of ['left', 'right'])
      for (const [k, label] of [['groundSlam', 'Ground Slam (140 px)'], ['rampage', 'a Rampage tick (90 px)'], ['siphon', 'Soul Siphon'], ['nova', 'Nova Step']])
        ok(`${type}, player at its ${side}: ${label} reaches it`, res[k + ':' + side] > 0, res[k + ':' + side]);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
