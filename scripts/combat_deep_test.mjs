// DEEP COMBAT DEBUG â€” drives the real damage pipeline end to end.
// =============================================================================
// Five sections, all through live functions (performMelee / hitMonster /
// updateMonsters / updateProjectiles), never reimplemented math:
//   1. DAMAGE FUNNEL  dead-gate, NaN guard, overkill, single kill-credit
//   2. TRAITS         parry / phantomDodge / armorShield / splitsOnHit
//   3. STATUSES       freeze stops movement, stun, burn ticks + expiry
//   4. PLAYER-SIDE    contact damage, iframes, block DR, death at 0 HP
//   5. FUZZ           1200 frames of chaotic combat + invariant scans:
//                     finite HP/x/y everywhere, hp<=maxHp, and NO damage
//                     number that prints NaN/Infinity/undefined.
// Run: node scripts/combat_deep_test.mjs   (needs Edge; MOJI_PW_EXE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
import { spawn } from 'node:child_process';
const PORT = 9005;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const R = await page.evaluate(async () => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  // Level 99: the accuracy system gives large miss rates against
  // higher-level mobs (by design) â€” at Lv 30 vs a Lv 45 hare, most "trait
  // dodges" in the first run were actually level-gap misses. 99 neutralises
  // the gap so the trait rolls are what get measured.
  player.cls = 'warrior'; player.level = 99; player.maxHp = 5000; player.hp = 5000;
  player.mp = 999; player.maxMp = 999;
  // v0.29.473 â€” the 90% same-level hit cap this suite originally discovered
  // (7 of 25 "phantom dodges" were plain baseline misses) was retuned to 100
  // at gap <= 0 per user. baseAcc stays as a guard: if the floor ever comes
  // back, trait tests still measure traits rather than the floor.
  player.baseAcc = 10;
  loadMap('forest'); game.paused = false;
  const clear = () => { game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0; };
  const fresh = (type, x = 400, hp = null) => {
    const m = spawnMonster(x, 300, type, false);
    m.evasion = 0; m.freezeTimer = 0; m.stunTimer = 0;
    // a Lv 99 melee one-shots low-tier mobs, which silently voids any test
    // that wants a SECOND hit â€” pin the pool high unless the test says not to
    if (hp !== null) { m.maxHp = hp; m.currentHp = hp; }
    // settle onto the ground so melee range checks are honest
    for (let f = 0; f < 60; f++) { game.time++; updateMonsters(16.667); }
    return m;
  };
  const standBeside = (m) => {
    player.x = m.x - player.w - 6; player.y = m.y + m.h - player.h;
    player.vx = 0; player.vy = 0; player.facing = 1; player.invulnerable = 0;
  };

  // â•â• 1. DAMAGE FUNNEL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  clear();
  let m = fresh('slime', 400, 100000);            // big pool: melee must not pre-kill
  standBeside(m);
  const hp0 = m.currentHp;
  performMelee(90, 1.0);
  ok('basic melee lands (HP drops)', m.currentHp < hp0 && m.currentHp > 0, `${hp0} -> ${m.currentHp}`);
  ok('damage is a finite integer', Number.isInteger(hp0 - m.currentHp), hp0 - m.currentHp);

  // NaN guard
  const hpN = m.currentHp;
  hitMonster(m, NaN, false, 'melee');
  hitMonster(m, Infinity, false, 'melee');
  ok('NaN/Infinity damage is rejected', m.currentHp === hpN && Number.isFinite(m.currentHp), m.currentHp);

  // overkill + single kill credit. Kill rewards are EXP directly on the
  // player plus mojicoin DROPS into game.drops (picked up on touch) â€” the
  // wallet is not credited at kill time, so drops are what get asserted.
  const exp0 = player.exp, drops0 = (game.drops || []).length;
  hitMonster(m, 1e9, false, 'melee');
  const expGain = player.exp - exp0, dropGain = (game.drops || []).length - drops0;
  ok('overkill kills cleanly', m.currentHp <= 0 && Number.isFinite(m.currentHp), m.currentHp);
  ok('kill grants EXP + spawns coin drops', expGain > 0 && dropGain > 0, `exp+${expGain} drops+${dropGain}`);
  // corpse gate: a delayed second hit must grant nothing again
  const exp1 = player.exp, drops1 = (game.drops || []).length;
  hitMonster(m, 1e9, false, 'melee');
  ok('dead-monster gate blocks double kill credit', player.exp === exp1 && (game.drops || []).length === drops1,
     `exp+${player.exp - exp1} drops+${(game.drops || []).length - drops1}`);

  // crit is a flag, not a second multiplier inside hitMonster
  clear();
  const a = fresh('slime', 380, 100000), b = fresh('slime', 900, 100000);
  a.def = 0; b.def = 0;
  const da0 = a.currentHp, db0 = b.currentHp;
  player._activeSynergies = null;
  hitMonster(a, 200, false, 'x_probe');   // unknown skill: no basic/milestone branches
  hitMonster(b, 200, true, 'x_probe');
  const dA = da0 - a.currentHp, dB = db0 - b.currentHp;
  ok('crit flag alone does not change damage inside the funnel', dA === dB, `${dA} vs ${dB}`);

  // â•â• 2. TRAITS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // parry: over many trials some parries occur and a parried hit does 0
  clear();
  m = fresh('bonebosn', 400, 100000);
  if (m && m.traits && m.traits.parryChance) {
    let parried = 0, landed = 0;
    for (let i = 0; i < 80; i++) {
      const h = m.currentHp;
      if (m.currentHp <= 0) break;
      hitMonster(m, 5, false, 'x_probe');
      if (m.currentHp === h) parried++; else landed++;
    }
    ok('parry fires sometimes and negates damage', parried > 0 && landed > 0, `${parried} parried / ${landed} landed`);
  } else ok('parry trait present on bonebosn', false, 'no trait');

  // phantomDodge: dodge = 0 damage + reposition
  clear();
  m = fresh('glasswindHare', 400, 100000);
  if (m && m.traits && m.traits.phantomDodge) {
    let dodged = 0, moved = 0;
    for (let i = 0; i < 80 && m.currentHp > 0; i++) {
      const h = m.currentHp, x = m.x;
      hitMonster(m, 3, false, 'x_probe');
      if (m.currentHp === h) { dodged++; if (m.x !== x) moved++; }
    }
    ok('phantom dodge negates + repositions', dodged > 0 && moved === dodged, `${dodged} dodges, ${moved} teleports`);
  } else ok('phantomDodge trait present on glasswindHare', false, 'no trait');

  // armorShield: frontal < flank. Averaged over 12 hits a side so a single
  // parry-like negation or rounding can't flip the comparison; 800 base
  // damage so the golem's DEF cannot floor both sides to the same number.
  clear();
  m = fresh('smithgolem', 400, 1000000);
  if (m && m.traits && m.traits.armorShield) {
    const swing = (px, n) => {
      player.x = px;
      let total = 0;
      for (let i = 0; i < n; i++) { const h = m.currentHp; hitMonster(m, 800, false, 'x_probe'); total += h - m.currentHp; }
      return total / n;
    };
    m.facing = -1;                                   // facing WEST
    const frontal = swing(m.x - 200, 12);            // west of it = frontal
    const flank = swing(m.x + m.w + 200, 12);        // east = flank
    ok('armor shield reduces frontal damage only', frontal < flank && frontal > 0,
       `frontal avg ${frontal.toFixed(0)} vs flank avg ${flank.toFixed(0)}`);
  } else ok('armorShield trait present on smithgolem', false, 'no trait');

  // splitsOnHit: one split, mirages carry no rewards, never re-split
  clear();
  m = fresh('mirageStalker');
  if (m && m.traits && m.traits.splitsOnHit) {
    const before = game.monsters.length;
    hitMonster(m, 5, false, 'x_probe');
    const mirages = game.monsters.filter(q => q._isMirage);
    ok('first hit splits into mirages', mirages.length >= 2, `${game.monsters.length - before} spawned`);
    ok('mirages carry no EXP/coins', mirages.every(q => q.exp === 0 && q.mojicoins === 0), '');
    const cnt = game.monsters.length;
    if (mirages[0]) hitMonster(mirages[0], 1, false, 'x_probe');
    ok('mirages never re-split', game.monsters.length === cnt, '');
  } else ok('splitsOnHit trait present on mirageStalker', false, 'no trait');

  // â•â• 3. STATUSES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  clear();
  m = fresh('slime');
  m.aggroTarget = player; player.x = m.x + 400;      // give it a reason to walk
  m.freezeTimer = 1500;
  const fx0 = m.x;
  for (let f = 0; f < 30; f++) { game.time++; updateMonsters(16.667); }
  const frozenMoved = Math.abs(m.x - fx0);
  m.freezeTimer = 0;
  const fx1 = m.x;
  for (let f = 0; f < 60; f++) { game.time++; updateMonsters(16.667); }
  const thawedMoved = Math.abs(m.x - fx1);
  ok('freeze stops movement, thaw restores it', frozenMoved < 2 && thawedMoved > 2,
     `frozen moved ${frozenMoved.toFixed(1)}px, thawed ${thawedMoved.toFixed(1)}px`);

  clear();
  m = fresh('slime', 400, 100000);       // must SURVIVE the burn window â€” the
  m.burnTimer = 1200; m.burnDmg = 8;     // first run's 8-HP slime died mid-burn
  const bh0 = m.currentHp;               // and dead mobs stop decrementing
  for (let f = 0; f < 130; f++) { game.time++; updateMonsters(16.667); }
  ok('burn ticks damage over time', m.currentHp < bh0 && m.currentHp > 0, `${bh0} -> ${m.currentHp}`);
  ok('burn expires and clears burnDmg', (m.burnTimer || 0) <= 0 && (m.burnDmg || 0) === 0,
     `timer ${m.burnTimer}, dmg ${m.burnDmg}`);

  // â•â• 4. PLAYER-SIDE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // Contact damage needs updatePlayer in the loop too (the first run only
  // stepped updateMonsters and measured -0 HP), and the camera near the
  // fight â€” off-screen mobs deliberately deal no contact damage (v0.25.493).
  clear();
  m = fresh('slime');
  m.atk = 60; m.aggroTarget = player;
  player.x = m.x; player.y = m.y; player.invulnerable = 0; player.hp = 5000;
  if (game.camera) { game.camera.x = Math.max(0, m.x - 400); game.camera.y = 0; }
  let php = player.hp;
  for (let f = 0; f < 60 && player.hp === php; f++) {
    game.time++; updateMonsters(16.667); updatePlayer(16.667);
    player.x = m.x; player.y = m.y;                  // stay overlapped
    // Contact only lands from the side the mob FACES (dodging behind a mob
    // is a designed mechanic â€” bosses are exempt). Face it at the player so
    // the test measures contact damage, not the back-dodge rule.
    m.facing = ((player.x + player.w / 2) >= (m.x + m.w / 2)) ? 1 : -1;
  }
  const contactDmg = php - player.hp;
  ok('contact damage applies', contactDmg > 0, `-${contactDmg} HP`);
  ok('contact grants iframes', player.invulnerable > 0, `invuln ${player.invulnerable}`);
  php = player.hp;
  for (let f = 0; f < 10; f++) {
    game.time++; updateMonsters(16.667); updatePlayer(16.667);
    player.x = m.x; player.y = m.y;
    m.facing = ((player.x + player.w / 2) >= (m.x + m.w / 2)) ? 1 : -1;
  }
  ok('iframes block immediate re-hit', player.hp === php, `-${php - player.hp} during iframes`);

  // death at 0 HP runs without exceptions and leaves a sane state
  clear();
  m = fresh('slime');
  m.atk = 999999; m.aggroTarget = player;
  player.x = m.x; player.y = m.y; player.invulnerable = 0; player.hp = 10; player._god = false;
  let deathErr = null;
  try { for (let f = 0; f < 120; f++) { game.time++; updateMonsters(16.667); updatePlayer(16.667); } }
  catch (e) { deathErr = String(e).slice(0, 160); }
  ok('lethal hit + death flow throws nothing', !deathErr, deathErr || `hp ${player.hp}`);
  ok('post-death state is finite', Number.isFinite(player.hp) && Number.isFinite(player.x) && Number.isFinite(player.y),
     `hp ${player.hp}`);
  for (const id of ['class-select-modal','loading-overlay','story-beat-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }

  // â•â• 5. FUZZ + INVARIANT SCAN â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  loadMap('forest'); game.paused = false; clear();
  player.hp = 5000; player.maxHp = 5000; player.mp = 999; player.invulnerable = 0;
  const KIT = ['rush', 'powerStrike', 'magicBolt', 'whirlwind', 'slash'];
  const TYPES = ['slime', 'snail', 'petalfly', 'mushpup', 'goblinScout', 'sparkling'];
  let scanFail = null, fuzzErr = null, badNumber = null;
  const t0 = Date.now();
  try {
    for (let f = 0; f < 1200; f++) {
      game.time++;
      if (f % 40 === 0 && game.monsters.length < 14) {
        const mm = spawnMonster(150 + Math.random() * 2800, 200 + Math.random() * 200,
          TYPES[(Math.random() * TYPES.length) | 0], false);
        if (mm) mm.aggroTarget = player;
      }
      if (f % 7 === 0) { try { castSkill(KIT[(Math.random() * KIT.length) | 0]); } catch (e) {} }
      if (f % 5 === 0) { try { performMelee(90, 1.0); } catch (e) {} }
      game.keys = game.keys || {};
      game.keys['arrowleft'] = Math.random() < 0.3;
      game.keys['arrowright'] = Math.random() < 0.4;
      game.keys['arrowup'] = Math.random() < 0.1;
      updatePlayer(16.667); updateMonsters(16.667); updateProjectiles(16.667);
      player.hp = Math.max(player.hp, 200);           // keep the fight going
      if (f % 60 === 0 && !scanFail) {
        if (!Number.isFinite(player.hp) || !Number.isFinite(player.x) || !Number.isFinite(player.y))
          scanFail = `player non-finite at f${f}: hp=${player.hp} x=${player.x}`;
        for (const q of game.monsters) {
          if (!Number.isFinite(q.currentHp) || !Number.isFinite(q.x) || !Number.isFinite(q.y)) {
            scanFail = `monster ${q.type} non-finite at f${f}: hp=${q.currentHp} x=${q.x} y=${q.y}`; break;
          }
          if (q.currentHp > q.maxHp + 1) { scanFail = `monster ${q.type} hp ${q.currentHp} > maxHp ${q.maxHp} at f${f}`; break; }
        }
        for (const p of game.projectiles) {
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || (p.damage != null && !Number.isFinite(p.damage))) {
            scanFail = `projectile ${p.skill} non-finite at f${f}`; break;
          }
        }
        for (const d of game.damageNumbers) {
          const s = String(d.text);
          if (s.includes('NaN') || s.includes('Infinity') || s.includes('undefined')) {
            badNumber = `"${s}" at f${f}`; break;
          }
        }
      }
    }
  } catch (e) { fuzzErr = String(e).slice(0, 200); }
  game.keys = {};
  ok('1200-frame combat fuzz throws nothing', !fuzzErr, fuzzErr || `${((Date.now() - t0) / 1000).toFixed(1)}s`);
  ok('invariants hold through the fuzz', !scanFail, scanFail || 'all finite, hp<=maxHp');
  ok('no NaN/Infinity/undefined ever shown to the player', !badNumber, badNumber || '');
  return res;
});

let pass = 0, fail = 0;
for (const r of R) {
  if (r.pass) { pass++; console.log(`  PASS  ${r.n}${r.extra ? '  (' + r.extra + ')' : ''}`); }
  else { fail++; console.log(`  FAIL  ${r.n}  ${r.extra}`); }
}
console.log(`\n${pass} passed, ${fail} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(fail || errs.length ? 1 : 0);
