// The A press, revised (v0.30.398): a flat 300 ms perfect window for every class,
// a 300 ms look-ahead catch on the press (a shot about to hit is parried, one
// moving away or too far is not), the Tempo perfect dodge for every boss except
// Gravitos, and a class-specific stance animation that rides the player.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10111); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof startBlock === 'function' && typeof updateSmoothFx === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, has: typeof _lxProjWillHit === 'function' && typeof _lxBlockFx === 'function' && typeof LX_BLOCK_FX === 'object' }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true; player.level = 30; player.hp = player.maxHp || 1000;
    // 1. the windows
    o.windows = {}; for (const cls of ['warrior', 'rogue', 'mage', 'archer', 'other']) { player.cls = cls; o.windows[cls] = getBlockProfile().parry; } player.cls = 'warrior';
    // 2. the look-ahead catch
    const press = () => { player.blockCD = 0; player.blockTimer = 0; player.parryWindow = 0; player.invulnerable = 0; game.damageNumbers.length = 0; game._slowmoFrames = 0; try { startBlock(); } catch (e) { return { err: String(e && e.message) }; } return { left: game.projectiles.length, parry: game.damageNumbers.some((d) => d.text === 'PARRY!'), ohko: player._ohkoParry, slowmo: game._slowmoFrames }; };
    const shot = (dx, vx, extra) => Object.assign({ x: player.x + dx, y: player.y + 10, w: 8, h: 8, vx, vy: 0, owner: 'enemy', damage: 10, skill: 'bolt', life: 200 }, extra || {});
    game.projectiles.length = 0; game.projectiles.push(shot(150, -10)); o.incoming = press();               // 15 steps away, closing: caught
    game.projectiles.length = 0; game.projectiles.push(shot(150, 10)); o.leaving = press();                 // same distance, moving away: not
    game.projectiles.length = 0; game.projectiles.push(shot(500, -10)); o.tooFar = press();                 // 50 steps away: not
    game.projectiles.length = 0; game.projectiles.push(shot(150, -10)); game.projectiles.push(shot(-120, 8)); game.projectiles.push(shot(600, -10)); o.volley = press();   // two closing, one too far
    game.projectiles.length = 0; game.projectiles.push(shot(120, 0, { homing: true, vx: 3, vy: 3 })); o.homingNear = press();   // reach 4.2 x 18 = 76 + half box: in reach
    game.projectiles.length = 0; game.projectiles.push(shot(400, 0, { homing: true, vx: 3, vy: 3 })); o.homingFar = press();
    game.projectiles.length = 0;
    // 3. Tempo: every boss except Gravitos
    const tempo = (type) => { for (const m of game.monsters.slice()) { const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1); } spawnMonster(player.x + 300, player.y, type, true); const b = game.monsters.filter((x) => x && x.type === type).pop(); if (!b) return { err: 'no ' + type };
      b.currentHp = b.maxHp; b.patternState = 'idle'; player._zdStacks = 0; player._zdMs = 0; player._zdDodgeId = null; player.dodgeTimer = 10; player.lastDodgeTime = game.time + Math.floor(Math.random() * 1e6);
      game.projectiles.length = 0; game.projectiles.push({ x: player.x - 8, y: player.y - 8, w: player.w + 16, h: player.h + 16, vx: 0, vy: 0, owner: 'enemy', damage: getMaxHp(), skill: 'bolt', life: 50 });
      try { _tickZodiacDodgeReward(16); } catch (e) { return { err: String(e && e.message) }; } game.projectiles.length = 0; player.dodgeTimer = 0; const st = player._zdStacks | 0; game.monsters.splice(game.monsters.indexOf(b), 1); return { stacks: st }; };
    o.tempoKrook = tempo('kingKrook'); o.tempoGrav = tempo('gravitos');
    // 4. the class animation
    o.files = {}; for (const cls of ['warrior', 'rogue', 'mage', 'archer']) { const key = 'block_' + cls; o.files[key] = { index: ((window.LX_SPRITE_FRAME_INDEX && LX_SPRITE_FRAME_INDEX.frames['fx/anim']) || {})[key], base: (await fetch('Sprites/fx/' + key + '.webp')).status, f8: (await fetch('Sprites/fx/anim/' + key + '_8.webp')).status, entry: !!(LX_FX && LX_FX[key]), frames: (_fxAnimFrames(key) || []).length }; }
    const t0 = performance.now(); while (performance.now() - t0 < 15000 && !(_fxAnimFrames('block_rogue') || []).every((f) => f && f.complete && f.naturalWidth > 0)) await sleep(50);
    o.decoded = (_fxAnimFrames('block_rogue') || []).filter((f) => f && f.complete && f.naturalWidth > 0).length; o.dims = (() => { const f = _fxAnimFrames('block_rogue')[0]; return [f.naturalWidth, f.naturalHeight]; })();
    o.bursts = {}; for (const cls of ['warrior', 'rogue', 'mage', 'archer']) { player.cls = cls; player.facing = cls === 'mage' ? -1 : 1; game.smoothFx = []; press(); const b = (game.smoothFx || []).find((f) => f.type === 'spriteBurst' && /^block_/.test(f.spriteKey)); o.bursts[cls] = b ? { key: b.spriteKey, follow: b.follow === player, flipX: b.flipX, life: b.life, gap: b.frameGap, size: Math.round(b.size) } : null; }
    player.cls = 'warrior'; player.facing = 1;
    // the burst rides the player
    game.smoothFx = []; press(); const b = game.smoothFx.find((f) => f.type === 'spriteBurst'); const bx0 = b.x; player.x += 90; updateSmoothFx(1); o.ride = { before: bx0, after: b.x, playerCx: player.x + player.w / 2 }; player.x -= 90; game.smoothFx = [];
    return o;
  });
  console.log('build ' + r.ver + '  windows ' + JSON.stringify(r.windows) + '  incoming ' + JSON.stringify(r.incoming) + '  bursts ' + JSON.stringify(r.bursts));
  ok('the look-ahead, the stance FX and its table exist', r.has === true);
  ok('every class has a flat 300 ms perfect window, and the OHKO window is 300 too', Object.values(r.windows).every((v) => v === 300) && r.incoming.ohko === 300, JSON.stringify([r.windows, r.incoming.ohko]));
  ok('a shot 15 steps out and closing is caught on the press (PARRY!, 20 slow-mo frames)', r.incoming.left === 0 && r.incoming.parry && r.incoming.slowmo >= 20, JSON.stringify(r.incoming));
  ok('the same shot moving away is not; one 50 steps out is not', r.leaving.left === 1 && !r.leaving.parry && r.tooFar.left === 1 && !r.tooFar.parry, JSON.stringify([r.leaving, r.tooFar]));
  ok('a volley: both closing shots go on the one press, the far one stays', r.volley.left === 1 && r.volley.parry, JSON.stringify(r.volley));
  ok('a homing shot within reach is caught, one out of reach is not', r.homingNear.left === 0 && r.homingNear.parry && r.homingFar.left === 1, JSON.stringify([r.homingNear, r.homingFar]));
  ok('Tempo: a perfect dodge through King Krook\'s attack earns a stack; the same through Gravitos\'s earns none', r.tempoKrook && r.tempoKrook.stacks === 1 && r.tempoGrav && r.tempoGrav.stacks === 0, JSON.stringify([r.tempoKrook, r.tempoGrav]));
  ok('the four stance sets ship (base + nine frames, FX entries, index lists nine each) and decode at 512', Object.values(r.files).every((f) => f.index === 9 && f.base === 200 && f.f8 === 200 && f.entry && f.frames === 9) && r.decoded === 9 && r.dims[0] === 512, JSON.stringify([r.files, r.decoded, r.dims]));
  ok('each class\'s press spawns its own stance burst: nine frames at three steps, riding the player, mirrored to its facing', ['warrior', 'rogue', 'mage', 'archer'].every((c) => r.bursts[c] && r.bursts[c].key === 'block_' + c && r.bursts[c].follow && r.bursts[c].life === 27 && r.bursts[c].gap === 3) && r.bursts.mage.flipX === true && r.bursts.warrior.flipX === false, JSON.stringify(r.bursts));
  ok('the burst re-centres on the player every step', r.ride && Math.abs(r.ride.after - r.ride.playerCx) < 0.5 && Math.abs(r.ride.after - r.ride.before - 90) < 0.5, JSON.stringify(r.ride));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
