// A cornered boss takes a stand; it does not grind the wall. And a stun never
// locks the player out past their own iframe.
//
// Two fairness properties of the threat/zone systems, both measured on a real
// loaded map:
//
// 1. RETREAT into a wall. The map walls mobs in, and a retreat pointed at a
//    wall spent ~950 ms of its 1100 grinding against it at full speed
//    (measured pre-fix: x pinned at 0, vx -3.2) — reads as a pathing bug. A
//    boss that stops making progress for ~100 ms now abandons the retreat and
//    converts to the GUARD stance (bar chip flips RETREATING -> BRACING), with
//    a CORNERED float. A retreat in open ground is untouched.
//
// 2. STUN never out-lasts the iframe. The v0.29.920 zone-stun (1 s) must always
//    be covered by the hit's own invulnerability window, so a stunned player is
//    untouchable until after they can act again — no zero-agency chain.
//   node scripts/boss_cornered_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof updateMonsters === 'function' && typeof updateProjectiles === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const cs2 = document.getElementById('class-select-modal'); if (cs2) cs2.style.display = 'none';
  player.cls = 'warrior'; player.level = 60; player.hp = getMaxHp();
  window._prologueActive = false;
  if (typeof STORY_BEATS === 'object') { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; }
  try { loadMap('glasswindSteppe'); } catch (e) {}
  game.paused = false;

  const mk = (x) => {
    const t = monsterTypes.legosaurus;
    const m = Object.assign({}, t, { type: 'legosaurus', w: t.w, h: t.h, x, y: 400 - (t.h - 60),
      vx: 0, vy: 0, onGround: true, maxHp: 1000000, currentHp: 200000, isBoss: true, boss: true,
      level: 59, def: 0, evasion: 0, exp: 0, mojicoins: 0, traits: t.traits, aggroTarget: player,
      facing: 1, _bigMeleeCd: 99999, _columnCd: 99999, _bdCd: 99999, shootTimer: 99999 });
    game.monsters.length = 0; game.monsters.push(m);
    game.damageNumbers.length = 0;
    return m;
  };

  // (1) CORNERED — flee pointed at the map's left wall
  {
    const m = mk(10);
    player.x = m.x + m.w + 120; player.y = 400;
    game.camera.x = 0; game.camera.y = 0;
    m._dirFleeT = 1100;
    let fleeTicks = 0;
    for (let i = 0; i < 90; i++) {
      try { updateMonsters(16); } catch (e) {}
      if (m._dirFleeT > 0) fleeTicks++;
      else break;
    }
    out.cornered = {
      fleeMs: fleeTicks * 16,
      guard: (m._dirGuardT | 0) > 0,
      facingPlayer: m.facing === 1,
      float: game.damageNumbers.some(d => String(d.text || '').includes('CORNERED')),
      x: Math.round(m.x),
    };
  }

  // (2) OPEN GROUND — the same retreat runs its full course, untouched
  {
    const m = mk(900);
    player.x = m.x + m.w + 120; player.y = 400;
    game.camera.x = 500; game.camera.y = 0;
    m._dirFleeT = 1100;
    const x0 = m.x;
    let fleeTicks = 0;
    for (let i = 0; i < 90; i++) {
      try { updateMonsters(16); } catch (e) {}
      if (m._dirFleeT > 0) fleeTicks++;
      else break;
    }
    out.open = {
      fleeMs: fleeTicks * 16,
      moved: Math.round(x0 - m.x),
      guard: (m._dirGuardT | 0) > 0,
      float: game.damageNumbers.some(d => String(d.text || '').includes('CORNERED')),
    };
  }

  // (3) STUN <= IFRAME on every stunned zone hit — the no-lockout guarantee
  {
    game.camera.x = 400;
    const t = monsterTypes.young_confused_barnaby;
    const m = Object.assign({}, t, { type: 'young_confused_barnaby', w: t.w, h: t.h,
      x: 800, y: 400 - (t.h - 60), vx: 0, vy: 0, onGround: true, maxHp: 1000000, currentHp: 1000000,
      isBoss: true, boss: true, level: 40, def: 0, evasion: 0, exp: 0, mojicoins: 0,
      traits: t.traits, aggroTarget: player, facing: -1, atk: 100,
      _bigMeleeCd: 0, _columnCd: 99999, _bdCd: 99999, shootTimer: 99999 });
    player.x = 790; player.y = 400;
    game.monsters.length = 0; game.monsters.push(m); game.projectiles.length = 0;
    for (let i = 0; i < 120; i++) { try { updateMonsters(16); } catch (e) {}
      if (game.projectiles.some(p => p.owner === 'enemy' && p.skill === 'swing')) break; }
    const proto = game.projectiles.find(p => p.owner === 'enemy' && p.skill === 'swing');
    const stuns = [];
    for (let i = 0; i < 220 && stuns.length < 6; i++) {
      player.hp = getMaxHp(); player.invulnerable = 0; player.hitStun = 0;
      player.parryWindow = 0; player.blockTimer = 0;
      player.tree = player.tree || {}; player.tree.stunImmune = false;
      game.damageNumbers.length = 0; game.monsters.length = 0;
      game.projectiles.length = 0;
      game.projectiles.push(Object.assign({}, proto, { x: player.x - 4, y: player.y - 4, w: 60, h: 60, life: 6, vx: 0, vy: 0 }));
      try { updateProjectiles(16); } catch (e) {}
      if (player.hp >= getMaxHp()) continue;
      if (game.damageNumbers.some(d => String(d.text || '').includes('STUNNED'))) {
        stuns.push({ stun: Math.round(player.hitStun), iframe: Math.round(player.invulnerable) });
      }
    }
    out.stuns = stuns;
  }

  game.monsters.length = 0; game.projectiles.length = 0;
  player.hp = getMaxHp(); player.hitStun = 0; player.invulnerable = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('cornered  :', JSON.stringify(r.cornered));
console.log('open field:', JSON.stringify(r.open));
console.log('stuns     :', JSON.stringify(r.stuns));

const c = r.cornered || {}, o = r.open || {};
ok('a wall-pinned retreat ends early instead of grinding (was ~1100ms)',
   c.fleeMs > 0 && c.fleeMs <= 400, { fleeMs: c.fleeMs });
ok('...and converts into a STAND — the guard stance', c.guard === true, c);
ok('...facing the player', c.facingPlayer === true, { facing: c.facingPlayer });
ok('...announced as CORNERED', c.float === true, {});
ok('a retreat in open ground still runs its full course',
   o.fleeMs >= 900, { fleeMs: o.fleeMs });
ok('...moving the boss away', o.moved >= 60, { moved: o.moved });
ok('...with no cornered conversion', o.guard === false && o.float === false, o);
ok('enough stunned hits were caught to measure', (r.stuns || []).length >= 4, { n: (r.stuns || []).length });
ok('a stun NEVER outlasts the iframe — no zero-agency chain is possible',
   (r.stuns || []).every(s => s.iframe >= s.stun + 100), { stuns: r.stuns });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
