// Perfect dodge + colour grammar (v0.30.396): every class's perfect window is at
// least 220 ms, the OHKO window is 200, a perfect parry buys 20 slow-mo frames, the
// A press catches a projectile already on the player, the Tempo perfect dodge counts
// against every boss, and the tells: yellow A on a windup and on a projectile within
// reach, red cross on the meteor marker and the quake band.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10077); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof startBlock === 'function' && typeof triggerParry === 'function' && typeof drawHazards === 'function' && typeof drawProjectiles === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, has: typeof _drawTell === 'function' && typeof _lxParryCatch === 'function' }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true; player.level = 30; player.hp = player.maxHp || 1000;
    // 1. the windows
    o.windows = {}; for (const cls of ['warrior', 'rogue', 'mage', 'archer', 'other']) { player.cls = cls; o.windows[cls] = getBlockProfile().parry; } player.cls = 'warrior';
    // 2. the press: OHKO window, and a projectile already on the player is caught while a far one is not
    player.blockCD = 0; player.blockTimer = 0; player.parryWindow = 0; player.invulnerable = 0; game.projectiles.length = 0; game.damageNumbers.length = 0; game._slowmoFrames = 0;
    game.projectiles.push({ x: player.x + 10, y: player.y + 10, w: 8, h: 8, vx: 0, vy: 0, owner: 'enemy', damage: 10, skill: 'bolt', life: 100 });
    game.projectiles.push({ x: player.x + 400, y: player.y, w: 8, h: 8, vx: 0, vy: 0, owner: 'enemy', damage: 10, skill: 'bolt', life: 100 });
    try { startBlock(); } catch (e) { o.blockErr = String(e && e.message); }
    o.press = { left: game.projectiles.length, farLeft: game.projectiles.some((p) => p.x > player.x + 300), nums: game.damageNumbers.map((d) => d.text), slowmo: game._slowmoFrames, inv: player.invulnerable, ohko: player._ohkoParry };
    game.projectiles.length = 0;
    // 3. a perfect parry on its own: the beat and the i-frames
    game._slowmoFrames = 0; player.invulnerable = 0; try { triggerParry(null); } catch (e) { o.parryErr = String(e && e.message); } o.parry = { slowmo: game._slowmoFrames, inv: player.invulnerable };
    // 4. the tells
    const cap = (fn) => { const c = { strokes: [], texts: [], err: null }; const P = CanvasRenderingContext2D.prototype; const oS = P.stroke, oT = P.fillText;
      P.stroke = function (...a) { c.strokes.push(String(this.strokeStyle)); return oS.apply(this, a); }; P.fillText = function (t, ...a) { c.texts.push(String(t)); return oT.apply(this, [t, ...a]); };
      try { fn(); } catch (e) { c.err = String(e && e.message); } finally { P.stroke = oS; P.fillText = oT; }
      return { yellow: c.strokes.includes('#ffd166'), red: c.strokes.includes('#ff4d4d'), A: c.texts.includes('A'), cross: c.texts.includes('\u2715'), err: c.err }; };
    spawnMonster(player.x + 140, player.y, 'snail', false); const m = game.monsters.filter((x) => x && x.type === 'snail').pop(); m.currentHp = m.maxHp; game.camera.x = Math.max(0, player.x - 200);
    m._tellUntil = _lxFrameNow() + 800; o.tellMob = cap(() => drawMonster(m)); m._tellUntil = 0; o.tellMobOff = cap(() => drawMonster(m));
    const cx = player.x + 200; game.hazards.length = 0;
    game.hazards.push({ type: 'meteor_warn', x: cx, cx, y: 440, radius: 90, life: 40, maxLife: 60, timer: 40, owner: 'enemy', damage: 10 }); o.tellMeteor = cap(() => drawHazards()); game.hazards.length = 0;
    game.hazards.push({ type: 'mob_quake', x: cx - 60, cx, y: 460, w: 120, h: 30, life: 30, maxLife: 60 }); o.tellQuake = cap(() => drawHazards()); game.hazards.length = 0;
    game.projectiles.push({ x: player.x + 120, y: player.y, w: 8, h: 8, vx: 0, vy: 0, owner: 'enemy', damage: 10, skill: 'bolt', life: 100 }); o.tellProjNear = cap(() => drawProjectiles()); game.projectiles.length = 0;
    game.projectiles.push({ x: player.x + 600, y: player.y, w: 8, h: 8, vx: 0, vy: 0, owner: 'enemy', damage: 10, skill: 'bolt', life: 100 }); o.tellProjFar = cap(() => drawProjectiles()); game.projectiles.length = 0;
    // 5. the Tempo perfect dodge counts against every boss (static)
    const src = await (await fetch(location.pathname)).text();
    o.src = { anyBoss: src.indexOf("if (m.isBoss && m.currentHp > 0 && m.type !== 'gravitos') { boss = m; break; }") >= 0, zodiacFilterGone: src.indexOf("if (!(pr._zodiacAttacker || (typeof pr.skill === 'string' && pr.skill.indexOf('zodiac') === 0))) continue;") < 0, toast: src.indexOf("(boss.name || 'the boss') + ' is staggered. PUNISH!'") >= 0 };
    return o;
  });
  console.log('build ' + r.ver + '  windows ' + JSON.stringify(r.windows) + '  press ' + JSON.stringify(r.press) + (r.blockErr ? '  blockErr ' + r.blockErr : ''));
  ok('the tell and the catch exist', r.has === true);
  // v0.30.398 (per user): a flat 300 ms for every class, and the OHKO window matches
  ok('every class has a flat 300 ms perfect window', Object.values(r.windows).every((v) => v === 300), JSON.stringify(r.windows));
  ok('the press sets a 300 ms OHKO-negating window', r.press.ohko === 300, String(r.press.ohko));
  ok('the press catches a projectile already on the player (PARRY!, 20 slow-mo frames, 350 ms i-frames) and leaves the far one alone', r.press.left === 1 && r.press.farLeft && r.press.nums.includes('PARRY!') && r.press.slowmo >= 20 && r.press.inv >= 350, JSON.stringify(r.press));
  ok('a perfect parry buys 20 slow-mo frames on top of its i-frames', r.parry && r.parry.slowmo >= 20 && r.parry.inv >= 350, JSON.stringify(r.parry));
  ok('a monster in its windup wears the yellow A; not otherwise', r.tellMob.yellow && r.tellMob.A && !r.tellMob.err && !r.tellMobOff.A, JSON.stringify([r.tellMob, r.tellMobOff]));
  ok('an enemy meteor marker wears the red cross', r.tellMeteor.red && r.tellMeteor.cross && !r.tellMeteor.err, JSON.stringify(r.tellMeteor));
  ok('a quake band wears the red cross', r.tellQuake.red && r.tellQuake.cross && !r.tellQuake.err, JSON.stringify(r.tellQuake));
  ok('an enemy projectile within reach wears the yellow A; a far one does not', r.tellProjNear.yellow && r.tellProjNear.A && !r.tellProjNear.err && !r.tellProjFar.A, JSON.stringify([r.tellProjNear, r.tellProjFar]));
  ok('the Tempo perfect dodge counts against every boss except Gravitos, and every big enemy projectile', r.src.anyBoss && r.src.zodiacFilterGone && r.src.toast, JSON.stringify(r.src));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
