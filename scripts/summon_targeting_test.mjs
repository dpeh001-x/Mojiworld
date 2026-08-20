// SUMMON AI — a summon must keep finding targets, not idle.
// ============================================================================
// Per user: "improve the various summons AI (lich, skyhunter etc.), make sure
// they are intelligent and try to keep finding targets to attack."
//
// Each family scores targets well but rejected them with hard gates and had no
// plan B — minions leash 700 px / |dy| <= 200, wolves _ALLY_LEASH 720 plus a
// 900 px engage gate, eagle |dx| > 950 or |dy| > 420. Past those the summon
// held NO target and milled around. Measured pre-fix over 12 s with live
// enemies up the whole time: 0.1% idle when foes were close and level, and
// 100% idle when they sat on a ledge, across the map, or both.
//
// Asserts the behaviour, not the constants: enemies are pinned in place so the
// numbers measure TARGETING rather than how a fight happened to go, and the
// normal close-and-level case is pinned too — a "fix" that simply removed the
// gates would break that one by dragging summons out of your fight.
// Run: node scripts/summon_targeting_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9343;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'AITest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  player.level = 99; player._god = true;
  player.job = 'warlock'; player.master = 'lich';
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 1400));
  game.paused = false;
  player.maxMp = 99999; player.mp = 99999; player.baseAtk = 500;
  const GY = 300;

  const pin = (list) => { for (const m of list) if (m) { m.currentHp = m.maxHp; m.x = m._px; m.y = m._py; m.vx = 0; m.vy = 0; } };
  const mk = (dx, dy) => {
    const m = spawnMonster(400 + dx, GY + dy, 'slime', false);
    if (m) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; m._px = 400 + dx; m._py = GY + dy; }
    return m;
  };
  const reset = () => {
    game.monsters.length = 0; game.minions = []; game.projectiles.length = 0;
    player.pet = null; player.ultPet = null; player.pack = [];
    player.x = 400; player.y = GY; player.vx = 0; player.vy = 0;
    player.skillCooldowns = {};
  };

  // ---- minions -------------------------------------------------------------
  const minionIdle = (place) => {
    reset();
    castSkill('darkPulse');
    const mons = place();
    let idle = 0, total = 0;
    for (let f = 0; f < 60 * 10; f++) {
      game.time += 16.667;
      pin(mons);
      try { updateMinions(16.667); } catch (e) {}
      try { updateMonsters(16.667); } catch (e) {}
      for (const mn of game.minions) {
        if (mn.spawn > 0) continue;
        total++; if (!mn._mnTgt) idle++;
      }
    }
    return { n: game.minions.length, idlePct: total ? +(idle / total * 100).toFixed(1) : -1 };
  };
  const mNormal = minionIdle(() => [mk(120, 0), mk(-140, 0)]);
  const mLedge  = minionIdle(() => [mk(120, -300), mk(-140, -300)]);
  const mFar    = minionIdle(() => [mk(900, 0), mk(-900, 0)]);

  // ---- wolf (Wild Bond / pack lifecycle) -----------------------------------
  const wolf = (() => {
    reset();
    player.pet = { x: 400, y: GY, vx: 0, vy: 0, hp: 80000, maxHp: 80000,
                   life: 60000, maxLife: 60000, cdAtk: 0, scale: 2.4 };
    const mons = [mk(950, 0)];                 // beyond _ALLY_LEASH and the engage gate
    const x0 = player.pet.x;
    let tgtFrames = 0;
    for (let f = 0; f < 60 * 10; f++) {
      game.time += 16.667;
      pin(mons);
      // the pet / pack / eagle lifecycle is ticked from inside updatePlayer
      try { updatePlayer(16.667); } catch (e) {}
      try { updateMonsters(16.667); } catch (e) {}
      if (player.pet && player.pet._tgtRef) tgtFrames++;
    }
    return { hasTarget: tgtFrames > 0, tgtPct: +(tgtFrames / (60 * 10) * 100).toFixed(1),
             moved: player.pet ? Math.round(player.pet.x - x0) : 0 };
  })();

  // ---- eagle (Skyhunter ult) ----------------------------------------------
  const eagle = (() => {
    reset();
    player.ultPet = { x: 400, y: GY - 80, vx: 0, vy: 0, hp: 9999, maxHp: 9999,
                      life: 60000, maxLife: 60000, shooter: true, fireCd: 0, scale: 1 };
    const mons = [mk(1400, 0)];                // well beyond its 950 px reach
    let tgtFrames = 0, shots = 0;
    for (let f = 0; f < 60 * 10; f++) {
      game.time += 16.667;
      pin(mons);
      const before = game.projectiles.length;
      // the pet / pack / eagle lifecycle is ticked from inside updatePlayer
      try { updatePlayer(16.667); } catch (e) {}
      if (game.projectiles.length > before) shots++;
      game.projectiles.length = 0;
      if (player.ultPet && player.ultPet._tgtRef) tgtFrames++;
    }
    return { hasTarget: tgtFrames > 0, tgtPct: +(tgtFrames / (60 * 10) * 100).toFixed(1), shots };
  })();

  // ---- HP pool: every summon should be the player's max HP x15 ------------
  const hp = (() => {
    reset();
    // getMaxHp() moves when the class changes, so each family's expectation is
    // captured at ITS OWN cast — a single up-front snapshot goes stale the
    // moment we switch to the archer kit and reports a false failure.
    const out = {};
    castSkill('darkPulse');
    const minion = game.minions.find(m => m && !m.mojimon) || null;
    out.playerMax = getMaxHp();
    out.minion = minion ? minion.maxHp : null;
    out.minionExpect = Math.floor(getMaxHp() * 15);

    player.cls = 'archer'; player.job = 'ranger'; player.master = 'skyhunter';
    player.skillCooldowns = {}; player.mp = 99999;
    out.wolfExpect = Math.floor(getMaxHp() * 15);
    try { castSkill('wildBond'); } catch (e) {}
    out.wolf = player.pet ? player.pet.maxHp : null;
    out.eagleExpect = Math.floor(getMaxHp() * 15);
    try { castSkill('skyhunter_ult'); } catch (e) {}
    out.eagle = player.ultPet ? player.ultPet.maxHp : null;
    player.master = 'beastmaster'; player.skillCooldowns = {}; player.ultPet = null; player.pack = [];
    out.packExpect = Math.floor(getMaxHp() * 15);
    try { castSkill('beastmaster_pack'); } catch (e) {}
    out.pack = (player.pack && player.pack[0]) ? player.pack[0].maxHp : null;
    return out;
  })();

  return { mNormal, mLedge, mFar, wolf, eagle, hp };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 125) });

