// Necrotic Ascendance as a walking soul maelstrom, plus the vortex rim fix.
//
//   pool rim: pull 4.2 must beat the fastest flier (speed 1.6 -> 3.84 px/f)
//   ult: follows the player, drags foes on the shared machinery, drains +
//        harvests souls twice a second, collapse scales with the harvest.
// Everything drives live systems: real hazards ticking in updateProjectiles,
// real scheduleSkillTimer chains, real hitMonster drains.
//   node scripts/lich_maelstrom_test.mjs [port]
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
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof updateProjectiles === 'function', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  game.paused = false;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'lich';
  player.hp = getMaxHp(); player.mp = 9999; player.skillCooldowns = {};
  const mob = (x, y, extra) => Object.assign({
    x, y, w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9, def: 0,
    type: 'slime', level: 1, speed: 1.2, facing: 1, vx: 0, vy: 0, name: 'dummy',
  }, extra || {});

  // --- A. POOL RIM RACE: the fastest flier in the sheet, parked at the rim --
  out.rimRace = (() => {
    game.hazards.length = 0; game.monsters.length = 0;
    SKILL_FNS.lich_harvest();
    const h = game.hazards.find(z => z.type === 'soul_vortex');
    const cx = h.cx, cy = h.y + h.h / 2;
    const m = mob(cx + (h.w / 2) - 30, cy - 30, { flies: true, speed: 1.6, facing: 1 });
    game.monsters.push(m);
    const maxV = m.speed * 2.4;   // 3.84 px/frame - the sheet's ceiling
    const start = m.x;
    for (let f = 0; f < 120; f++) {
      // the flier swims OUTWARD at its cap every frame, like a fleeing AI
      m.vx += (maxV - m.vx) * 0.16;
      if (Math.abs(m.vx) > maxV) m.vx *= maxV / Math.abs(m.vx);
      m.x += m.vx;
      updateProjectiles(16);
    }
    const captured = m.x < start - 40;
    game.hazards.length = 0; game.monsters.length = 0;
    return { start: Math.round(start), end: Math.round(m.x), captured, maxV };
  })();

  // --- B. THE MAELSTROM ------------------------------------------------------
  game.hazards.length = 0; game.monsters.length = 0; game.projectiles.length = 0;
  const far = mob(player.x + 260, player.y - 30, { _noGravity: false });
  const flee = mob(player.x - 200, player.y, { speed: 1.2, facing: -1 });
  game.monsters.push(far, flee);
  const farStart = far.x;
  player.hp = Math.floor(getMaxHp() * 0.5);
  const hpAtCast = player.hp;

  SKILL_FNS.lich_ult();
  const hz = game.hazards.find(z => z.type === 'necro_maelstrom');
  out.spawned = { exists: !!hz, follows: !!(hz && hz.follow), rx: hz && hz.rx, ry: hz && hz.ry,
    protectedType: (typeof _HAZ_PROTECTED !== 'undefined') && _HAZ_PROTECTED.has('necro_maelstrom') };

  // drive the world: hazard ticks in updateProjectiles; also walk the player
  // so "the storm follows" is tested with real displacement.
  let soulsMid = 0, followedOk = true, drainSeen = false;
  const hp0 = { far: far.currentHp, flee: flee.currentHp };
  for (let f = 0; f < 150; f++) {
    if (f === 60) { player.x += 140; }   // the lich repositions mid-storm
    flee.vx = -flee.speed; flee.x += flee.vx;   // the fleeing walker, AI-style
    updateProjectiles(16);
    const z = game.hazards.find(q => q.type === 'necro_maelstrom');
    if (z) {
      soulsMid = z.souls | 0;
      if (Math.abs(z.cx - (player.x + player.w / 2)) > 2) followedOk = false;
    }
  }
  drainSeen = far.currentHp < hp0.far || flee.currentHp < hp0.flee;
  out.mid = { soulsMid, followedOk, drainSeen,
    farMoved: Math.round(farStart - far.x),
    healed: player.hp > hpAtCast };

  // --- C. the collapse reads the harvest and scales ------------------------
  // wait out the remaining real-time to the 6s finale
  await new Promise(r2 => setTimeout(r2, 6300));
  const gone = !game.hazards.some(z => z.type === 'necro_maelstrom');
  out.collapse = { hazardGone: gone, soulsBanked: soulsMid };

  // --- D. empty-field cast: storm exists, zero souls, finale still fires ---
  game.hazards.length = 0; game.monsters.length = 0;
  player.skillCooldowns = {}; player.mp = 9999; player.hp = getMaxHp();
  SKILL_FNS.lich_ult();
  await new Promise(r2 => setTimeout(r2, 6300));
  out.empty = { cleanedUp: !game.hazards.some(z => z.type === 'necro_maelstrom') };

  out.desc = SKILLS.lich_ult && SKILLS.lich_ult.desc;
  game.hazards.length = 0; game.monsters.length = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('rim race :', JSON.stringify(r.rimRace));
console.log('spawned  :', JSON.stringify(r.spawned));
console.log('mid      :', JSON.stringify(r.mid));
console.log('collapse :', JSON.stringify(r.collapse), '| empty:', JSON.stringify(r.empty));

ok('POOL: the fastest flier in the sheet cannot out-swim the rim any more',
   r.rimRace.captured === true, r.rimRace);
ok('ULT: casting spawns the maelstrom hazard', r.spawned.exists === true, r.spawned);
ok('...as a FOLLOWING storm with the bigger ellipse', r.spawned.follows === true && r.spawned.rx === 300 && r.spawned.ry === 130, r.spawned);
ok('...protected from the ambient hazard sweep', r.spawned.protectedType === true, r.spawned);
ok('the storm re-centres on the lich after they reposition mid-cast', r.mid.followedOk === true, r.mid);
ok('a foe 260px out is dragged toward the lich', r.mid.farMoved >= 60, r.mid);
ok('held foes are drained (real hitMonster ticks)', r.mid.drainSeen === true, r.mid);
ok('souls are harvested from the drain ticks', r.mid.soulsMid >= 3, r.mid);
ok('draining heals the lich above the cast point', r.mid.healed === true, r.mid);
ok('the 6s collapse consumes the storm', r.collapse.hazardGone === true, r.collapse);
ok('an empty-field cast still cleans up its storm', r.empty.cleanedUp === true, r.empty);
ok('the tooltip teaches the maelstrom + the soul-scaled collapse',
   /maelstrom/i.test(r.desc || '') && /soul/i.test(r.desc || ''), { desc: r.desc });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
