// STATE THAT A RELOAD OR A PAUSE USED TO REWRITE (v0.30.927 audit). Four clocks and one counter:
// the Elder's 5-minute respawn restarted as the 5-second first-visit timer after any reload; a map's world
// state re-rolled the same way; play time (the boss respawn window, the echo-gear cooldown) ran while the
// pause menu was open; and Death Bloom's depth counter was restored inside the try that could throw past it.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/state_guard_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11320';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
// the Meltdown's dodge clause is inside the Octobaby AI, reached only from a live boss pattern: read the source
const src = readFileSync(PAGE, 'utf8');
check(!/player\.dodgeIframes/.test(src), 'the Meltdown no longer tests dodgeIframes, a field nothing writes');
check(/_dodging = \(player\._god \|\| player\.invulnerable > 0 \|\|\s*\n\s*\(player\._dashEvadeUntil/.test(src), 'it tests the rogue dash evade window instead');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const boot = async (page) => { await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadState === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 }); };
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(page);
  // 1 + 2. the two clocks are written into the save
  const before = await page.evaluate(() => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40; player._tutorialSeen = true;
    game._playMs = 600000; game._vermDueAt = 900000;                 // due five minutes of play from now
    game._worldStateByMap = { forest: 'fast', town: null };
    _flushSaveStateNow();
    return { due: game._vermDueAt, ws: game._worldStateByMap, playMs: game._playMs };
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(page);
  const after = await page.evaluate(() => ({ due: game._vermDueAt, ws: game._worldStateByMap, playMs: game._playMs }));
  check(after.due === before.due, 'the Elder\'s respawn clock survives a reload (it restarted at 5 s)', J({ before: before.due, after: after.due }));
  check(after.ws && after.ws.forest === 'fast', 'a map\'s world state survives a reload (a reload re-rolled it away)', J(after.ws));
  // 3. play time does not run while paused
  const pm = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {}
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 900)); game.paused = false; await new Promise((r) => setTimeout(r, 600));
    game.paused = true; const a = game._playMs; await new Promise((r) => setTimeout(r, 900));
    const b = game._playMs; game.paused = false; await new Promise((r) => setTimeout(r, 900));
    const c = game._playMs; return { paused: b - a, running: c - b };
  });
  check(pm.paused === 0 && pm.running > 200, 'play time stops in the pause menu and runs again after it', J(pm));
  // 4. Death Bloom's counter comes back even when the blast throws
  const bloom = await page.evaluate(async () => {
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 700));
    player.mods = player.mods || {}; player.mods.deathBloom = 0.2; game._bloomChain = 0;
    const m1 = spawnMonster(player.x + 120, player.y - 20, 'snail', false, false);
    const m2 = spawnMonster(player.x + 150, player.y - 20, 'snail', false, false);
    if (!m1 || !m2) return { err: 'no spawn' };
    const real = window.hitMonster; let threw = 0;
    window.hitMonster = () => { threw++; throw new Error('probe: a blast that throws'); };
    try { killMonster(m1); } catch (e) {}
    window.hitMonster = real;
    return { threw, chain: game._bloomChain | 0 };
  });
  check(bloom.threw > 0 && (bloom.chain | 0) === 0, 'a Death Bloom blast that throws still gives its depth counter back', J(bloom));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
