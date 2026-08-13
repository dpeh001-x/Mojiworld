// Bastion of Dawn remake: the Judgement meter.
//   charge: +1 stack per hit taken (rate-limited, cap 5, Crusader only)
//   release: full heal, 15s half-damage party shield, 0.7s pull, 2 homing
//            exploding orbs per stack (10 at full, 12 at rank 10)
// Drives the REAL paths: stacks via player.lastHitTime (what every damage
// site stamps), the shield through an actual monster-skill damage call, the
// pull and orbs through the live scheduleSkillTimer chain.
//   node scripts/judgement_bastion_test.mjs [port]
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
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof updatePlayer === 'function', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  game.paused = false;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.job = 'knight'; player.master = 'crusader';
  player.hp = getMaxHp(); player.mp = 9999; player.skillCooldowns = {};
  game.monsters.length = 0; game.projectiles.length = 0;
  player._judgeStacks = 0; player._judgeHitSeen = player.lastHitTime || 0; player._judgeStackFr = -999;

  // Simulate hits exactly the way every damage site reports them.
  const hit = () => { player.lastHitTime = game.time; updatePlayer(16); };
  const gap = (frames) => { game.time += frames; };

  // --- A. the meter ---------------------------------------------------------
  // The watcher detects a hit as a CHANGE in lastHitTime; at boot the seen
  // marker equals the current stamp, so advance the clock before the first
  // simulated hit or it reads as "already counted".
  gap(30);
  hit();
  out.after1 = player._judgeStacks | 0;
  hit();                                    // same frame: rate limit must hold
  out.spamBlocked = (player._judgeStacks | 0) === 1;
  for (let i = 0; i < 8; i++) { gap(30); hit(); }
  out.capped = player._judgeStacks | 0;     // must cap at 5

  // non-crusader gains nothing
  player.master = 'dragoon'; player._judgeStacks = 0; player._judgeHitSeen = player.lastHitTime || 0;
  gap(30); hit();
  out.nonCrusader = player._judgeStacks | 0;
  player.master = 'crusader';

  // recharge to full for the release test
  player._judgeStacks = 5;

  // --- B. the release -------------------------------------------------------
  const mobs = [];
  const mk = (x) => { const m = { x, y: player.y, w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9,
    def: 0, type: 'slime', level: 1, speed: 0, facing: 1, vx: 0, vy: 0, _noGravity: true, name: 'dummy' };
    game.monsters.push(m); mobs.push(m); return m; };
  const far = mk(player.x + 340);           // pull target
  mk(player.x + 120); mk(player.x - 150);   // orb targets
  const farStart = far.x;

  player.hp = Math.floor(getMaxHp() * 0.4);
  SKILL_FNS.crusader_ult();
  out.cast = {
    stacksAfter: player._judgeStacks | 0,
    healed: player.hp === getMaxHp(),
    shieldMs: (player.buffs && player.buffs.aegisShield) | 0,
  };
  updatePlayer(16);                          // bridge tick
  out.aegisBridged = !!(player._aegis && player._aegis.life >= 14000);

  // let the scheduled pull + volley run in real time
  await new Promise(r2 => setTimeout(r2, 1600));
  const orbs = game.projectiles.filter(p => p && p.skill === 'holyorb');
  out.volley = {
    count: orbs.length,
    homing: orbs.every(p => p.homing !== undefined),
    explode: orbs.every(p => p.aoeOnHit === 90),
    noDouble: orbs.every(p => p._msHandled === true),
  };
  out.pull = { start: farStart, end: Math.round(far.x), moved: Math.round(farStart - far.x) };

  // --- C. the shield halves real damage ------------------------------------
  game.projectiles.length = 0;
  const wisp = { x: player.x + 10, y: player.y, w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9,
    atk: 400, def: 0, type: 'lanternWisp', level: 1, name: 'Wisp', vx: 0, vy: 0 };
  const smack = () => {
    player.hp = getMaxHp(); player.invulnerable = 0; player.blockTimer = 0;
    MONSTER_SKILL_FNS.lanternPulse(wisp);
    return getMaxHp() - player.hp;
  };
  player._aegis = null; player.buffs.aegisShield = 0;
  const lossBare = smack();
  player.buffs.aegisShield = 15000; updatePlayer(16);   // re-bridge
  const lossShielded = smack();
  out.shield = { bare: lossBare, shielded: lossShielded,
    halved: lossShielded > 0 && Math.abs(lossShielded - lossBare / 2) <= Math.max(2, lossBare * 0.08) };

  // --- D. the buff decays and is party-sharable -----------------------------
  const before = player.buffs.aegisShield;
  updatePlayer(1000);
  out.decays = player.buffs.aegisShield < before;
  out.sharable = _COOP_SHARABLE_BUFFS.has('aegisShield');
  out.slotFromBoot = 'aegisShield' in player.buffs;
  out.pill = (typeof BUFF_META !== 'undefined') && BUFF_META.some(m => m.key === 'aegisShield' && m.skill === 'crusader_ult');

  // --- E. rank 10: longer shield, bigger volley -----------------------------
  player.skillRanks = { crusader_ult: 10 };
  player._judgeStacks = 5; player.buffs.aegisShield = 0; game.projectiles.length = 0;
  player.skillCooldowns = {}; player.mp = 9999;
  SKILL_FNS.crusader_ult();
  out.r10shield = player.buffs.aegisShield | 0;
  await new Promise(r2 => setTimeout(r2, 1700));
  out.r10orbs = game.projectiles.filter(p => p && p.skill === 'holyorb').length;
  player.skillRanks = {};

  // --- F. zero stacks: shield + heal still fire, no orbs --------------------
  player._judgeStacks = 0; player.buffs.aegisShield = 0; game.projectiles.length = 0;
  player.skillCooldowns = {}; player.mp = 9999;
  SKILL_FNS.crusader_ult();
  await new Promise(r2 => setTimeout(r2, 900));
  out.zero = { shield: player.buffs.aegisShield | 0,
    orbs: game.projectiles.filter(p => p && p.skill === 'holyorb').length };

  out.desc = SKILLS.crusader_ult && SKILLS.crusader_ult.desc;
  game.monsters.length = 0; game.projectiles.length = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('meter :', JSON.stringify({ after1: r.after1, spamBlocked: r.spamBlocked, capped: r.capped, nonCrusader: r.nonCrusader }));
