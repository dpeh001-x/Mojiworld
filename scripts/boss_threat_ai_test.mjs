// A boss should notice it is being deleted, and what it does about it should
// depend on how the fight is going.
//
// Per user: "Make sure bosses such as legosaurus, barnaby and octababy have
// clear phases, in which they attack, pause, defend or run when getting damaged
// too much too quick, make them have smart AI."
//
// Measured by hitting a real boss through the real hitMonster path and ticking
// the real updateMonsters loop — no constants are read back. The three named
// bosses are used by name, since they are what the request named.
//   node scripts/boss_threat_ai_test.mjs [port]
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
await page.waitForFunction(() => typeof hitMonster === 'function' && typeof updateMonsters === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.level = 60; player.hp = getMaxHp(); player.x = 700; player.y = 400;
  player._oneShot = false;

  const mk = (key, hpFrac) => {
    const t = monsterTypes[key] || {};
    const maxHp = 1000000;
    const m = Object.assign({}, t, {
      type: key, name: t.name || key, w: t.w || 100, h: t.h || 100,
      x: 900, y: 400, vx: 0, vy: 0, onGround: true,
      maxHp, currentHp: Math.floor(maxHp * hpFrac),
      isBoss: true, boss: true, level: t.level || 50, def: 0, evasion: 0,
      aggroTarget: player, facing: -1,
    });
    game.monsters.length = 0; game.monsters.push(m);
    return m;
  };
  // Damage the boss the way the player does, in one burst.
  const burst = (m, frac) => { hitMonster(m, Math.floor(m.maxHp * frac), false, 'slash'); };
  const state = (m) => ({ guard: (m._dirGuardT | 0) > 0, ghost: (m._dirGhostT | 0) > 0,
                          flee: (m._dirFleeT | 0) > 0, burstMeter: Math.round(m._burst || 0) });

  // (1) HIGH HP + a hard burst -> BRACE
  {
    const m = mk('legosaurus', 0.95);
    burst(m, 0.18);
    out.highHp = state(m);
    // and bracing actually reduces what the next hit does
    const hp0 = m.currentHp; hitMonster(m, 100000, false, 'slash');
    out.guardedHit = hp0 - m.currentHp;
    const m2 = mk('legosaurus', 0.95);
    const hp1 = m2.currentHp; hitMonster(m2, 100000, false, 'slash');
    out.normalHit = hp1 - m2.currentHp;
  }

  // (2) MID HP + a hard burst -> EVADE
  { const m = mk('octobaby', 0.45); burst(m, 0.18); out.midHp = state(m); }

  // (3) LOW HP + a hard burst -> RETREAT, and it actually backs away
  {
    const m = mk('young_confused_barnaby', 0.20);
    burst(m, 0.18);
    out.lowHp = state(m);
    for (let i = 0; i < 6; i++) { try { updateMonsters(16); } catch (e) {} }
    // Direction, not displacement: m.x integration needs a loaded map and this
    // harness has none, so x sat frozen while vx was being set correctly. vx is
    // what the retreat actually writes, and the sign is the whole claim.
    const _awayIsPositive = (m.x + m.w / 2) > (player.x + player.w / 2);
    out.fleeVx = +(m.vx || 0).toFixed(2);
    out.movedAway = _awayIsPositive ? out.fleeVx > 0 : out.fleeVx < 0;
    out.stillFleeing = (m._dirFleeT | 0) > 0;
  }

  // (3b) a burst UNDER the line is not enough — pins the threshold from below,
  // so "a hard burst reacts" cannot quietly become "any hit reacts".
  { const m = mk('legosaurus', 0.95); burst(m, 0.06); out.smallBurst = state(m); }

  // (4) CHIP damage never trips it, however long you keep it up
  {
    const m = mk('legosaurus', 0.95);
    for (let s2 = 0; s2 < 40; s2++) {
      hitMonster(m, Math.floor(m.maxHp * 0.008), false, 'slash');   // 0.8% a tick
      for (let i = 0; i < 12; i++) { try { updateMonsters(16); } catch (e) {} }   // ~200ms of bleed
    }
    out.chip = state(m);
  }

  // (5) an EARNED window is never stolen: burst inside a stagger gets no answer
  {
    const m = mk('legosaurus', 0.95);
    m._stagger = 3000;
    burst(m, 0.30);
    out.duringStagger = state(m);
  }
  {
    const m = mk('legosaurus', 0.95);
    m._dirOpenT = 2000;
    burst(m, 0.30);
    out.duringOpening = state(m);
  }

  // (6) reactions cannot chain
  {
    const m = mk('legosaurus', 0.95);
    // Hold the BREAK system out of this one. Break is a separate mechanism that
    // also blocks a threat response (a stagger is an earned window and must not
    // be stolen) - and it fired here, which made this check measure break
    // rather than the cooldown it is named after. _staggerCd parks it.
    m._staggerCd = 999999; m._stagger = 0; m._dirOpenT = 0; m._break = 0;
    burst(m, 0.18);
    const first = state(m);
    m._dirGuardT = 0; m._dirGhostT = 0; m._dirFleeT = 0;   // stance over, cooldown still running
    m._stagger = 0; m._dirOpenT = 0;
    burst(m, 0.30);
    out.chained = { first: first.guard || first.ghost || first.flee, firstDetail: first, second: state(m), secondStagger: Math.round(m._stagger || 0) };
  }

  // (7) Gravitos runs its own script and is left alone
  { const m = mk('gravitos', 0.95); burst(m, 0.30); out.gravitos = state(m); }

  // (8) an ordinary mob has no threat response
  {
    const m = mk('snail', 0.95); m.isBoss = false; m.boss = false;
    burst(m, 0.30); out.ordinary = state(m);
  }

  game.monsters.length = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('legosaurus 95% + 12% burst :', JSON.stringify(r.highHp));
console.log('octobaby   45% + 12% burst :', JSON.stringify(r.midHp));
console.log('barnaby    20% + 12% burst :', JSON.stringify(r.lowHp), '| away:', r.movedAway, '| vx', r.fleeVx);
console.log('small burst (under line)   :', JSON.stringify(r.smallBurst));
console.log('chip damage, 40 ticks      :', JSON.stringify(r.chip));
console.log('burst during stagger       :', JSON.stringify(r.duringStagger));
console.log('hit while braced           :', r.guardedHit, 'vs normal', r.normalHit);

ok('a hard burst at high HP makes the boss BRACE', r.highHp && r.highHp.guard === true, r.highHp);
ok('...and bracing actually cuts the damage it takes',
   r.guardedHit > 0 && r.guardedHit < r.normalHit * 0.75, { braced: r.guardedHit, normal: r.normalHit });
ok('the same burst at mid HP makes it EVADE instead', r.midHp && r.midHp.ghost === true, r.midHp);
ok('at low HP it RETREATS instead', r.lowHp && r.lowHp.flee === true, r.lowHp);
ok('...and it drives itself AWAY from the player while retreating',
   r.movedAway === true && r.stillFleeing === true, { vx: r.fleeVx, fleeing: r.stillFleeing });
ok('a burst UNDER the line does not trigger anything',
   r.smallBurst && !r.smallBurst.guard && !r.smallBurst.ghost && !r.smallBurst.flee, r.smallBurst);
ok('chip damage never trips it, however long it goes on',
   r.chip && !r.chip.guard && !r.chip.ghost && !r.chip.flee, r.chip);
ok('a burst into an earned STAGGER is never answered — the punish window is safe',
   r.duringStagger && !r.duringStagger.guard && !r.duringStagger.ghost && !r.duringStagger.flee, r.duringStagger);
ok('...nor into an OPENING', r.duringOpening && !r.duringOpening.guard && !r.duringOpening.ghost && !r.duringOpening.flee, r.duringOpening);
ok('reactions cannot chain back-to-back',
   r.chained && r.chained.first === true &&
   !r.chained.second.guard && !r.chained.second.ghost && !r.chained.second.flee, r.chained);
ok('Gravitos is left to its own three-form script',
   r.gravitos && !r.gravitos.guard && !r.gravitos.ghost && !r.gravitos.flee, r.gravitos);
ok('an ordinary mob has no threat response',
   r.ordinary && !r.ordinary.guard && !r.ordinary.ghost && !r.ordinary.flee, r.ordinary);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
