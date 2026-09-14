// AETHERION'S SHARD LANCE — his own art, and a hit worth a quarter of the bar.
// ============================================================================
// Per user, twice: "Aetherion is shooting projectile that does not match" (he is a white-and-gold
// crystal dragon and he was firing `mdark`, the shared dark-purple mob blob), and "aetherion
// fireballs should hit harder at least 25% of max HP".
//
// The damage lever is LX_BOSS_HIT_FLOOR keyed on p._srcType, which his lance never set. Note the
// bar to measure against is getMaxHp() - the game recomputes player.maxHp from stats every frame,
// so a harness that assigns player.maxHp is measuring a number the game is about to overwrite.
//
// What this pins:
//   1. the lance carries HIS key, and that art and its nine frames are served and decode;
//   2. his floor is raise-only - it can never make one of his hits smaller than it already was;
//   3. a landed lance costs at least 25% of max HP, end to end through the real projectile;
//   4. god mode still takes nothing, and no other monster was given the floor.
// Run: node scripts/aetherion_shard_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9740);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Shard');
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 60; loadMap('forest', 300); });
await page.waitForTimeout(4500);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
  try { _lxCineHold(0); } catch (e) {} game.paused = false;
  player.x = 700; player.y = 300; player._god = false;
  const BAR = getMaxHp();                       // the bar the game itself keeps, not one we assign
  out.bar = BAR;
  const boss = spawnMonster(player.x + 260, player.y - 20, 'aetherion', true);
  out.boss = !!boss;
  out.floorTable = (typeof LX_BOSS_HIT_FLOOR !== 'undefined') ? (LX_BOSS_HIT_FLOOR.aetherion || 0) : -1;
  out.otherUntouched = (typeof LX_BOSS_HIT_FLOOR !== 'undefined') ? (LX_BOSS_HIT_FLOOR.kingKrook === 0.15 && LX_BOSS_HIT_FLOOR.snail === undefined) : false;
  // the floor itself: a quarter of the bar, and raise-only for every input
  out.floorAt1 = _lxBossHpFloor('aetherion', 1);
  out.wantFloor = Math.floor(BAR * 0.25);
  out.raiseOnly = [1, 50, out.wantFloor - 1, out.wantFloor, out.wantFloor * 4, 99999]
    .every((d) => _lxBossHpFloor('aetherion', d) >= d);
  out.strangerUnfloored = _lxBossHpFloor('snail', 7) === 7;   // nobody else picked up a floor
  // one lance, aimed at the player, resolved through the real projectile path
  const fire = async ({ block = false, god = false } = {}) => {
    game.projectiles.length = 0;
    player.hp = getMaxHp(); player._god = god; player.blockTimer = block ? 999 : 0;
    player.invulnerable = 0; player.dodgeTimer = 0;
    const hp0 = player.hp;
    const cx = boss.x + boss.w / 2, cy = boss.y + boss.h / 2;
    const ang = Math.atan2((player.y + player.h / 2) - cy, (player.x + player.w / 2) - cx);
    _aeLance(boss, ang, 6, 1.0, 0.45);
    const p = game.projectiles[game.projectiles.length - 1];
    const info = p ? { skill: p.skill, src: p._srcType || null, homing: !!p.homing, floorPct: p._heavyFloorPct } : null;
    let hit = false;
    for (let i = 0; i < 140; i++) {
      if (!game.projectiles.some((z) => z.skill === 'maeshard')) { hit = player.invulnerable > 0; break; }
      await sleep(16);
    }
    const lost = hp0 - player.hp;
    player.blockTimer = 0; player._god = false; player.invulnerable = 0; player.hp = getMaxHp();
    return { info, hit, lost, pct: +(100 * lost / getMaxHp()).toFixed(1) };
  };
  // god mode FIRST: on this ungeared harness bar a landed lance is lethal, and a dead player
  // cannot answer the next question.
  out.godly = await fire({ god: true });
  await sleep(400);
  out.plain = await fire();
  out.art = {
    registered: (typeof LX_MOB_PROJ !== 'undefined') && !!LX_MOB_PROJ.maeshard,
    decoded: (typeof LX_MOB_PROJ !== 'undefined') && !!(LX_MOB_PROJ.maeshard && LX_MOB_PROJ.maeshard.naturalWidth),
    blit: (typeof _PROJ_SPRITE_BLIT !== 'undefined') && !!_PROJ_SPRITE_BLIT.maeshard && _PROJ_SPRITE_BLIT.maeshard.mode,
    keyed: (typeof _PROJ_ANIM_KEYS !== 'undefined') && _PROJ_ANIM_KEYS.has('maeshard'),
    frames: (typeof _lxFrameCount === 'function') ? _lxFrameCount('projectiles/anim', 'maeshard', 9) : -1,
    noDark: (typeof LX_MOB_PROJ !== 'undefined') && LX_MOB_PROJ.mdark !== LX_MOB_PROJ.maeshard,
  };
  for (let i = 0; i < 40 && !(typeof _projAnimFrame === 'function' && _projAnimFrame('maeshard')); i++) await sleep(100);
  out.art.animReady = !!(typeof _projAnimFrame === 'function' && _projAnimFrame('maeshard'));
  out.served = (await fetch('Sprites/projectiles/maeshard.webp')).status;
  out.servedFrame = (await fetch('Sprites/projectiles/anim/maeshard_8.webp')).status;
  return out;
});
await browser.close(); server.kill();
console.log(JSON.stringify(R));
const checks = [
  ['Aetherion is in the arena', R.boss === true],
  ['his lance carries his own key, not the shared mdark blob', R.plain.info && R.plain.info.skill === 'maeshard', R.plain.info && R.plain.info.skill],
  ['the lance tags its source, which is what the floor keys off', R.plain.info && R.plain.info.src === 'aetherion', R.plain.info && R.plain.info.src],
  ['his floor is a quarter of the bar the game actually keeps', R.floorAt1 === R.wantFloor, R.floorAt1 + ' of a ' + R.bar + ' bar (want ' + R.wantFloor + ')'],
  ['the floor only ever raises a hit, never lowers one', R.raiseOnly === true],
  ['the lance reaches the player', R.plain.hit === true],
  ['a landed lance costs at least 25% of max HP', R.plain.pct >= 25, R.plain.lost + ' of ' + R.bar + ' (' + R.plain.pct + '%)'],
  ['god mode still takes nothing', R.godly.lost <= 0, String(R.godly.lost)],
  ['the floor is his alone', R.otherUntouched === true && R.floorTable === 0.25 && R.strangerUnfloored === true, 'aetherion ' + R.floorTable],
  ['the art is registered, served and oriented to its flight', R.art.registered && R.art.decoded && R.art.blit === 'orient' && R.served === 200 && R.art.noDark, JSON.stringify(R.art)],
  ['its nine frames are indexed, served and decode', R.art.keyed && R.art.frames === 9 && R.art.animReady && R.servedFrame === 200, 'frames ' + R.art.frames],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
