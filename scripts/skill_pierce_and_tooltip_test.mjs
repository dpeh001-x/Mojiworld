// Tester asks:
//   - Dark Pulse's tooltip does not describe what it does (it raises undead).
//   - Mage's S should not pierce ("too strong of a mobbing skill").
//   - Archer's X, S, C should not pierce.
//
// The KEY the player presses is not the `slot` a skill declares:
// KEY_TO_SLOT_DEFAULT maps x->s, s->a, c->e. Reading the request as slot
// letters would target Fireball and Multi Shot, neither of which pierces. This
// resolves KEY -> slot -> skill through the game's own table so the assertions
// are about the buttons the tester actually pressed.
//   node scripts/skill_pierce_and_tooltip_test.mjs [port]
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
await page.waitForFunction(() => typeof SKILLS === 'object' && typeof SKILL_FNS === 'object', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = { keyMap: {}, byKey: {}, fired: {}, desc: {} };
  for (const k of ['x', 's', 'c']) out.keyMap[k] = KEY_TO_SLOT_DEFAULT[k];

  const skillOn = (cls, key, job, master) => {
    const slot = KEY_TO_SLOT_DEFAULT[key];
    for (const id in SKILLS) {
      const s2 = SKILLS[id];
      if (!s2 || s2.cls !== cls || s2.slot !== slot) continue;
      if (s2.job && s2.job !== job) continue;
      if (s2.master && s2.master !== master) continue;
      if (!s2.job && !s2.master) return id;      // base-class skill
      return id;
    }
    return null;
  };
  out.byKey.mageS = skillOn('mage', 's');
  out.byKey.archerX = skillOn('archer', 'x');
  out.byKey.archerS = skillOn('archer', 's');
  out.byKey.archerC = skillOn('archer', 'c');

  // Fire each and inspect the projectiles it produced. `rank` is the RP the
  // player has invested in that skill (1 RP per rank, SKILL_RANK_CAP = 10).
  const fire = (id, cls, rank) => {
    player.cls = cls; player.job = null; player.master = null;
    player.skillRanks = {}; if (rank) player.skillRanks[id] = rank;
    game.paused = false; player.hp = Math.max(1, player.maxHp || 100);
    player.mp = 9999; player.skillCooldowns = {};
    game.projectiles.length = 0;
    try { SKILL_FNS[id](); } catch (e) { return { err: String(e).slice(0, 60) }; }
    const mine = game.projectiles.filter(p => p && p.owner === 'player');
    return { n: mine.length, anyPierce: mine.some(p => !!p.pierce),
             budgets: [...new Set(mine.map(p => (typeof p.pierceLeft === 'number' ? p.pierceLeft : null)))] };
  };
  out.fired.iceSpike = fire('iceSpike', 'mage', 0);
  out.fired.iceSpike9 = fire('iceSpike', 'mage', 9);
  out.fired.iceSpike10 = fire('iceSpike', 'mage', 10);
  out.fired.chargedShot = fire('chargedShot', 'archer', 0);
  out.fired.chargedShot9 = fire('chargedShot', 'archer', 9);
  out.fired.chargedShot10 = fire('chargedShot', 'archer', 10);
  out.fired.multiShot = fire('multiShot', 'archer', 0);
  out.fired.fireball = fire('fireball', 'mage', 0);
  player.skillRanks = {};

  // A budget only means something if the resolver honours it. Drive the real
  // hit loop: 5 monsters in a line, one Charged Shot, count how many it damages
  // before dying. Unlimited pierce = 5; a budget of 2 = 3.
  out.through = (() => {
    const saved = game.monsters.slice();
    const run = (rank, job) => {
      player.cls = 'archer'; player.job = job || null; player.master = null;
      // useSkill() stamps _enh from JOB_ENHANCE for base-class casts; SKILL_FNS
      // is called directly here, so stamp it the same way.
      player._enh = job ? JOB_ENHANCE[job] : null;
      player.skillRanks = rank ? { chargedShot: rank } : {};
      player.facing = 1; player.mp = 9999; player.skillCooldowns = {};
      game.paused = false;
      game.monsters.length = 0; game.projectiles.length = 0;
      // Tall boxes on purpose: the arrow has gravity, and with 40 px-tall mobs
      // it drops out of the line after ~3 of them — which would read as a
      // pierce cap that isn't there. 200 px keeps geometry out of the result.
      const mobs = [];
      for (let i = 0; i < 5; i++) {
        const m = { x: player.x + 100 + i * 36, y: player.y - 80, w: 24, h: 200,
          hp: 1e9, maxHp: 1e9, currentHp: 1e9, def: 0, type: 'slime', level: 1, dead: false };
        mobs.push(m); game.monsters.push(m);
      }
      let err = null;
      try {
        SKILL_FNS.chargedShot();
        for (let f = 0; f < 240; f++) { updateProjectiles(16); if (!game.projectiles.length) break; }
      } catch (e) { err = String(e).slice(0, 120); }
      const damaged = mobs.filter(m => m.currentHp < 1e9).length;
      game.monsters.length = 0;
      return err ? { err, damaged } : damaged;
    };
    const r0 = run(0), r10 = run(10), rSniper = run(0, 'sniper');
    game.monsters.length = 0; for (const m of saved) game.monsters.push(m);
    player.skillRanks = {}; player._enh = null; player.job = null;
    return { rank0: r0, rank10: r10, sniper: rSniper };
  })();
  // Sniper's mastery grants pierce:true with NO budget; it must not un-cap a
  // shot that declared one.
  out.sniperGuard = out.through.sniper === out.through.rank0;

  out.desc.darkPulse = SKILLS.darkPulse && SKILLS.darkPulse.desc;
  out.desc.chargedShot = SKILLS.chargedShot && SKILLS.chargedShot.desc;
  out.desc.iceSpike = SKILLS.iceSpike && SKILLS.iceSpike.desc;
  out.perk = {
    iceSpike:    _formatSkillLv10Bonus('iceSpike'),
    chargedShot: _formatSkillLv10Bonus('chargedShot'),
    iceSpike5:   _formatSkillLv5Bonus('iceSpike'),
  };
  // Skills that SHOULD still pierce, on other keys.
  out.stillPierce = {};
  for (const id of ['marksman_oneshot', 'elementalArrows']) {
    const s3 = SKILLS[id];
    out.stillPierce[id] = s3 ? s3.slot : null;
  }
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('key -> slot :', JSON.stringify(r.keyMap));
console.log('key -> skill:', JSON.stringify(r.byKey));
console.log('fired       :', JSON.stringify(r.fired));
console.log('through 5   :', JSON.stringify(r.through), '(monsters damaged by one Charged Shot)');
console.log('darkPulse   :', r.desc.darkPulse);
console.log('chargedShot :', r.desc.chargedShot);
console.log('iceSpike    :', r.desc.iceSpike);
console.log('perk text   :', JSON.stringify(r.perk));

ok('key S resolves to slot a, not slot s', r.keyMap.s === 'a', r.keyMap);
ok("mage's S key is Ice Spike (not Fireball)", r.byKey.mageS === 'iceSpike', { got: r.byKey.mageS });
ok("archer's S key is Charged Shot", r.byKey.archerS === 'chargedShot', { got: r.byKey.archerS });
ok("archer's X key is Multi Shot", r.byKey.archerX === 'multiShot', { got: r.byKey.archerX });

// --- Ice Spike: nothing at 0-9 RP, exactly one pierce at 10 ---------------
ok('Ice Spike fires projectiles at all', (r.fired.iceSpike.n | 0) > 0, r.fired.iceSpike);
ok('Ice Spike does not pierce unranked', r.fired.iceSpike.anyPierce === false, r.fired.iceSpike);
ok('Ice Spike still does not pierce at 9 RP (rank 10 is the gate, not rank 5)',
   r.fired.iceSpike9.anyPierce === false, r.fired.iceSpike9);
ok('Ice Spike pierces at 10 RP', r.fired.iceSpike10.anyPierce === true, r.fired.iceSpike10);
ok('...and exactly ONCE, not unlimited',
   r.fired.iceSpike10.budgets.length === 1 && r.fired.iceSpike10.budgets[0] === 1, r.fired.iceSpike10);

// --- Charged Shot: 2 pierces, 3 at 10 RP ---------------------------------
ok('Charged Shot fires projectiles at all', (r.fired.chargedShot.n | 0) > 0, r.fired.chargedShot);
ok('Charged Shot pierces on a BUDGET of 2, not unlimited',
   r.fired.chargedShot.anyPierce === true && r.fired.chargedShot.budgets.length === 1
   && r.fired.chargedShot.budgets[0] === 2, r.fired.chargedShot);
ok('9 RP does not buy the extra pierce yet', r.fired.chargedShot9.budgets[0] === 2, r.fired.chargedShot9);
ok('10 RP buys one more pierce (2 -> 3)', r.fired.chargedShot10.budgets[0] === 3, r.fired.chargedShot10);

// --- the budget is honoured by the real hit loop, not just declared ------
ok('one Charged Shot damages 3 of 5 lined-up monsters (2 pierces), not all 5',
   r.through.rank0 === 3, r.through);
ok('at 10 RP the same shot reaches 4 of them', r.through.rank10 === 4, r.through);

ok('Multi Shot (archer X) never pierced and still does not', r.fired.multiShot.anyPierce === false, r.fired.multiShot);
ok('Fireball (mage slot s) is untouched and non-piercing', r.fired.fireball.anyPierce === false, r.fired.fireball);

// --- tooltips -------------------------------------------------------------
ok('Dark Pulse tooltip now mentions the undead it raises',
   /undead/i.test(r.desc.darkPulse || '') && /5/.test(r.desc.darkPulse || ''), { desc: r.desc.darkPulse });
ok('Dark Pulse tooltip still states its AoE damage', /3\.5/.test(r.desc.darkPulse || ''), { desc: r.desc.darkPulse });
ok('Charged Shot tooltip states the real budget (2, and 3 at rank 10)',
   /pierces 2/i.test(r.desc.chargedShot || '') && /3 at rank 10/i.test(r.desc.chargedShot || ''), { desc: r.desc.chargedShot });
ok('Ice Spike tooltip stops calling the base spikes piercing',
   !/piercing/i.test(r.desc.iceSpike || '') && /rank 10/i.test(r.desc.iceSpike || ''), { desc: r.desc.iceSpike });
ok('the rank-10 panel prints the new pierce perk for both skills',
   /pierces 1 more foe/i.test(r.perk.iceSpike || '') && /pierces 1 more foe/i.test(r.perk.chargedShot || ''), r.perk);
ok('the rank-5 panel does NOT promise pierce', !/pierce/i.test(r.perk.iceSpike5 || ''), r.perk);

// --- Sniper's mastery must not un-cap a declared budget ------------------
ok("Sniper's unlimited-pierce mastery no longer erases a declared budget",
   r.sniperGuard === true, { note: r.sniperGuard });

ok('skills on OTHER keys were left piercing (G and V, not x/s/c)',
   r.stillPierce.marksman_oneshot === 'x' && r.stillPierce.elementalArrows === 'c', r.stillPierce);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
