// Necrotic Ascendance, audited. This suite OWNS THE CLOCK: game.paused stays
// true so the live rAF loop never ticks the sim, and every frame is driven by
// hand — which is precisely how the original wall-clock finale was caught
// (a storm that must survive real seconds of pause untouched cannot coexist
// with a setTimeout collapse).
//
//   pool rim  : 4.2 pull must beat the fastest flier (1.6 x 2.4 = 3.84 px/f)
//   storm     : follows the necromancer, drags + drains + harvests on sim frames
//   collapse  : fires on the 360th storming FRAME, once, with the harvest
//   pause     : 6.5s of real time with zero frames driven changes nothing
//   recast    : one storm at a time, one collapse total
//   heal cap  : flat rider pays at most 3 souls per drain tick
//   node scripts/necromancer_maelstrom_test.mjs [port]
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
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'domcontentloaded', timeout: 180000 });   // MOJI_GAME_FILE lets this grade a candidate build, like the buff test
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof updateProjectiles === 'function', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  game.paused = true;   // the suite owns the clock; the live loop stays out
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'necromancer';
  player.hp = getMaxHp(); player.mp = 9999; player.skillCooldowns = {};
  const mob = (x, y, extra) => Object.assign({
    x, y, w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9, def: 0,
    type: 'slime', level: 1, speed: 1.2, facing: 1, vx: 0, vy: 0, name: 'dummy',
  }, extra || {});
  const storm = () => game.hazards.find(z => z.type === 'necro_maelstrom');
  const frames = (n) => { for (let f = 0; f < n; f++) updateProjectiles(16); };

  // --- A. POOL RIM RACE ------------------------------------------------------
  out.rimRace = (() => {
    game.hazards.length = 0; game.monsters.length = 0;
    SKILL_FNS.necromancer_harvest();
    const h = game.hazards.find(z => z.type === 'soul_vortex');
    const cx = h.cx, cy = h.y + h.h / 2;
    const m = mob(cx + (h.w / 2) - 30, cy - 30, { flies: true, speed: 1.6 });
    game.monsters.push(m);
    const maxV = m.speed * 2.4;
    const start = m.x;
    for (let f = 0; f < 120; f++) {
      m.vx += (maxV - m.vx) * 0.16;
      if (Math.abs(m.vx) > maxV) m.vx *= maxV / Math.abs(m.vx);
      m.x += m.vx;
      updateProjectiles(16);
    }
    const captured = m.x < start - 40;
    game.hazards.length = 0; game.monsters.length = 0;
    return { start: Math.round(start), end: Math.round(m.x), captured, maxV };
  })();

  // --- B. the storm: follow, drag, drain, harvest ---------------------------
  game.hazards.length = 0; game.monsters.length = 0;
  const far = mob(player.x + 260, player.y - 30);
  game.monsters.push(far);
  const farStart = far.x;
  player.hp = Math.floor(getMaxHp() * 0.5);
  const hpAtCast = player.hp;
  SKILL_FNS.necromancer_ult();
  const hz0 = storm();
  out.spawned = { exists: !!hz0, follows: !!(hz0 && hz0.follow),
    protectedType: (typeof _HAZ_PROTECTED !== 'undefined') && _HAZ_PROTECTED.has('necro_maelstrom') };
  frames(60);
  player.x += 140;               // the necromancer repositions mid-storm
  frames(90);
  const hzMid = storm();
  out.mid = {
    stillUp: !!hzMid,
    followed: !!hzMid && Math.abs(hzMid.cx - (player.x + player.w / 2)) <= 2,
    souls: hzMid ? (hzMid.souls | 0) : -1,
    farMoved: Math.round(farStart - far.x),
    drained: far.currentHp < 1e9,
    healed: player.hp > hpAtCast,
  };

  // --- C. PAUSE INTEGRITY: real seconds pass, zero frames, nothing changes --
  const soulsBeforePause = storm() ? storm().souls | 0 : -1;
  await new Promise(r2 => setTimeout(r2, 6500));   // the old setTimeout finale fires in here
  const hzAfterPause = storm();
  out.pause = {
    stormSurvives: !!hzAfterPause,
    soulsUnchanged: !!hzAfterPause && (hzAfterPause.souls | 0) === soulsBeforePause,
    noEarlyCollapse: game.hazards.some(z => z.type === 'necro_maelstrom'),
  };

  // --- D. the collapse fires on FRAMES, once, with the harvest --------------
  const obs = mob(player.x + 60, player.y);       // fresh observer for the nova
  game.monsters.push(obs);
  const obsHp0 = obs.currentHp;
  frames(260);                                     // finish the 360 storming frames + slack
  out.collapse = {
    hazardGone: !storm(),
    observerHit: obs.currentHp < obsHp0,
  };

  // --- E. RECAST: one storm at a time, one collapse total -------------------
  game.hazards.length = 0; game.monsters.length = 0;
  player.skillCooldowns = {}; player.mp = 9999; player.hp = getMaxHp();
  SKILL_FNS.necromancer_ult();
  frames(60);
  player.skillCooldowns = {}; player.mp = 9999;
  SKILL_FNS.necromancer_ult();                            // refunded-cooldown recast
  const count = game.hazards.filter(z => z.type === 'necro_maelstrom').length;
  const fresh = storm();
  out.recast = { stormsAfterRecast: count, soulsReset: fresh ? (fresh.souls | 0) : -1 };
  const watcher = mob(player.x + 60, player.y);
  game.monsters.push(watcher);
  let collapses = 0, lastUp = true;
  for (let f = 0; f < 460; f++) {
    updateProjectiles(16);
    const up = !!storm();
    if (lastUp && !up) collapses++;
    lastUp = up;
  }
  out.recast.collapses = collapses;

  // --- F. HEAL CAP: 3 mobs vs 10 mobs, same flat payout ---------------------
  const healOverOneTick = (mobN) => {
    game.hazards.length = 0; game.monsters.length = 0;
    player.skillCooldowns = {}; player.mp = 9999;
    SKILL_FNS.necromancer_ult();
    for (let i = 0; i < mobN; i++) game.monsters.push(mob(player.x + 30 + i * 8, player.y));
    const h = storm();
    frames(29 - (h.tick % 30) + 29);   // run up to just before a drain tick
    player.hp = Math.floor(getMaxHp() * 0.10);
    const before = player.hp;
    frames(2);                          // cross exactly one drain boundary
    const gained = player.hp - before;
    // subtract the 30%-of-drain return (shared pool rule, scales with mobs by
    // design) to isolate the FLAT rider
    const drainPerMob = Math.max(1, Math.floor(storm().atk * (30 / 60)));
    const flat = gained - Math.floor(drainPerMob * 0.3) * mobN;
    game.hazards.length = 0; game.monsters.length = 0;
    return { gained, flat, maxHp: getMaxHp() };
  };
  const h3 = healOverOneTick(3);
  const h10 = healOverOneTick(10);
  out.heal = { three: h3, ten: h10,
    flatCapped: Math.abs(h10.flat - h3.flat) <= Math.ceil(getMaxHp() * 0.005) + 3 };

  out.desc = SKILLS.necromancer_ult && SKILLS.necromancer_ult.desc;
  game.hazards.length = 0; game.monsters.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('rim race :', JSON.stringify(r.rimRace));
