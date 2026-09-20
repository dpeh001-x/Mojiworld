// A QUEUED BOSS SHOT WAITS FOR THE PAUSE (v0.30.935). Six staggered volleys are scheduled with setTimeout and
// open with _zSafeFire, which answers false while the game is paused — and setTimeout had already fired, so the
// shot was deleted. Tapping a menu on each telegraph quietly cancelled the boss's staggered kit. _zHold defers
// instead: only leaving the map or the boss dying drops the shot.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/paused_volley_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11326';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
// every deferred-fire site asks _zHold before the old guard
const src = readFileSync(PAGE, 'utf8');
const guards = (src.match(/if \(!(?:game\.hazards \|\| !)?_zSafeFire\(m, _mapAt/g) || []).length;
const holds = (src.match(/if \(_zHold\(m, _mapAt/g) || []).length;
check(guards > 0 && holds === guards, 'every staggered boss shot asks _zHold first', J({ guards, holds }));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _zHold === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; player._god = true; loadMap('forest', 300); await new Promise((r) => setTimeout(r, 900));
  });
  // 1. a shot queued while the game is paused fires once play resumes
  const held = await page.evaluate(async () => {
    game.monsters.length = 0;
    const m = spawnMonster(player.x + 300, player.y - 40, 'snail', false, false);
    if (!m) return { err: 'no spawn' };
    const map = game.currentMap; let fired = 0;
    game.paused = true;
    const shot = () => { if (_zHold(m, map, shot)) return; fired++; };
    shot();                                             // this is the setTimeout callback arriving mid-pause
    await new Promise((r) => setTimeout(r, 300));
    const whilePaused = fired;
    game.paused = false;
    await new Promise((r) => setTimeout(r, 400));
    const after = fired;
    game.monsters.length = 0;
    return { whilePaused, after };
  });
  check(!held.err && held.whilePaused === 0 && held.after === 1, 'a shot that arrives during a pause fires once, after the pause', J(held));
  // 2. it is still dropped when the fight is over or the player has left
  const dropped = await page.evaluate(async () => {
    game.monsters.length = 0;
    const m = spawnMonster(player.x + 300, player.y - 40, 'snail', false, false);
    const map = game.currentMap; let fired = 0;
    const shot = () => { if (_zHold(m, map, shot)) return; fired++; };
    game.paused = false;
    game.monsters.length = 0;                            // the boss died
    shot(); await new Promise((r) => setTimeout(r, 250));
    const afterDeath = fired;
    const m2 = spawnMonster(player.x + 300, player.y - 40, 'snail', false, false);
    const shot2 = () => { if (_zHold(m2, 'someOtherMap', shot2)) return; fired++; };
    shot2(); await new Promise((r) => setTimeout(r, 250));
    const afterMapChange = fired;
    game.monsters.length = 0;
    return { afterDeath, afterMapChange };
  });
  check(dropped.afterDeath === 0 && dropped.afterMapChange === 0, 'a shot is still dropped when the boss is gone or the player left the map', J(dropped));
  // 3. an ordinary frame fires straight through
  const plain = await page.evaluate(async () => {
    game.monsters.length = 0; game.paused = false;
    const m = spawnMonster(player.x + 300, player.y - 40, 'snail', false, false);
    const map = game.currentMap; let fired = 0;
    const shot = () => { if (_zHold(m, map, shot)) return; fired++; };
    shot(); const out = { fired }; game.monsters.length = 0; return out;
  });
  check(plain.fired === 1, 'with the game running the shot fires immediately, as before', J(plain));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
