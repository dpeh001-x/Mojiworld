// A boss's defensive state must be readable while it is happening.
//
// v0.29.906 gave bosses real answers to pressure (BRACE / EVADE / RETREAT) and
// v0.29.901 gave every boss the bar. Neither said what the boss was doing right
// now: a brace cuts incoming damage by 55% through a silent line in hitMonster
// (`if (m._dirGuardT > 0) dmg = ... * 0.45`), and the float that announces the
// stance lasts about a second against a stance of 2.2-3 s reactive or 5-10 s
// timed. For most of its duration the player's numbers were just smaller.
//
// Measured by spying ctx.fillText for the bar and reading game.damageNumbers for
// the impact marker — both through the real render and damage paths.
//   node scripts/boss_state_readout_test.mjs [port]
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
await page.waitForFunction(() => typeof drawSuperBossBar === 'function' && typeof hitMonster === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.level = 60; player.hp = getMaxHp(); player.x = 700; player.y = 400;

  const mk = (state) => {
    const t = monsterTypes.legosaurus;
    const maxHp = 1000000;
    const m = Object.assign({}, t, { type: 'legosaurus', name: t.name, w: t.w, h: t.h,
      x: 900, y: 400, vx: 0, vy: 0, maxHp, currentHp: Math.floor(maxHp * 0.7),
      isBoss: true, boss: true, level: 59, def: 0, evasion: 0, aggroTarget: player });
    Object.assign(m, state || {});
    game.monsters.length = 0; game.monsters.push(m);
    game._superBossRef = null;
    return m;
  };
  // What does the bar paint for this state?
  const barText = (m) => {
    const real = ctx.fillText.bind(ctx);
    const painted = [];
    ctx.fillText = function (t) { painted.push(String(t)); return real.apply(this, arguments); };
    try { drawSuperBossBar(); } catch (e) { painted.push('THREW'); }
    ctx.fillText = real;
    return painted;
  };
  // What floats up when a hit lands?
  const hitMarkers = (m, dmg) => {
    game.damageNumbers.length = 0;
    const hp0 = m.currentHp;
    hitMonster(m, dmg, false, 'slash');
    return { texts: game.damageNumbers.map(d => String(d.text || '')).filter(Boolean),
             dealt: hp0 - m.currentHp };
  };

  out.idle      = barText(mk({}));
  out.bracing   = barText(mk({ _dirGuardT: 2500 }));
  out.evading   = barText(mk({ _dirGhostT: 2500 }));
  out.retreat   = barText(mk({ _dirFleeT: 900 }));
  out.opening   = barText(mk({ _dirOpenT: 1500 }));
  out.breaking  = barText(mk({ _stagger: 1400 }));
  // a punishable window must outrank a defence in the readout
  out.bothBreakAndGuard = barText(mk({ _stagger: 1400, _dirGuardT: 2500 }));

  {
    const m = mk({ _dirGuardT: 2500 });
    out.guardedHit = hitMarkers(m, 100000);
    const m2 = mk({});
    out.plainHit = hitMarkers(m2, 100000);
  }
  // the marker is throttled, not one per projectile
  {
    const m = mk({ _dirGuardT: 2500 });
    game.damageNumbers.length = 0;
    for (let i = 0; i < 8; i++) hitMonster(m, 20000, false, 'slash');
    out.burstMarkers = game.damageNumbers.map(d => String(d.text || '')).filter(t => t === 'GUARDED').length;
  }

  game.monsters.length = 0; game._superBossRef = null; game.damageNumbers.length = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

const has = (arr, s) => (arr || []).some(t => t.toUpperCase().includes(s));
console.log('idle       :', JSON.stringify(r.idle));
console.log('bracing    :', JSON.stringify(r.bracing));
console.log('evading    :', JSON.stringify(r.evading));
console.log('retreating :', JSON.stringify(r.retreat));
console.log('break      :', JSON.stringify(r.breaking));
console.log('guarded hit:', JSON.stringify(r.guardedHit), 'vs plain', JSON.stringify(r.plainHit));
console.log('8 hits in one brace -> GUARDED markers:', r.burstMarkers);

ok('a braced boss says BRACING on its bar', has(r.bracing, 'BRACING'), { painted: r.bracing });
ok('an evading boss says EVADING', has(r.evading, 'EVADING'), { painted: r.evading });
ok('a retreating boss says RETREATING', has(r.retreat, 'RETREATING'), { painted: r.retreat });
ok('an opening says OPEN', has(r.opening, 'OPEN'), { painted: r.opening });
ok('a break says BREAK', has(r.breaking, 'BREAK'), { painted: r.breaking });
ok('a boss doing nothing special claims nothing',
   !has(r.idle, 'BRACING') && !has(r.idle, 'EVADING') && !has(r.idle, 'RETREATING') &&
   !has(r.idle, 'OPEN') && !has(r.idle, 'BREAK'), { painted: r.idle });
ok('a punishable window outranks a defence in the readout',
   has(r.bothBreakAndGuard, 'BREAK') && !has(r.bothBreakAndGuard, 'BRACING'), { painted: r.bothBreakAndGuard });
ok('a hit absorbed by a brace says GUARDED at the point of impact',
   has(r.guardedHit && r.guardedHit.texts, 'GUARDED'), r.guardedHit);
ok('...and an ordinary hit does not', !has(r.plainHit && r.plainHit.texts, 'GUARDED'), r.plainHit);
ok('the brace is really absorbing, not just labelling',
   r.guardedHit.dealt > 0 && r.guardedHit.dealt < r.plainHit.dealt * 0.75,
   { guarded: r.guardedHit.dealt, plain: r.plainHit.dealt });
ok('the marker is throttled — a multi-hit skill does not stack eight of them',
   r.burstMarkers >= 1 && r.burstMarkers <= 2, { markers: r.burstMarkers });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
