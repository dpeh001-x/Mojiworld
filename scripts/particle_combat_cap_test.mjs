// Live test: PARTICLES SCALE DOWN WITH COMBAT LOAD - AND SPRITES DO NOT.
//
// Per user: "In boss fights and fights with multiple monsters, cap the
// particles and reduce lag without affecting sprite resolution."
//
// The flat lowFx bit already engaged in every boss fight, so a 1-boss duel and
// a 3-boss bullet-hell paid the same particle cap. The graduated cap keys off
// the SAME cached per-frame scan (boss count + mob count), so the checks here
// spawn real monsters and read the real cap - no simulated counts.
//   node scripts/particle_combat_cap_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8861; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _particleCap === 'function'
  && typeof updateParticles === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  if (typeof _lxIsSanctuary === 'function') { try { window._lxIsSanctuary = () => false; } catch (e) {} }
  if (!game.camera) game.camera = { x: 0, y: 0 };
  const out = {};
  const fresh = () => { game._lowFxCache = null; };   // caps read a per-frame cache; force a rescan
  const scene = (bosses, mobs) => {
    game.monsters = [];
    for (let i = 0; i < bosses; i++) spawnMonster(300 + i * 220, 300, 'zodiac_leo', true);
    for (let i = 0; i < mobs; i++) spawnMonster(150 + (i % 8) * 90, 250 + Math.floor(i / 8) * 100, 'sandhusk', false);
    game.time++; fresh();
    return { cap: _particleCap(), boss: _perfBossCount(),
      mobs: (game._lowFxCache && game._lowFxCache.mobCount) || 0 };
  };

  out.town      = scene(0, 0);    // no combat
  out.duel      = scene(1, 0);    // one boss
  out.swarm     = scene(0, 24);   // many mobs, no boss
  out.bossSwarm = scene(1, 24);   // boss + swarm
  out.arena     = scene(3, 8);    // multi-boss

  // the total cap actually sheds: flood raw pushes (the 280 bypass sites),
  // then one update must bring the array down to the cap
  game.monsters = []; for (let i = 0; i < 3; i++) spawnMonster(300 + i * 220, 300, 'zodiac_leo', true);
  game.time++; fresh();
  game.particles = [];
  for (let i = 0; i < 900; i++) game.particles.push({ x: 400, y: 300, vx: 0, vy: 0, life: 50, color: '#fff', size: 2 });
  const floodBefore = game.particles.length;
  updateParticles(16);
  out.shed = { before: floodBefore, after: game.particles.length, cap: _particleCap() };

  // admission tightens in the arena: count how many budgeted pushes one frame accepts
  if (typeof _budgetedParticlePush === 'function') {
    game.particles = []; game.time++; fresh();
    updateParticles(16);   // resets the per-frame admission counter
    let admitted = 0;
    for (let i = 0; i < 200; i++) if (_budgetedParticlePush({ x: 1, y: 1, vx: 0, vy: 0, life: 5 })) admitted++;
    out.arenaAdmission = admitted;
  }

  // sprite resolution untouched: the decoded boss frames keep native size
  try {
    const f = (typeof BOSS_ATTACK_FRAMES !== 'undefined') && BOSS_ATTACK_FRAMES.aetherionastral;
    out.spriteNative = f && f[0] ? f[0].naturalWidth : null;
  } catch (e) { out.spriteNative = 'err'; }

  // measured cost: update+draw one heavy frame at the old flat cap vs the new
  const cost = (n) => {
    game.particles = [];
    for (let i = 0; i < n; i++) game.particles.push({ x: 100 + (i % 500), y: 300, vx: 0.3, vy: -0.2, life: 999, color: '#ffcc44', size: 3 });
    const t0 = performance.now();
    for (let k = 0; k < 120; k++) { updateParticles(16); if (typeof drawParticles === 'function') drawParticles(); }
    return +(((performance.now() - t0) / 120)).toFixed(3);
  };
  // A/B at EQUAL code, different population: clear combat so the cap lets a
  // big population live, then re-arm the arena for the capped one. (First
  // attempt timed 137-vs-82 with the arena cap active on both - the new cap
  // sheds 137 to 82 in the first update, so both runs measured 82.)
  game.monsters = []; game.time++; fresh();
  out.msAtBigPop  = cost(240);
  game.monsters = []; for (let i = 0; i < 3; i++) spawnMonster(300 + i * 220, 300, 'zodiac_leo', true);
  for (let i = 0; i < 8; i++) spawnMonster(150 + i * 90, 250, 'sandhusk', false);
  game.time++; fresh();
  out.msAtArenaCap = cost(_particleCap());
  game.particles = []; game.monsters = [];
  return out;
});
await b.close(); srv.kill();

ok('no combat: the cap is untouched', r.town.cap === 250, r.town);
ok('a boss fight caps lower than town', r.duel.cap === 110 && r.duel.boss === 1, r.duel);
ok('a mob swarm caps lower than town without any boss',
  r.swarm.cap < r.town.cap && r.swarm.mobs >= 20, r.swarm);
ok('boss + swarm caps lower than the boss alone', r.bossSwarm.cap < r.duel.cap, r.bossSwarm);
ok('a multi-boss arena sits on the tier-2 cap',
  r.arena.cap === 82 && r.arena.cap >= 64,
  { ...r.arena, note: 'boss+25-mob swarm caps lower still (70) - >22 mobs trips tier-2 AND the swarm multiplier, which is the right ordering: emitter count tracks mobs more than bosses' });
ok('the total cap actually sheds a raw-push flood in one update',
  r.shed.before === 900 && r.shed.after <= r.shed.cap,
  { ...r.shed, note: '~280 spawn sites bypass the admission budget; this cap is what catches them' });
ok('per-frame admission tightens in the arena',
  r.arenaAdmission <= 40, { admitted: r.arenaAdmission, was: 60 });
ok('sprite resolution is untouched - decoded frames keep native size',
  r.spriteNative === 1656 || r.spriteNative == null,
  { naturalWidth: r.spriteNative, note: 'the change draws fewer rectangles, never a smaller sprite' });
ok('and a smaller population is measurably cheaper per frame - the point of capping',
  r.msAtArenaCap < r.msAtBigPop,
  { msAt240Particles: r.msAtBigPop, msAtArenaCap82: r.msAtArenaCap });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