ok('lich minions actually spawn', R.mNormal.n >= 3, `n=${R.mNormal.n}`);
// The tuned normal case must NOT regress — a fix that just deleted the gates
// would drag summons out of the player's fight and still pass everything else.
ok('minions stay engaged in an ordinary fight (unchanged)', R.mNormal.idlePct <= 5,
   `idle ${R.mNormal.idlePct}%`);
ok('minions find foes on a high ledge', R.mLedge.idlePct <= 20, `idle ${R.mLedge.idlePct}%`);
ok('minions find foes across the map', R.mFar.idlePct <= 20, `idle ${R.mFar.idlePct}%`);
ok('wolf keeps a target beyond its leash', R.wolf.hasTarget,
   `target held ${R.wolf.tgtPct}% of frames, moved ${R.wolf.moved}px`);
// Directional and generous: the target sits at +950, so idle drift after the
// player (measured -58px pre-fix) must not satisfy this.
ok('wolf actually travels toward that target', R.wolf.moved > 300,
   `moved ${R.wolf.moved}px toward a target at +950`);
ok('skyhunter eagle keeps a mark beyond its 950px reach', R.eagle.hasTarget,
   `mark held ${R.eagle.tgtPct}% of frames`);
ok('skyhunter eagle keeps firing at it', R.eagle.shots > 0, `${R.eagle.shots} shots`);


// ---- HP pool scales with the player (max HP x15) -------------------------
const H = R.hp;
const near = (v, e) => v != null && Math.abs(v - e) <= Math.max(2, e * 0.02);
const shown = (v, e) => (v == null ? 'NOT SUMMONED' : v) + ' vs expected ' + e;
ok('lich minion HP is player max HP x15', near(H.minion, H.minionExpect),
   shown(H.minion, H.minionExpect) + ' (player maxHp ' + H.playerMax + ')');
ok('wolf HP is player max HP x15', near(H.wolf, H.wolfExpect), shown(H.wolf, H.wolfExpect));
ok('skyhunter eagle HP is player max HP x15', near(H.eagle, H.eagleExpect), shown(H.eagle, H.eagleExpect));
ok('beastmaster pack HP is player max HP x15', near(H.pack, H.packExpect), shown(H.pack, H.packExpect));

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
