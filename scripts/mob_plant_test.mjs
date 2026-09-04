// Planted feet (v0.30.383): an ordinary grounded monster stops moving for the
// length of its attack animation - the chase no longer drives it, it does not
// jump, the walk latch drops so attack frames start on a still body - and it
// resumes the chase afterwards. Bosses and airborne monsters are not planted; a
// knockback still shoves a planted monster and dies out. Also pins the bug found
// on the way: a chasing monster at rest could never start moving (the drift kill
// ate the 0.1/tick acceleration). Gauged on the Echo Knight (per user: the snail
// has no dedicated attack sprites).
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9941); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof updateMonsters === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  await page.evaluate(() => { try { _lxBootGateDone = true; } catch (e) {} try { _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } });
  const g = await page.evaluate(async () => {
    const o = { ver: typeof GAME_VERSION === 'string' ? GAME_VERSION : '?', has: typeof _lxMobPlanted === 'function' };
    try { loadMap('forest', 300); } catch (e) { o.mapErr = String(e && e.message); }
    await new Promise((r) => setTimeout(r, 400));
    game.paused = false; player.hp = Math.max(1, player.hp || 1);
    const set = _monsterFramesFor('echoKnight'); const t0 = performance.now();
    while (!(set.attack && set.attack[8] && set.attack[8].complete && set.attack[8].naturalWidth > 0) && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50));
    spawnMonster(player.x + 320, player.y, 'echoKnight'); const list = game.monsters.filter((x) => x && x.type === 'echoKnight'); const m = list[list.length - 1];
    if (!m) return Object.assign(o, { spawnErr: 'no echoKnight' });
    m.currentHp = m.maxHp || 100; m.atkAnimUntil = 0; m._swingUntil = 0; m._proxRestUntil = performance.now() + 60000; m._bigMeleeCd = 60000; m.jump = 0;   // no swings or jumps of its own during the run (a monster mid-jump is not planted, by design)
    const tick = (n) => { for (let i = 0; i < n; i++) { m.aggroTarget = player; game.time++; updateMonsters(16); } };
    tick(30);   // land
    o.onGround = !!m.onGround;
    // the chase from rest (the bug): it must get going
    const x0 = m.x; tick(30); o.chaseDx = +(x0 - m.x).toFixed(1); o.chaseVx = +Math.abs(m.vx || 0).toFixed(2); o.walkingWhileChasing = !!_mobWalking(m);
    // the attack begins: it plants
    m._animSt = null; m.atkAnimUntil = performance.now() + 1500;
    tick(8); o.plantedFlag = o.has ? _lxMobPlanted(m) : null; o.vxAfter8 = +Math.abs(m.vx || 0).toFixed(3);
    const x1 = m.x; tick(30); o.plantDx = +Math.abs(m.x - x1).toFixed(2); o.walkingWhilePlanted = !!_mobWalking(m);
    const f = _monsterStateFrame(m); o.attackFrameShown = set.attack.indexOf(f) >= 0;
    // a shove still lands, and dies out
    m.vx = 4; tick(1); o.vxAfterShove1 = +Math.abs(m.vx || 0).toFixed(2); tick(8); o.vxAfterShove9 = +Math.abs(m.vx || 0).toFixed(3);
    // a big-melee telegraph plants too
    m.atkAnimUntil = 0; m._swingUntil = 0; m._bigMeleeFiring = true; m._bigMeleeT = 550; o.telegraphPlanted = o.has ? _lxMobPlanted(m) : null; m._bigMeleeFiring = false; m._bigMeleeT = 0;
    // the attack ends: the chase resumes from rest
    m.atkAnimUntil = 0; m._swingUntil = 0; m._proxRestUntil = performance.now() + 60000; m._animSt = null;
    tick(3); o.resumePlanted = o.has ? _lxMobPlanted(m) : null;
    const x2 = m.x; tick(40); o.resumeDx = +Math.abs(m.x - x2).toFixed(1); o.resumeVx = +Math.abs(m.vx || 0).toFixed(2); o.walkingAfter = !!_mobWalking(m);
    // exclusions
    const now = performance.now();
    o.bossPlanted = o.has ? _lxMobPlanted({ isBoss: true, onGround: true, atkAnimUntil: now + 1000 }) : null;
    o.airPlanted = o.has ? _lxMobPlanted({ onGround: false, atkAnimUntil: now + 1000 }) : null;
    o.dashPlanted = o.has ? _lxMobPlanted({ onGround: true, _dashing: true, atkAnimUntil: now + 1000 }) : null;
    o.plainPlanted = o.has ? _lxMobPlanted({ onGround: true, atkAnimUntil: now + 1000 }) : null;
    return o;
  });
  console.log('build ' + g.ver + (g.mapErr ? '  mapErr ' + g.mapErr : '') + (g.spawnErr ? '  ' + g.spawnErr : ''));
  ok('_lxMobPlanted exists', g.has === true);
  ok('an Echo Knight at rest starts its chase (moves toward the player, walk cycle on)', g.onGround === true && g.chaseDx > 3 && g.chaseVx > 0.3 && g.walkingWhileChasing === true, JSON.stringify([g.onGround, g.chaseDx, g.chaseVx, g.walkingWhileChasing]));
  ok('when its attack begins it plants: no drive, speed gone within 8 ticks', g.plantedFlag === true && g.vxAfter8 < 0.05, JSON.stringify([g.plantedFlag, g.vxAfter8]));
  ok('it does not slide during the swing (< 1.5px over 30 ticks) and the walk latch is down', g.plantDx < 1.5 && g.walkingWhilePlanted === false, JSON.stringify([g.plantDx, g.walkingWhilePlanted]));
  ok('the picker shows an attack frame on the still body', g.attackFrameShown === true);
  ok('a shove still lands on a planted monster and dies out', g.vxAfterShove1 > 1 && g.vxAfterShove1 < 3 && g.vxAfterShove9 < 0.1, JSON.stringify([g.vxAfterShove1, g.vxAfterShove9]));
  ok('a big-melee telegraph plants as well', g.telegraphPlanted === true);
  ok('when the attack ends the chase resumes from rest', g.resumePlanted === false && g.resumeDx > 3 && g.resumeVx > 0.3 && g.walkingAfter === true, JSON.stringify([g.resumePlanted, g.resumeDx, g.resumeVx, g.walkingAfter]));
  ok('bosses, airborne and dashing monsters are never planted; a plain grounded one is', g.bossPlanted === false && g.airPlanted === false && g.dashPlanted === false && g.plainPlanted === true, JSON.stringify([g.bossPlanted, g.airPlanted, g.dashPlanted, g.plainPlanted]));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
