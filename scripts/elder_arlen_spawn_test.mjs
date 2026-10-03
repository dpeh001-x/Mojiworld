// ELDER ARLEN IS THERE WHEN YOU ARRIVE (2026-10-03). Per user: "distorted arlen also should spawn similar to blight elder". The
// Fractured Reflection's Elder (vigil_vermillion) came only from _lxVermillionTick: ~5 s into a first visit, then 5 minutes of
// play after his death - a clock that outlived leaving the map, so after one kill the map stayed empty on re-entry.
//   in game: entering the Reflection, he is there at once (well inside the old 5 s), exactly one, an Elder, standing on the
//            ground; killed, he stays down while you stay; re-entering brings him straight back, one at a time; and while you
//            stay, the 5 minutes after his death still bring him back.
//   node scripts/elder_arlen_spawn_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10449);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 400) : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof _lxVermillionTick === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player.level = 60; player._god = true; game.paused = false;
    const mp = MAPS.fracturedReflection, ground = mp.platforms.filter((q) => q.type === 'ground');
    const elders = () => game.monsters.filter((m) => m.type === 'vigil_vermillion' && m.currentHp > 0);
    // away and back through the Threshold: town's welcome card pauses the game (the clock, like the sim, waits for it)
    const unpause = () => { const w = document.getElementById('everdawn-welcome-overlay'); if (w) w.style.display = 'none'; game.paused = false; };
    const enter = async (ms) => { loadMap('distortedThreshold'); await sleep(200); unpause(); loadMap('fracturedReflection'); await sleep(50); unpause(); await sleep(ms); return elders(); };
    const out = {};
    // 1. a first visit: there within 1.2 s (the old clock waited 5 s)
    let el = await enter(1200); out.first = el.length;
    const e = el[0];
    if (e) { for (let t = 0; t < 4; t++) { game.camera.x = Math.max(0, Math.min(mp.worldWidth - W_PLAY, e.x + e.w / 2 - W_PLAY / 2)); game.camera.y = 0; game.time++; updateMonsters(16); }
      const feet = e.y + e.h, under = ground.filter((q) => q.x < e.x + e.w && q.x + q.w > e.x).map((q) => q.y);
      out.e = { elder: !!e.isMiniBoss, name: e.name, feet: Math.round(feet), onGround: !!e.onGround && under.length > 0 && feet >= Math.min(...under) - 3 && feet <= Math.max(...under) + 3, y: Math.round(e.y) }; }
    // 2. killed: he stays down while you stay
    for (const m of elders()) m.currentHp = 0; await sleep(2000); out.afterKill = elders().length;
    // 3. re-entry brings him straight back, and re-entering again (he still alive) never makes two
    el = await enter(1200); out.reentry = el.length; el = await enter(1200); out.reentryAgain = el.length;
    // 4. while you stay, the 5 minutes after his death still bring him back
    for (const m of elders()) m.currentHp = 0; await sleep(600); out.downAgain = elders().length;
    game._playMs = (game._playMs || 0) + 5 * 60 * 1000 + 1000; await sleep(800); out.afterFive = elders().length;
    return out;
  });
  console.log('R:', JSON.stringify(R));
  ok('[1] entering the Reflection, Elder Arlen is there at once (inside 1.2 s; the old clock waited 5 s), exactly one', R.first === 1, R.first);
  ok('[1] he is the Elder (mini-boss) named Elder Arlen, standing on the ground', R.e && R.e.elder && /Elder Arlen/.test(R.e.name) && R.e.onGround && R.e.y >= 0, R.e);
  ok('[2] killed, he stays down while you stay', R.afterKill === 0, R.afterKill);
  ok('[3] re-entering brings him straight back (the old clock kept the map empty for 5 minutes)', R.reentry === 1, R.reentry);
  ok('[3] and re-entering again never makes two', R.reentryAgain === 1, R.reentryAgain);
  ok('[4] staying, the 5 minutes after his death still bring him back', R.downAgain === 0 && R.afterFive === 1, { down: R.downAgain, after: R.afterFive });
  ok('[5] no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
