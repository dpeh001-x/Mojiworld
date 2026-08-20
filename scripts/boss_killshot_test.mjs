// The killing blow on a boss should land like one.
//
// The kill already carries real weight — v0.29.125's finisher (hitstop 140 /
// shake / flash / zoom punch) plus v0.29.418's slow-mo (~0.9 s at 1/3 speed
// "so the takedown gets a beat to land"). Those are PINNED here as regressions.
// What was missing, measured through the real hitMonster -> killMonster path:
// MONSTER_FADE_MS = 50 (v0.26.108, tuned for crowds of trash corpses) blinked
// the boss out in ~3 frames — so the finisher froze the frame on a body that
// then vanished before the slow-mo it earned had even begun, and the beat held
// on an empty patch of arena. Bosses now fade over BOSS_FADE_MS instead.
//   node scripts/boss_killshot_test.mjs [port]
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
await page.waitForFunction(() => typeof hitMonster === 'function' && typeof killMonster === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.level = 60; player.hp = getMaxHp(); player.x = 700; player.y = 400;

  const mk = (key, over) => {
    const t = monsterTypes[key] || {};
    const m = Object.assign({}, t, {
      type: key, name: t.name || key, w: t.w || 60, h: t.h || 60,
      x: 900, y: 400, vx: 0, vy: 0, maxHp: 100000, currentHp: 100000,
      isBoss: !!t.boss, boss: !!t.boss, level: t.level || 50, def: 0, evasion: 0,
      exp: 0, mojicoins: 0, traits: t.traits, aggroTarget: player,
    }, over || {});
    game.monsters.length = 0; game.monsters.push(m);
    return m;
  };
  const resetBeat = () => {
    game.hitStop = 0; game.shake = 0; game._slowmoFrames = 0;
    game._shakeFrame = -1; game._shakeAddedThisFrame = 0;
    if (game._fadingMonsters) game._fadingMonsters.length = 0;
  };
  const beat = (m) => ({
    hitStop: Math.round(game.hitStop || 0),
    shake: Math.round(game.shake || 0),
    slowmo: game._slowmoFrames | 0,
    alive: m.currentHp > 0,
    fadeMs: (game._fadingMonsters && game._fadingMonsters.length)
      ? (game._fadingMonsters[game._fadingMonsters.length - 1]._fadeMs | 0) : null,
  });
  const kill = (m) => { hitMonster(m, 99999999, false, 'slash'); return beat(m); };

  // (1) an ordinary mob's death stays snappy — the v0.26.108 fix is untouched
  resetBeat();
  out.snail = kill(mk('snail', { isBoss: false, boss: false }));

  // (2) a true boss kill gets the full beat (Barnaby: no revive, no phases)
  resetBeat();
  out.barnaby = kill(mk('young_confused_barnaby'));

  // (3) a boss with a second life: the FIRST lethal hit is a REANIMATE, not a
  // kill — no beat fires and nothing fades. The SECOND is the real kill.
  resetBeat();
  {
    const m = mk('legosaurus');
    out.legoFirst = kill(m);
    resetBeat();
    m.invulnerable = 0;
    out.legoSecond = kill(m);
  }

  // (4) a Gravitos phase-down is a transformation, not a kill — no beat
  resetBeat();
  {
    const m = mk('gravitos');
    const b1 = kill(m);
    out.gravPhase = Object.assign(b1, { transformed: m.currentHp > 0 });
  }

  resetBeat();
  game.monsters.length = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('snail死       :', JSON.stringify(r.snail));
console.log('barnaby kill  :', JSON.stringify(r.barnaby));
console.log('lego 1st (rev):', JSON.stringify(r.legoFirst));
console.log('lego 2nd      :', JSON.stringify(r.legoSecond));
console.log('gravitos phase:', JSON.stringify(r.gravPhase));

ok('an ordinary mob still blinks out fast — the v0.26.108 fix is untouched',
   r.snail.fadeMs === 50 && r.snail.slowmo === 0, r.snail);
ok('a boss kill freezes the frame (the v0.29.125 finisher, pinned)',
   r.barnaby.hitStop >= 100, { hitStop: r.barnaby.hitStop });
ok('...and shakes the camera (finisher, pinned)', r.barnaby.shake > 0, { shake: r.barnaby.shake });
ok('...arms the existing kill-confirm slow-mo (regression)',
   r.barnaby.slowmo > 0, { slowmo: r.barnaby.slowmo });
ok('...and the body dissolves through the beat instead of blinking out',
   r.barnaby.fadeMs >= 500, { fadeMs: r.barnaby.fadeMs });
ok('a REANIMATE is not a kill: no killshot beat on a boss\'s first life',
   r.legoFirst.alive === true && r.legoFirst.slowmo === 0 && r.legoFirst.fadeMs === null,
   r.legoFirst);
ok('the second, real kill gets the full beat',
   r.legoSecond.hitStop >= 100 && r.legoSecond.slowmo > 0 && r.legoSecond.fadeMs >= 500,
   r.legoSecond);
ok('a Gravitos phase-down transforms, it does not celebrate',
   r.gravPhase.transformed === true && r.gravPhase.slowmo === 0 && r.gravPhase.fadeMs === null,
   r.gravPhase);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
