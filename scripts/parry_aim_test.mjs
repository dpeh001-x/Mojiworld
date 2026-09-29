// A parried SHOT credits the monster that fired it (per user: "nerf the parry to only damage a single target that the attack
// was parried from"; the Riposte Nova stays an area blast, per user). Before, the parry stunned - and the rogue counter-struck -
// whichever monster stood nearest the player. A far shooter A and a bystander B a step from the player:
//   1. a shot made on a monster's REAL turn carries that monster's uid (_lxSrcUid, stamped by _lxKillStampSince)
//   2. the PRESS-CATCH parry (_lxParryCatch) stuns and counter-strikes A, not B
//   3. the IN-FLIGHT parry (updateProjectiles) does the same
//   4. an unstamped shot still falls back to the nearest monster (B), as before
//   5. the shove is capped: A, 320 px away, is not flung (0.05 x the gap would be ~16 px a frame)
//   6. CONTROL - the Riposte Nova is still an area blast: it hits the bystander B too
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10131); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof startBlock === 'function' && typeof spawnMonster === 'function' && typeof updateProjectiles === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    try { window._playStoryBeat = (id, cb) => { try { cb && cb(); } catch (e) {} }; } catch (e) {}
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    try { loadMap('forest', 400); } catch (e) {} await sleep(400); game.paused = true; player.level = 30; player._god = true; player.cls = 'rogue';
    for (const m of game.monsters.slice()) game.monsters.splice(game.monsters.indexOf(m), 1);
    // 1. a real turn: a shooter fires on its own, and its shot carries its uid
    spawnMonster(player.x + 260, player.y, 'grumpsquid'); const S = game.monsters[game.monsters.length - 1];
    S.currentHp = S.maxHp = 999999; game.projectiles.length = 0; game.paused = false;
    let shotS = null; const w0 = performance.now();
    while (!shotS && performance.now() - w0 < 12000) { await sleep(100); shotS = game.projectiles.find((p) => p && p.owner === 'enemy' && !p._coopMirror); }
    game.paused = true;
    o.real = { fired: !!shotS, skill: shotS && shotS.skill, uid: shotS ? shotS._lxSrcUid : undefined, shooter: S.uid, by: shotS && shotS._lxBy };
    game.monsters.splice(game.monsters.indexOf(S), 1); game.projectiles.length = 0;
    // A far shooter, B a bystander a step away
    spawnMonster(player.x + 320, player.y, 'grumpsquid'); const A = game.monsters[game.monsters.length - 1];
    spawnMonster(player.x + 30, player.y, 'grumpsquid'); const B = game.monsters[game.monsters.length - 1];
    const who = (m) => m === A ? 'A' : m === B ? 'B' : 'other';
    const reset = () => { for (const m of [A, B]) { m.stunTimer = 0; m.vx = 0; m.currentHp = m.maxHp = 999999; }
      A.x = player.x + 320; B.x = player.x + 30; A.y = B.y = player.y + player.h - A.h;
      player.blockCD = 0; player.blockTimer = 0; player.parryWindow = 0; player.invulnerable = 0; player._riposteAt = -9999;
      player.mods = player.mods || {}; player.mods.riposteNova = 0; game.projectiles.length = 0; };
    const shot = (dx, vx) => ({ x: player.x + dx, y: player.y + 10, w: 8, h: 8, vx, vy: 0, owner: 'enemy', damage: 10, skill: 'mbubble', life: 200 });
    const made = (by, p) => { _lxKillStampSince(null); game.projectiles.push(p); _lxKillStampSince(by); return p; };   // made on by's turn
    let hits = []; const realHit = window.hitMonster;
    window.hitMonster = function (m, d, c, s) { hits.push({ who: who(m), s }); return realHit.apply(this, arguments); };
    const credit = () => ({ stunA: (A.stunTimer | 0) > 0, stunB: (B.stunTimer | 0) > 0, counter: hits.filter((h) => h.s === 'melee').map((h) => h.who).join(','), vxA: +(A.vx || 0).toFixed(1) });
    // 2. press-catch
    reset(); made(A, shot(150, -10)); hits = []; startBlock(); o.catch = credit();
    // 3. in flight: the shot is on the player while the window is open
    reset(); made(A, shot(0, 0)); player.parryWindow = 300; player.blockTimer = 300; hits = []; updateProjectiles(16); o.flight = credit();
    // 4. unknown maker -> the nearest, as before
    reset(); made(null, shot(150, -10)); hits = []; startBlock(); o.unknown = credit();
    // 6. the Nova stays an area blast
    reset(); player.mods.riposteNova = 1; const hb = B.currentHp; made(A, shot(150, -10)); hits = []; startBlock();
    o.nova = { bHit: B.currentHp < hb, novaOnB: hits.some((h) => h.s === 'nova' && h.who === 'B') };
    window.hitMonster = realHit;
    return o;
  });
  console.log('  ' + r.ver + ' real ' + JSON.stringify(r.real) + '\n  catch ' + JSON.stringify(r.catch) + ' flight ' + JSON.stringify(r.flight) + ' unknown ' + JSON.stringify(r.unknown) + ' nova ' + JSON.stringify(r.nova));
  ok('A SHOT MADE ON A MONSTER\'S TURN CARRIES ITS UID', r.real.fired && r.real.uid === r.real.shooter, `fired ${r.real.fired} (${r.real.skill}), stamped ${r.real.uid}, shooter ${r.real.shooter}, by ${r.real.by}`);
  ok('PRESS-CATCH: the shooter is stunned and counter-struck, the bystander is not', r.catch.stunA && !r.catch.stunB && r.catch.counter === 'A', JSON.stringify(r.catch));
  ok('IN FLIGHT: the same', r.flight.stunA && !r.flight.stunB && r.flight.counter === 'A', JSON.stringify(r.flight));
  ok('UNKNOWN MAKER: falls back to the nearest monster, as before', r.unknown.stunB && !r.unknown.stunA && r.unknown.counter === 'B', JSON.stringify(r.unknown));
  ok('THE SHOVE IS CAPPED: a shooter 320 px away is not flung', Math.abs(r.catch.vxA) <= 5 && Math.abs(r.flight.vxA) <= 5, `vx ${r.catch.vxA} / ${r.flight.vxA} (0.05 x the gap would be ~-16)`);
  ok('CONTROL - the Riposte Nova is still an area blast (it hits the bystander)', r.nova.bHit && r.nova.novaOnB, JSON.stringify(r.nova));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
