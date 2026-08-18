// Rising winds must warn you before they lift you.
//
// Per user: "glasswind steppe does not have a warning where u can rise up to
// the air out of nowhere, alert the players when there are rising winds."
//
// Driven by advancing the real map-event tick, so the phases and their timings
// are the ones the player experiences rather than the ones the source implies.
//   node scripts/updraft_warning_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
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
await page.waitForFunction(() => typeof updateMapEvents === 'function' && typeof loadMap === 'function', null, { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.level = 99;
  loadMap('glasswindSteppe2');                 // Razor Plains, from the report
  await new Promise(s => setTimeout(s, 500));
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
  // NOT paused: updateMapEvents early-returns on game.paused, so pausing would
  // measure nothing. The driving loop below is fully synchronous instead, which
  // keeps rAF from interleaving and leaves the suite in control of the clock.

  out.cfg = JSON.parse(JSON.stringify(game.mapData.windGusts || null));

  // Capture toasts rather than trusting that one fired.
  const toasts = [];
  const _origToast = window.showToast;
  window.showToast = function (t) { try { toasts.push(String(t)); } catch (e) {} return _origToast ? _origToast.apply(this, arguments) : undefined; };

  // Force a VERTICAL gust: stub the roll so the updraft branch is taken.
  const _rand = Math.random;
  Math.random = () => 0.01;                    // < verticalChance -> vertical

  game.paused = false;
  player.hp = getMaxHp(); player.x = 600; player.y = 480 - player.h; player.vy = 0;
  game._gustState = null; game._gustCD = null; game._gustAxis = null;
  game.particles.length = 0;

  // Run the event tick until the gust actually applies lift, recording phases.
  const seen = [];
  let warnMs = 0, warnParticles = 0, liftAt = null, toastAt = null;
  let vyAtLift = null;
  for (let f = 0; f < 900; f++) {
    const before = game._gustState;
    updateMapEvents(16);
    game.time = (game.time | 0) + 1;
    const st = game._gustState;
    if (st !== before) seen.push({ from: before, to: st, f });
    if (st === 'warn') {
      warnMs += 16;
      warnParticles += game.particles.filter(p => p && p.vy < -3).length;
      game.particles.length = 0;               // count per-frame spawns only
      if (toastAt === null && toasts.length) toastAt = f;
    }
    if (st === 'gust' && liftAt === null) {
      const vy0 = player.vy;
      updateMapEvents(16);                     // one more tick applies the impulse
      if (player.vy < vy0) { liftAt = f; vyAtLift = player.vy; }
    }
    if (liftAt !== null) break;
  }
  Math.random = _rand;
  window.showToast = _origToast;

  out.axis = game._gustAxis;
  out.phases = seen;
  out.warnMs = warnMs;
  out.warnParticles = warnParticles;
  out.toasts = toasts;
  out.lifted = liftAt !== null;
  out.vyAtLift = vyAtLift;
  game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('map cfg:', JSON.stringify(r.cfg));
console.log('axis:', r.axis, '| warn lasted:', r.warnMs + 'ms', '| warn-phase rising particles:', r.warnParticles);
console.log('toasts:', JSON.stringify(r.toasts), '| lifted:', r.lifted, 'vy', r.vyAtLift);

ok('the map really does fire vertical updrafts', r.axis === 'vertical' && (r.cfg || {}).verticalChance > 0, { axis: r.axis });
ok('a warning phase runs BEFORE the lift', r.phases.some(p => p.to === 'warn') && r.lifted === true, { phases: r.phases });
ok('the warning lasts long enough to react to (>= 900ms, map ships 500ms)',
   r.warnMs >= 900, { warnMs: r.warnMs, mapWarnMs: (r.cfg || {}).warnMs });
ok('it is announced in words that say what happens to YOU',
   r.toasts.some(t => /RISING WIND/i.test(t) && /LIFT/i.test(t)), { toasts: r.toasts });
ok('and telegraphed AT THE PLAYER, not only in the toast corner',
   r.warnParticles > 0, { risingParticlesDuringWarn: r.warnParticles });
ok('the gust still actually lifts the player afterwards (warning, not removal)',
   r.lifted === true && r.vyAtLift < 0, { vy: r.vyAtLift });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
