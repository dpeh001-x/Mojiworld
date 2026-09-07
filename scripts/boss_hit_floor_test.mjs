// Boss hit floor (v0.30.397): every hit King Krook, Octobaby and the four tentacles
// land deals at least 15% of the player's max HP - contact and projectile - after
// armour, before the difficulty scale; a raised block takes its 70% off the floor;
// other monsters and god mode are untouched.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10103); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof updateProjectiles === 'function' && typeof loadMap === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, has: typeof _lxBossHpFloor === 'function' && typeof LX_BOSS_HIT_FLOOR === 'object' }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true; player.level = 57; player.cls = 'mage'; player._god = false; game.difficulty = 'normal';
    const M = getMaxHp(); o.maxHp = M; const F = Math.floor(M * 0.15); o.floor = F;
    // 1. the helper
    player.blockTimer = 0;
    o.unit = { krook: _lxBossHpFloor('kingKrook', 10), stun: _lxBossHpFloor('octoLegStun', 10), octo: _lxBossHpFloor('octobaby', 10), snail: _lxBossHpFloor('snail', 10), big: _lxBossHpFloor('kingKrook', M) };
    player.blockTimer = 500; o.unitBlock = _lxBossHpFloor('kingKrook', 1); player.blockTimer = 0;
    player._god = true; o.unitGod = _lxBossHpFloor('kingKrook', 10); player._god = false;
    // 2. a projectile end to end: the same 1-damage fireball with and without the source stamp
    const oldEva = window.getEvasion; window.getEvasion = () => 0;
    const shoot = (srcType) => { game.projectiles.length = 0; player.hp = M; player.invulnerable = 0; player.blockTimer = 0; player.parryWindow = 0; player._dashEvadeUntil = 0; player.dodgeTimer = 0; player.quickDashTimer = 0; player.hitStun = 0;
      const p = { x: player.x + player.w / 2 - 4, y: player.y + player.h / 2 - 4, w: 8, h: 8, vx: 0, vy: 0, owner: 'enemy', skill: 'firebomb', damage: 1, life: 100 }; if (srcType) p._srcType = srcType; game.projectiles.push(p);
      game.paused = false; try { updateProjectiles(16.7); } catch (e) { return { err: String(e && e.message) }; } finally { game.paused = true; } return { loss: M - player.hp, left: game.projectiles.length }; };
    o.stamped = shoot('kingKrook'); o.plain = shoot(null); o.leg = shoot('octoLegFreeze');
    window.getEvasion = oldEva; player.hp = M; game.projectiles.length = 0;
    // 3. the shipped source: the stamps at every creation site, the contact floor before the difficulty scale
    const src = await (await fetch(location.pathname)).text(); const count = (t) => src.split(t).length - 1;
    o.src = { claw: count("skill: 'claw', _srcType: m.type,"), firebomb: count("skill: 'firebomb', _srcType: m.type,"), shock: count("skill: 'shock', _srcType: m.type,"), bubble: count("skill: 'bubble', _srcType: m.type,"), octoHead: count("skill: 'octoHead', _srcType: m.type,"), tidalSweep: count("skill: 'tidalSweep', _srcType: m.type,"), octoLeg: count("skill: 'octoLeg', _srcType: m.type,"), mink: count("skill: 'mink', _srcType: m.type,"),
      contact: src.indexOf("if (_shownDmg > 0) _shownDmg = _lxBossHpFloor(m.type, _shownDmg);") >= 0, proj: src.indexOf("if (p._srcType && _projLost > 0) _projLost = _lxBossHpFloor(p._srcType, _projLost);") >= 0 };
    return o;
  });
  console.log('build ' + r.ver + '  maxHp ' + r.maxHp + '  floor ' + r.floor + '  stamped ' + JSON.stringify(r.stamped) + '  plain ' + JSON.stringify(r.plain));
  ok('the floor table and helper exist', r.has === true);
  ok('the helper floors Krook, Octobaby and a tentacle at 15% of max HP, leaves a snail and a bigger hit alone', r.unit.krook === r.floor && r.unit.stun === r.floor && r.unit.octo === r.floor && r.unit.snail === 10 && r.unit.big === r.maxHp, JSON.stringify(r.unit));
  ok('a raised block takes its 70% off the floor; god mode is untouched', r.unitBlock === Math.max(1, Math.floor(r.maxHp * 0.15 * 0.3)) && r.unitGod === 10, JSON.stringify([r.unitBlock, r.unitGod]));
  // the floor binds on the LANDED number: the plain shot lands for a few points after the level-gap scale, the stamped one for exactly 15%
  ok('a 1-damage fireball stamped as Krook\'s lands for exactly 15% of max HP (the floor, after the scale)', r.stamped && !r.stamped.err && r.stamped.loss === r.floor && r.stamped.left === 0, JSON.stringify(r.stamped));
  ok('a tentacle\'s stamped shot lands for exactly 15% too', r.leg && !r.leg.err && r.leg.loss === r.floor, JSON.stringify(r.leg));
  ok('the same shot without a source stamp lands for next to nothing (the floor is theirs alone)', r.plain && !r.plain.err && r.plain.loss > 0 && r.plain.loss < r.floor, JSON.stringify(r.plain));
  ok('every creation site is stamped: claw 1, firebomb 4, shock 2, bubble 2, octoHead 1, tidalSweep 1, octoLeg 2, mink 1', r.src.claw === 1 && r.src.firebomb === 4 && r.src.shock === 2 && r.src.bubble === 2 && r.src.octoHead === 1 && r.src.tidalSweep === 1 && r.src.octoLeg === 2 && r.src.mink === 1, JSON.stringify(r.src));
  ok('the contact path floors the landed number beside the Conductor floor; the projectile path floors the landed number on the stamp', r.src.contact && r.src.proj, JSON.stringify([r.src.contact, r.src.proj]));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
