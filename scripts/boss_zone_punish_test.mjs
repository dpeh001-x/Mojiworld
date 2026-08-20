// An attack that draws its kill zone punishes you for standing in it.
//
// Per user: "make sure for attacks that draw killzones they have a punishing
// attack and sometimes stat affliction like stun."
//
// The damage half was already authored (zone attacks carry dmgMul 1.3-3.0 vs
// contact's 1.0, plus the boss heavy band) — asserted here off the REAL spawned
// projectile. The affliction half is new: zone projectiles ride the existing
// heavy-stagger system (_lxHeavyStaggerMs — 2.5x stagger, a 12% roll into an
// announced full-second STUN, honouring stun immunity and resist), and dash
// contact carries the same weight while the dash is live.
//
// The swing projectile is captured from a real updateMonsters spawn, then
// replayed at the player through the real updateProjectiles hit path. The stun
// roll is random by design, so it is measured statistically over 70 landed
// hits rather than pinned.
//   node scripts/boss_zone_punish_test.mjs [port]
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
await page.waitForFunction(() => typeof updateMonsters === 'function' && typeof updateProjectiles === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const cs2 = document.getElementById('class-select-modal'); if (cs2) cs2.style.display = 'none';
  player.cls = 'warrior'; player.level = 60; player.hp = getMaxHp();
  window._prologueActive = false;
  if (typeof STORY_BEATS === 'object') { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; }
  try { loadMap('glasswindSteppe'); } catch (e) {}
  game.paused = false;
  game.camera.x = 400; game.camera.y = 0;

  const mkBoss = (key, px) => {
    const t = monsterTypes[key] || {};
    player.x = px; player.y = 400;
    const m = Object.assign({}, t, {
      type: key, name: t.name || key, w: t.w, h: t.h,
      x: 800, y: 400 - (t.h - 60), vx: 0, vy: 0, onGround: true,
      maxHp: 1000000, currentHp: 1000000, isBoss: !!t.boss, boss: !!t.boss,
      level: t.level || 50, def: 0, evasion: 0, exp: 0, mojicoins: 0,
      traits: t.traits, aggroTarget: player, facing: -1,
      // Worthy by construction: raw swing (atk x2) lands at ~60% of maxHp.
      atk: Math.ceil(((typeof getMaxHp === 'function') ? getMaxHp() : 1000) * 0.3),
      _bigMeleeCd: 0, _columnCd: 99999, _bdCd: 99999, shootTimer: 99999,
    });
    game.monsters.length = 0; game.monsters.push(m);
    game.projectiles.length = 0;
    return m;
  };
  const tickUntil = (fn, pred, cap) => {
    for (let i = 0; i < (cap || 120); i++) { try { fn(16); } catch (e) {} if (pred()) return i; }
    return -1;
  };

  // ---- capture a REAL swing projectile off Barnaby ----
  const boss = mkBoss('young_confused_barnaby', 790);
  tickUntil(updateMonsters, () => game.projectiles.some(p => p.owner === 'enemy' && p.skill === 'swing'), 120);
  const realSwing = game.projectiles.find(p => p.owner === 'enemy' && p.skill === 'swing');
  out.captured = !!realSwing;
  out.swingDamage = realSwing ? realSwing.damage : null;
  out.bossAtk = boss.atk;
  out.zoneFlag = realSwing ? !!realSwing._zoneAttack : false;

  // ---- replay it at the player, many times, through the real hit path ----
  const resetPlayer = () => {
    player.hp = getMaxHp(); player.invulnerable = 0; player.hitStun = 0;
    player.parryWindow = 0; player.blockTimer = 0; player._aegis = false;
    player.tree = player.tree || {}; player.tree.stunImmune = false;
    game.damageNumbers.length = 0;
  };
  const throwAt = (proto, strip, immune) => {
    resetPlayer();
    if (immune) player.tree.stunImmune = true;   // AFTER the reset, which clears it
    const clone = Object.assign({}, proto, {
      x: player.x - 4, y: player.y - 4, w: 60, h: 60, life: 6, vx: 0, vy: 0,
    });
    if (strip) delete clone._zoneAttack;
    game.monsters.length = 0;                 // no contact noise during the replay
    game.projectiles.length = 0; game.projectiles.push(clone);
    try { updateProjectiles(16); } catch (e) {}
    const landed = player.hp < getMaxHp();
    const stunned = game.damageNumbers.some(d => String(d.text || '').includes('STUNNED'));
    return { landed, stun: Math.round(player.hitStun), stunned, lost: getMaxHp() - player.hp };
  };

  if (realSwing) {
    let landed = 0, stuns = 0; const staggers = [];
    for (let i = 0; i < 70; i++) {
      const t = throwAt(realSwing, false);
      if (!t.landed) continue;
      landed++;
      if (t.stunned) stuns++; else staggers.push(t.stun);
    }
    out.zoneHits = { landed, stuns, minStagger: staggers.length ? Math.min(...staggers) : null,
      maxStagger: staggers.length ? Math.max(...staggers) : null };
    // the SAME projectile without the flag — pins the delta to the flag itself
    const plain = [];
    for (let i = 0; i < 12; i++) { const t = throwAt(realSwing, true); if (t.landed) plain.push(t.stun); }
    out.plainStagger = plain.length ? Math.max(...plain) : null;
    // stun immunity is honoured
    let immuneMax = 0;
    for (let i = 0; i < 12; i++) {
      const t = throwAt(realSwing, false, true); if (t.landed) immuneMax = Math.max(immuneMax, t.stun);
    }
    out.immuneMax = immuneMax;
    player.tree.stunImmune = false;
  }

  // ---- a WEAK boss swing (trivial vs this player) is unmarked: no heavy
  // stagger, no stun — the punishment follows the drawn zone, per the rule
  // that justified it ("the zone bought you a fair read").
  {
    const t2 = monsterTypes.young_confused_barnaby;
    const weak = Object.assign({}, t2, { type: 'young_confused_barnaby', w: t2.w, h: t2.h,
      x: 800, y: 400 - (t2.h - 60), vx: 0, vy: 0, onGround: true, maxHp: 1000000, currentHp: 1000000,
      isBoss: true, boss: true, level: 40, def: 0, evasion: 0, exp: 0, mojicoins: 0,
      traits: t2.traits, aggroTarget: player, facing: -1, atk: 10,
      _bigMeleeCd: 0, _columnCd: 99999, _bdCd: 99999, shootTimer: 99999 });
    player.x = 790; player.y = 400;
    game.monsters.length = 0; game.monsters.push(weak); game.projectiles.length = 0;
    for (let i = 0; i < 120; i++) { try { updateMonsters(16); } catch (e) {}
      if (game.projectiles.some(p => p.owner === 'enemy' && p.skill === 'swing')) break; }
    const wproto = game.projectiles.find(p => p.owner === 'enemy' && p.skill === 'swing');
    let maxStagger = null, stuns = 0, landed = 0;
    if (wproto) for (let i = 0; i < 25 && landed < 10; i++) {
      const tr = throwAt(wproto, false);
      if (!tr.landed) continue;
      landed++;
      if (tr.stunned) stuns++;
      maxStagger = Math.max(maxStagger || 0, tr.stun);
    }
    out.weakSwing = { flag: wproto ? !!wproto._zoneAttack : null, landed, stuns, maxStagger };
  }

  // ---- dash contact carries the same weight while the dash is live ----
  {
    const m = mkBoss('legosaurus', 700);
    m._bdCd = 0; m._bigMeleeCd = 99999;
    tickUntil(updateMonsters, () => m._bdPhase === 'dash', 140);
    // park the player in the lane, fresh and vulnerable
    player.x = m.x - 300; player.y = m.y + m.h - player.h - 2;
    player.hp = getMaxHp(); player.invulnerable = 0; player.hitStun = 0;
    game.damageNumbers.length = 0;
    tickUntil(updateMonsters, () => player.hp < getMaxHp(), 60);
    out.dashContact = { landed: player.hp < getMaxHp(), stun: Math.round(player.hitStun),
      stunned: game.damageNumbers.some(d => String(d.text || '').includes('STUNNED')) };
    // plain contact for the same boss, dash over
    tickUntil(updateMonsters, () => !m._braceDashing, 80);
    m._bdCd = 99999;
    player.x = m.x - 10; player.y = m.y + m.h - player.h - 2;
    player.hp = getMaxHp(); player.invulnerable = 0; player.hitStun = 0;
    tickUntil(updateMonsters, () => player.hp < getMaxHp(), 60);
    out.plainContact = { landed: player.hp < getMaxHp(), stun: Math.round(player.hitStun) };
  }

  game.monsters.length = 0; game.projectiles.length = 0;
  player.hp = getMaxHp(); player.hitStun = 0; player.invulnerable = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('captured real swing:', r.captured, '| damage', r.swingDamage, 'vs boss atk', r.bossAtk, '| zone-flagged:', r.zoneFlag);
console.log('70 zone hits       :', JSON.stringify(r.zoneHits));
console.log('same proj, no flag :', r.plainStagger, '| stun-immune max:', r.immuneMax);
console.log('weak boss swing    :', JSON.stringify(r.weakSwing));
console.log('dash contact       :', JSON.stringify(r.dashContact), '| plain contact:', JSON.stringify(r.plainContact));

const zh = r.zoneHits || {};
ok('the real swing spawn carries the zone flag', r.zoneFlag === true, { flag: r.zoneFlag });
ok('the zone attack is authored PUNISHING — damage well above the boss\'s raw atk',
   r.swingDamage != null && r.swingDamage >= r.bossAtk * 1.5, { damage: r.swingDamage, atk: r.bossAtk });
ok('a WEAK boss swing is unmarked and stays at the 200ms baseline — no zone, no zone punishment',
   r.weakSwing && r.weakSwing.flag === false && r.weakSwing.maxStagger != null && r.weakSwing.maxStagger <= 210 && r.weakSwing.stuns === 0,
   r.weakSwing);
ok('enough replayed hits landed to measure', zh.landed >= 40, { landed: zh.landed });
ok('a zone hit staggers HEAVY — 2.5x the 200ms baseline on every non-stun hit',
   zh.minStagger != null && zh.minStagger >= 490, { minStagger: zh.minStagger });
ok('...and SOMETIMES it stuns outright (12% roll, measured over the trials)',
   zh.stuns >= 2 && zh.stuns <= Math.ceil(zh.landed * 0.32), { stuns: zh.stuns, of: zh.landed });
ok('the SAME projectile without the zone flag stays at the 200ms baseline',
   r.plainStagger != null && r.plainStagger <= 210, { plainStagger: r.plainStagger });
ok('stun immunity is honoured — an immune player never exceeds the baseline',
   r.immuneMax <= 210, { immuneMax: r.immuneMax });
ok('dash contact mid-lane staggers heavy or stuns',
   r.dashContact && r.dashContact.landed && (r.dashContact.stun >= 340 || r.dashContact.stunned),
   r.dashContact);
ok('plain contact from the same boss stays light',
   r.plainContact && r.plainContact.landed && r.plainContact.stun <= 210, r.plainContact);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
