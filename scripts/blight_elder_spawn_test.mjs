// THE BLIGHT ELDER SHOWS UP (2026-10-03). Per user: "I have yet to see elder arlen spawn, make his spawn rate faster" - the Blight
// Elder, Gloomspore Verge's rare mid-boss (the only Elder with a spawn roll). He rolled 0.5 per visit, and on a win the spawn
// picker stood him on a perch 60% of the time; the only perch his 240 px box fits is the canopy walkway at y 202, so his 244 px
// body began at y -45, above the world. Now his entry is `spawnChance: 1, ground: true`.
//   static: the entry; the respawn drip still leaves him out (a once-per-visit elite, not a common mob);
//   in game: 12 entries to the Verge -> he is there every time, feet on a ground piece, inside the world; the Verge's other
//            walkers still take the perches (the flag is per entry, not per map).
//   node scripts/blight_elder_spawn_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10447);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 400) : '')); };
const game = readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
ok('[1] the Verge rolls him on every visit, on the ground', /\{ type: 'blightElder', count: 1, spawnChance: 1, ground: true \}/.test(game));
ok('[1] spawnFromMap honours a ground entry: no perch roll for it', game.includes('ground: !!r.s.ground }') && game.includes('} else if (platList.length && !(opts && opts.ground) && Math.random() < 0.6'));
ok('[1] the roster cap never seats a gated elite past its count (the split gave two Blight Elders on 2.8% of loads)', game.includes('r.count = r.s.spawnChance != null ? Math.min(r.count, _seat.get(r) || 0) : (_seat.get(r) || 0);'));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof monsterTypes === 'object', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player.level = 70; player._god = true; game.paused = false;
    const mp = MAPS.gloomsporeVerge, ground = mp.platforms.filter((q) => q.type === 'ground'), perches = mp.platforms.filter((q) => q.type === 'platform');
    const drip = mp.spawns.filter((sp) => sp && !sp.boss && sp.spawnChance == null && sp.type).map((sp) => sp.type);
    const out = { drip, visits: [], othersOnPerch: 0 };
    for (let i = 0; i < 12; i++) {
      loadMap('town'); await sleep(150); loadMap('gloomsporeVerge'); await sleep(700);
      const el = game.monsters.filter((m) => m.type === 'blightElder');
      // judge him once he is on camera: mob AI is skipped in the far tier (measured from the CAMERA), and the first ticks are what
      // pull a wide spawn in from the world's edge and seat him on a step he straddles
      const e = el[0]; if (e) for (let t = 0; t < 4; t++) { if (game.camera) { game.camera.x = Math.max(0, Math.min(mp.worldWidth - W_PLAY, e.x + e.w / 2 - W_PLAY / 2)); game.camera.y = 0; } game.time++; updateMonsters(16); }
      const feet = e && e.y + e.h, under = e ? ground.filter((q) => q.x < e.x + e.w && q.x + q.w > e.x).map((q) => q.y) : [];
      out.visits.push(e ? { n: el.length, x: Math.round(e.x), y: Math.round(e.y), feet: Math.round(feet),
        onGround: !!e.onGround && under.length > 0 && feet >= Math.min(...under) - 3 && feet <= Math.max(...under) + 3, inWorld: e.y >= 0 && e.x >= -2 && e.x + e.w <= mp.worldWidth + 2 } : { n: 0 });
      for (const m of game.monsters) if (m.type !== 'blightElder' && perches.some((q) => m.x + m.w / 2 >= q.x && m.x + m.w / 2 <= q.x + q.w && Math.abs(m.y + m.h - q.y) <= 3)) out.othersOnPerch++;
    }
    // the cap split, made deterministic: 20 + 1 into 15 seats with no jitter -> one seat each, then 13 shared 20:1, which leaves the
    // elder a 0.62 remainder that out-ranks the other's 0.38 and took the last seat (two elders) before the clamp
    const sp0 = mp.spawns, nj0 = mp._noSpawnJitter;
    mp.spawns = [{ type: 'meloncholy', count: 20 }, { type: 'blightElder', count: 1, spawnChance: 1, ground: true }]; mp._noSpawnJitter = true;
    loadMap('town'); await sleep(150); loadMap('gloomsporeVerge'); await sleep(500);
    out.split = { elders: game.monsters.filter((m) => m.type === 'blightElder').length, others: game.monsters.filter((m) => m.type === 'meloncholy').length };
    mp.spawns = sp0; if (nj0 === undefined) delete mp._noSpawnJitter; else mp._noSpawnJitter = nj0;
    return out;
  });
  ok('[7] a roster over the cap (20 + 1 into 15 seats, no jitter) seats the elder once, never twice', R.split.elders === 1 && R.split.others >= 13, R.split);
  console.log('visits:', JSON.stringify(R.visits));
  ok('[2] the respawn drip still leaves him out (he is a once-per-visit elite)', !R.drip.includes('blightElder') && R.drip.length >= 4, R.drip);
  ok('[3] he is there on every one of 12 visits, exactly one', R.visits.every((v) => v.n === 1), R.visits.map((v) => v.n));
  ok('[4] each time, once on camera, he stands on the ground pieces under him with his whole box inside the world (never the canopy at y 202)', R.visits.every((v) => v.n === 1 && v.onGround && v.inWorld), R.visits.filter((v) => !(v.onGround && v.inWorld)).slice(0, 3));
  ok('[5] the Verge\'s other walkers still take the perches (the flag is per entry)', R.othersOnPerch > 0, R.othersOnPerch);
  ok('[6] no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