console.log('spawned  :', JSON.stringify(r.spawned), '| mid:', JSON.stringify(r.mid));
console.log('pause    :', JSON.stringify(r.pause));
console.log('collapse :', JSON.stringify(r.collapse));
console.log('recast   :', JSON.stringify(r.recast));
console.log('heal     :', JSON.stringify(r.heal));

ok('POOL: the fastest flier cannot out-swim the rim', r.rimRace.captured === true, r.rimRace);
ok('storm spawns as a following hazard, perf-trim protected',
   r.spawned.exists && r.spawned.follows && r.spawned.protectedType, r.spawned);
ok('the storm re-centres on the necromancer after a mid-storm reposition', r.mid.followed === true, r.mid);
ok('a foe 260px out is dragged in', r.mid.farMoved >= 60, r.mid);
ok('held foes are drained and souls harvested', r.mid.drained === true && r.mid.souls >= 3, r.mid);
ok('draining heals the necromancer', r.mid.healed === true, r.mid);
ok('PAUSE: 6.5 real seconds with zero frames leave the storm untouched (the old setTimeout finale fails here)',
   r.pause.stormSurvives === true && r.pause.noEarlyCollapse === true, r.pause);
ok('...and the harvest is exactly as it was', r.pause.soulsUnchanged === true, r.pause);
ok('the collapse fires on the storm\'s own FRAMES, consuming it', r.collapse.hazardGone === true, r.collapse);
ok('...and the nova actually lands on a foe beside the necromancer', r.collapse.observerHit === true, r.collapse);
ok('RECAST mid-storm leaves exactly one storm, with a reset harvest',
   r.recast.stormsAfterRecast === 1 && r.recast.soulsReset === 0, r.recast);
ok('...and exactly ONE collapse total (no stale double detonation)', r.recast.collapses === 1, r.recast);
ok('HEAL CAP: ten held mobs pay the same flat rider as three (cap 3 souls/tick)',
   r.heal.flatCapped === true, r.heal);
ok('tooltip still teaches the maelstrom', /maelstrom/i.test(r.desc || ''), { desc: r.desc });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
