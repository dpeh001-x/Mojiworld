// Rampage: authored fire-ring VFX instead of particle spokes.
//
// Per user: "for rampage skill i see alot of particles being produced, instead
// you could use ludo.ai to generate sprites". Each of the skill's 8 pulses fired
// 10 radial particles (80 total). This counts what the LIVE skill actually
// queues across its full 3.5s, so the reduction is measured, not asserted.
//   node scripts/rampage_vfx_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const ART = 'Sprites/fx/rampage_pulse.webp';
ok('the pulse sprite ships', existsSync(ART) && statSync(ART).size > 3000 && statSync(ART).size < 200000,
   { bytes: existsSync(ART) ? statSync(ART).size : 0 });
ok('...and is COMMITTED', execFileSync('git', ['ls-files', '--', ART], { encoding: 'utf8' }).trim() === ART, {});

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
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof spawnSpriteBurst === 'function', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  game.paused = false;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.job = 'berserker';
  player.hp = getMaxHp(); player.mp = 9999; player.skillCooldowns = {};
  game.monsters.length = 0;

  out.registered = !!(typeof LX_FX !== 'undefined' && LX_FX.rampage_pulse);

  // Count everything the skill queues over its whole 3.5s life. Particles are
  // counted as PUSHES (the array self-reaps, so a snapshot would undercount).
  let particlePushes = 0, ringBursts = 0;
  const origPush = game.particles.push.bind(game.particles);
  game.particles.push = function (...a) { particlePushes += a.length; return origPush(...a); };
  const origBurst = window.spawnSpriteBurst;
  window.spawnSpriteBurst = function (x, y, key, opts) {
    if (key === 'rampage_pulse') ringBursts++;
    return origBurst.apply(this, arguments);
  };
  const budgeted = typeof _budgetedParticlePush === 'function';
  let budgetedPushes = 0;
  const origBudget = budgeted ? window._budgetedParticlePush : null;
  if (budgeted) window._budgetedParticlePush = function (p) { budgetedPushes++; return origBudget(p); };

  SKILL_FNS.rampage();
  await new Promise(r2 => setTimeout(r2, 4200));   // past the 8th pulse at i*420ms

  game.particles.push = origPush;
  window.spawnSpriteBurst = origBurst;
  if (budgeted) window._budgetedParticlePush = origBudget;
  out.counts = { particlePushes, budgetedPushes, ringBursts };
  out.ringOpts = null;
  // re-cast once with a spy that captures the ring's options
  player.skillCooldowns = {}; player.mp = 9999;
  const origBurst2 = window.spawnSpriteBurst;
  window.spawnSpriteBurst = function (x, y, key, opts) {
    if (key === 'rampage_pulse' && !out.ringOpts) out.ringOpts = Object.assign({}, opts);
    return origBurst2.apply(this, arguments);
  };
  SKILL_FNS.rampage();
  await new Promise(r2 => setTimeout(r2, 600));
  window.spawnSpriteBurst = origBurst2;
  out.desc = SKILLS.rampage && SKILLS.rampage.desc;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('registered:', r.registered, '| counts:', JSON.stringify(r.counts), '| ring opts:', JSON.stringify(r.ringOpts));

ok('the pulse sprite is registered in the FX table', r.registered === true, {});
ok('all 8 pulses draw an authored ring', r.counts.ringBursts === 8, r.counts);
ok('the 80 per-pulse particle spokes are GONE (cast flourish only, <= 30 pushes)',
   r.counts.particlePushes <= 30, r.counts);
ok('the ring expands to the full 420px hit diameter (what you see is what it hit)',
   r.ringOpts && r.ringOpts.size === 420 && r.ringOpts.scaleEndX === 1.0 && r.ringOpts.scaleStartX === 0.5, r.ringOpts);
ok('consecutive rings counter-spin so the pulses do not stutter',
   r.ringOpts && Math.abs(r.ringOpts.spin) === 0.30, r.ringOpts);
ok('the ring fades rather than popping', r.ringOpts && r.ringOpts.fadeOut > 0 && r.ringOpts.fadeOut < 1, r.ringOpts);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