console.log('cast  :', JSON.stringify(r.cast), 'bridged:', r.aegisBridged);
console.log('volley:', JSON.stringify(r.volley));
console.log('pull  :', JSON.stringify(r.pull));
console.log('shield:', JSON.stringify(r.shield));
console.log('r10   : shield', r.r10shield, 'orbs', r.r10orbs, '| zero-stack:', JSON.stringify(r.zero));

ok('a hit grants the first Judgement stack', r.after1 === 1, { after1: r.after1 });
ok('the 400ms rate limit blocks same-breath spam', r.spamBlocked === true, {});
ok('the meter caps at 5', r.capped === 5, { capped: r.capped });
ok('a non-Crusader gains no stacks', r.nonCrusader === 0, { got: r.nonCrusader });

ok('the cast consumes the meter', r.cast.stacksAfter === 0, r.cast);
ok('full heal still fires on cast', r.cast.healed === true, r.cast);
ok('the party shield is 15s at rank 0', r.cast.shieldMs === 15000, r.cast);
ok('the shield bridges into the shipped aegis machinery', r.aegisBridged === true, {});

ok('full charge launches 10 homing orbs', r.volley.count === 10 && r.volley.homing === true, r.volley);
ok('every orb bursts in a small 90px explosion', r.volley.explode === true, r.volley);
ok('orbs opt out of Double Shot cloning', r.volley.noDouble === true, r.volley);
ok('the pull drags a monster 340px out well toward the paladin', r.pull.moved >= 60, r.pull);

ok('the shield HALVES a real monster-skill hit', r.shield.halved === true, r.shield);
ok('the shield buff ticks down like every other buff', r.decays === true, {});
ok('aegisShield is party-sharable AND has a slot from boot (receiver precondition)',
   r.sharable === true && r.slotFromBoot === true, { sharable: r.sharable, slot: r.slotFromBoot });
ok('the HUD pill exists and reuses the crusader_ult art', r.pill === true, {});

ok('rank 10: shield 20s and 12 orbs', r.r10shield === 20000 && r.r10orbs === 12, { shield: r.r10shield, orbs: r.r10orbs });
ok('zero stacks: shield + heal still fire, but NO orbs (strength must be earned)',
   r.zero.shield === 15000 && r.zero.orbs === 0, r.zero);
ok('the tooltip teaches the meter', /judgement/i.test(r.desc || '') && /15s/i.test(r.desc || ''), { desc: r.desc });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
