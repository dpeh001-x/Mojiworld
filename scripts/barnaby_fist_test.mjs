// Live test: BARNABY'S FLAMING FIST (per user: "instead of a dagger when he
// charges, rework such that he does a strong punch forward with flaming fist"
// and "barnaby action animation should also be a strong punch forward").
//
// Driven through the real boxing state machine in bossAI: stalk -> wind ->
// dashIn -> jab, with the projectile it actually spawns inspected, plus the
// attack frame set it draws.
//   node scripts/barnaby_fist_test.mjs [port]
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
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof bossAI === 'function' && typeof LX_MOB_PROJ !== 'undefined', null, { timeout: 120000 });
await page.waitForFunction(() => typeof LX_MOB_PROJ !== 'undefined' && LX_MOB_PROJ.barnFist
  && LX_MOB_PROJ.barnFist.complete && LX_MOB_PROJ.barnFist.naturalWidth > 0, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true;
  out.registered = !!LX_MOB_PROJ.barnFist;
  out.artReady = !!(LX_MOB_PROJ.barnFist && LX_MOB_PROJ.barnFist.complete && LX_MOB_PROJ.barnFist.naturalWidth > 0);
  out.src = LX_MOB_PROJ.barnFist ? LX_MOB_PROJ.barnFist.src.split('/').pop() : '';
  out.daggerGone = !LX_MOB_PROJ.barnJab;
  // the dagger art must not be reachable from any Barnaby key
  out.noDaggerAnywhere = !Object.entries(LX_MOB_PROJ)
    .some(([k, v]) => /barn/i.test(k) && v && /p_dagger/.test(String(v.src || '')));

  // ---- drive the REAL state machine ----
  const t = monsterTypes.young_confused_barnaby;
  const m = Object.assign({
    type: 'young_confused_barnaby', name: t.name, w: t.w, h: t.h,
    x: 700, y: 400, vx: 0, vy: 0, currentHp: t.hp, maxHp: t.hp,
    atk: t.atk, def: t.def, speed: t.speed, level: t.level,
    isBoss: true, boss: true, facing: -1, traits: t.traits,
  });
  player.x = 300; player.y = 400; player.hp = 9999;
  game.monsters = [m]; game.projectiles = [];
  const states = [];
  let punches = [];          // ALL punches seen, across however many cycles run
  let firstCombo = null;     // punches thrown inside the FIRST jab phase only
  let inJab = false, comboCount = 0;
  for (let i = 0; i < 900; i++) {
    game.time = 1000 + i;
    try { bossAI(m, 16); } catch (e) { out.aiThrew = String(e).slice(0, 120); break; }
    if (!states.length || states[states.length - 1] !== m._bxState) states.push(m._bxState);
    // a jab phase begins; when it ends, freeze the count for that ONE combo
    if (m._bxState === 'jab' && !inJab) { inJab = true; comboCount = 0; }
    if (m._bxState !== 'jab' && inJab) { inJab = false; if (firstCombo === null) firstCombo = comboCount; }
    for (const pj of game.projectiles) {
      if (pj.owner === 'enemy' && !pj._seen) {
        pj._seen = 1;
        punches.push({ skill: pj.skill, w: pj.w, h: pj.h, dmg: Math.round(pj.damage), life: pj.life, vx: pj.vx });
        if (inJab) comboCount++;
      }
    }
    if (firstCombo !== null) break;
  }
  out.states = states;
  out.punches = punches;
  out.perCombo = firstCombo;
  // the attack frames load lazily: nothing has drawn him, so touch the set to
  // kick the fetch, and let the outer poll wait for decode
  try { const _f = BOSS_ATTACK_FRAMES.young_confused_barnaby; out.attackSrc = _f && _f[0] ? _f[0].src.split('/').pop() : ''; } catch (e) {}
  // the attack SET he draws: 9 frames, and they must be the reinstalled ones
  const fr = (typeof BOSS_ATTACK_FRAMES !== 'undefined') && BOSS_ATTACK_FRAMES.young_confused_barnaby;
  out.attackFrames = fr ? fr.length : 0;
  out.attackReady = !!(fr && fr[0] && fr[0].complete && fr[0].naturalWidth > 0);
  game.monsters = []; game.projectiles = [];
  return out;
});

// the attack set is lazily fetched; give it a moment now that it is touched
const framesReady = await page.waitForFunction(() => {
  try { const f = BOSS_ATTACK_FRAMES.young_confused_barnaby;
    return !!(f && f.length === 9 && f[0] && f[0].complete && f[0].naturalWidth > 0); } catch (e) { return false; }
}, null, { timeout: 25000 }).then(() => true).catch(() => false);

const p0 = (r.punches || [])[0] || {};
ok('the flaming fist is registered and decoded', r.registered && r.artReady && /p_flamefist/.test(r.src),
  { src: r.src, ready: r.artReady });
ok('the DAGGER is gone from Barnaby entirely', r.daggerGone && r.noDaggerAnywhere,
  { barnJabKey: !r.daggerGone, daggerReachable: !r.noDaggerAnywhere });
ok('the real boxing chain still runs: stalk -> wind -> dashIn -> jab', !r.aiThrew
  && ['wind', 'dashIn', 'jab'].every(st => (r.states || []).includes(st)), { states: r.states, threw: r.aiThrew });
ok('the charge throws the FLAMING FIST, not a dagger', p0.skill === 'barnFist', p0);
ok('it is ONE strong punch per charge, not a 2-3 hit flurry',
  r.perCombo === 1, { perCombo: r.perCombo, cyclesObserved: (r.states || []).filter(x => x === 'jab').length });
ok('...and every punch thrown is the fist (no dagger survives any cycle)',
  (r.punches || []).length > 0 && r.punches.every(x => x.skill === 'barnFist'),
  { skills: [...new Set((r.punches || []).map(x => x.skill))] });
ok('the punch is heavy: ~2.2x ATK, a bigger box and a longer live window',
  p0.dmg >= 400 && p0.w >= 100 && p0.h >= 70 && p0.life >= 12, p0);
ok('...and drives forward toward the player', p0.vx < 0, { vx: p0.vx, playerLeftOfBoss: true });
ok('his action animation is the reinstalled 9-frame set and it decodes',
  r.attackFrames === 9 && framesReady, { frames: r.attackFrames, decoded: framesReady, src: r.attackSrc });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
