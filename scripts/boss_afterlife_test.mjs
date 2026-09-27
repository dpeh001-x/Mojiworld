// Nothing a boss fight leaves behind may hurt the hero once the LAST boss is dead (final polish, boss-afterlife).
// Per user: "I seem to be felled by octobaby after killing the boss for some unknown reason ... check for other bosses".
// Measured before the fix: Octobaby's homing tentacle darts (each hit floored at 15% of max HP) kept landing after the head
// died, and poison / burn / electrocute kept ticking after Scorpio (40% of the bar), Aetherion (25%), King Krook (15%) and
// others; Cancer's bubble, Libra's beam, Gravitos's crush column and Aries's cracked tile resolved posthumously.
// Each boss here is fought, killed at two different points of its pattern, standing inside it and a step away, and the world
// then runs 6 s (the victory window) with no input and no refill: every HP loss is a failure, and is named.
// Also held: a hazard the PLAYER owns survives a boss kill, and a surviving twin keeps the fight (and its shots) on.
//   node scripts/boss_afterlife_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9943);
const BOSSES = (process.env.BOSSES || 'octobaby,zodiac_scorpio,aetherion,kingKrook,king,mooma,sundered_smith,zodiac_aries,zodiac_leo,zodiac_cancer,zodiac_libra,gravitos').split(',');
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof loadMap === 'function' && typeof killMonster === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6000);
await page.evaluate(() => {
  window.__step = (dt) => {
    game.time = (game.time | 0) + 1;
    if (typeof updatePlayer === 'function') updatePlayer(dt);
    updateMonsters(dt); updateProjectiles(dt);
    if (typeof updateMinions === 'function') updateMinions(dt);
    if (typeof updateParticles === 'function') updateParticles(dt);
    if (typeof updateMapEvents === 'function') updateMapEvents(dt);
  };
  window.__setup = (type) => {
    const a = Object.entries(MAPS).filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some((p) => p.w > 900))
      .sort((x, y) => y[1].worldWidth - x[1].worldWidth)[0];
    loadMap(a[0]);
    const ww = game.mapData.worldWidth, gy = (game.mapData.platforms || []).filter((p) => p.w > 900).sort((x, y) => x.y - y.y)[0].y;
    game.monsters.length = 0;
    for (const k of ['projectiles', 'particles', 'hazards', 'minions', 'fxInstances']) if (game[k]) game[k].length = 0;
    game.keys = {};
    player.level = 200; player.maxHp = 9999999; player.hp = 9999999; player.x = ww * 0.5; player.y = gy - 80; player.vx = 0; player.vy = 0;
    player.invulnerable = 0; player._god = false; player.stunTimer = 0; player.frozenTimer = 0;
    player._poisonTimer = 0; player.burnTimer = 0; player._electrocuteTimer = 0;
    if (typeof _qteEnd === 'function') { try { _qteEnd(false); } catch (e) {} }
    if (typeof _QTE !== 'undefined' && _QTE) { _QTE.active = false; _QTE.remain = 0; }
    game.paused = false; game.dying = false;
    return spawnMonster(ww * 0.5 + 200, gy - 200, type, true);
  };
  window.__maxHp = () => (typeof getMaxHp === 'function' ? getMaxHp() : player.maxHp);
});
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${c ? '' : JSON.stringify(x).slice(0, 260)}`); };
for (const type of BOSSES) {
  const found = await page.evaluate((t) => !!monsterTypes[t], type);
  if (!found) { console.log(`SKIP  ${type} (not in this build)`); continue; }
  const hits = [];
  for (const pos of ['touch', 'near']) for (const seed of [0, 1]) {
    const r = await page.evaluate(([type, pos, seed]) => {
      const out = { hits: [] };
      const m = window.__setup(type); if (!m) return { fatal: 'spawn' };
      const warm = 500 + seed * 370;
      for (let i = 0; i < warm; i++) {
        m.currentHp = Math.max(1, Math.floor(m.maxHp * (1 - i / warm * 0.9)));
        player.hp = window.__maxHp(); player.invulnerable = 0;
        if (pos === 'touch') { player.x = m.x + m.w / 2 - player.w / 2; player.y = m.y + m.h - player.h; }
        window.__step(16.667);
        if (game.monsters.indexOf(m) < 0) return { skipped: true };
      }
      player.hp = window.__maxHp(); player.invulnerable = 0;
      for (let i = 0; i < 300 && game.monsters.indexOf(m) >= 0; i++) {
        if (m.currentHp > 0) { try { hitMonster(m, 1e12, false); } catch (e) {} }
        const hp0 = player.hp; window.__step(16.667);
        if (player.hp < hp0 && m.currentHp <= 0) out.hits.push({ dmg: Math.round(hp0 - player.hp), src: player._lastDamageSource });
      }
      if (game.monsters.indexOf(m) >= 0) { killMonster(m); window.__step(16.667); }
      const twinAlive = (game.monsters || []).some((o) => o.currentHp > 0 && (o.isBoss || o.boss));
      for (let i = 0; i < 360; i++) {
        const hp0 = player.hp; window.__step(16.667);
        if (player.hp < hp0) out.hits.push({ dmg: Math.round(hp0 - player.hp), src: player._lastDamageSource });
      }
      out.twinAlive = twinAlive;
      return out;
    }, [type, pos, seed]);
    if (r.fatal || r.skipped || r.twinAlive) continue;
    for (const h of r.hits) hits.push(`${pos}/s${seed}: -${h.dmg} ${h.src}`);
  }
  ok(`${type}: nothing hurts the hero after the last boss dies`, hits.length === 0, hits.slice(0, 4));
}
// what must NOT be scrubbed
const keep = await page.evaluate(() => {
  const m = window.__setup('octobaby');
  game.hazards.push({ x: player.x, y: player.y, w: 60, h: 60, type: 'soul_vortex', life: 600 });     // a player skill's hazard: no owner
  game.projectiles.push({ x: player.x, y: player.y - 200, vx: 1, vy: 0, w: 10, h: 10, life: 500, owner: 'player', skill: 'fireball', damage: 1 });
  killMonster(m);
  return { playerHazard: game.hazards.some((h) => h.type === 'soul_vortex'), playerShot: game.projectiles.some((p) => p.owner === 'player' && p.skill === 'fireball') };
});
ok("a player skill's hazard and the player's own shots survive a boss kill", keep.playerHazard && keep.playerShot, keep);
const twin = await page.evaluate(() => {
  const a = window.__setup('octobaby');
  const ww = game.mapData.worldWidth; const b = spawnMonster(ww * 0.5 - 300, a.y, 'mooma', true);
  game.projectiles.push({ x: player.x + 400, y: player.y, vx: -2, vy: 0, w: 10, h: 10, life: 500, owner: 'enemy', skill: 'mdark', damage: 1 });
  player._poisonTimer = 3000;
  killMonster(a);
  return { otherBossAlive: !!(b && b.currentHp > 0 && game.monsters.includes(b)), shotKept: game.projectiles.some((p) => p.owner === 'enemy' && p.skill === 'mdark'), poison: player._poisonTimer };
});
ok('while another boss still stands, the fight is on: its shots and your poison stay', twin.otherBossAlive && twin.shotKept && twin.poison > 0, twin);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
await browser.close(); server.kill();
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
