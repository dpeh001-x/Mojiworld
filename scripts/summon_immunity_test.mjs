// SUMMON AI ROUND 3 — immune targets are not targets.
// ============================================================================
// Per user: "make even summon AI even smarter."
//
// Measured the remaining candidates first: shooters-first (95%), execute bias
// (92.5%) and the MojiMon honouring the mark (100%) were already covered by
// earlier rounds. The real gap: the whole pack hammered a fully-immune target
// for 100% of a 5 s window while a live add stood free — every hit drawing an
// IMMUNE floater and dealing nothing. That is Octobaby's 4.6 s submerge, boss
// phase/revive i-frames, burrowed zodiacs and the mirror-boss shroud.
//
// The fix routes every summon picker through _lxMobUntargetable (the exact
// flags the damage pipeline honours). Two properties need guarding beyond the
// obvious:
//   * the mark SURVIVES immunity rather than being cleared — the player keeps
//     attacking through a submerge, so the pack must return the instant the
//     target is damageable again;
//   * an immune mob still DEALS contact damage — the minion loop both scores
//     targets and accumulates incoming damage, and gating the wrong half
//     would make immune bosses harmless to summons.
// Run: node scripts/summon_immunity_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9436;
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
await page.fill('#hero-name-input', 'ImmuneTest');
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
  player.job = 'warlock'; player.master = 'necromancer';
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 1400));
  game.paused = false;
  player.maxMp = 99999; player.mp = 99999; player.baseAtk = 500;
  const GY = player.y;
  const mk = (dx) => {
    const m = spawnMonster(player.x + dx, GY, 'slime', false);
    if (m) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; m.speed = 0; m._px = player.x + dx; }
    return m;
  };
  const reset = () => {
    game.monsters.length = 0; game.minions = []; game.projectiles.length = 0;
    game._pFocusTgt = null;
    player.x = 400; player.skillCooldowns = {}; player.hp = getMaxHp();
    player.pet = null; player.ultPet = null; player.pack = [];
  };
  const run = (frames, pin, cb) => {
    for (let f = 0; f < frames; f++) {
      game.time += 1;
      if (pin) pin(f);
      try { updateMinions(16.667); } catch (e) {}
      try { updatePlayer(16.667); } catch (e) {}
      try { updateMonsters(16.667); } catch (e) {}
      if (cb) cb(f);
    }
  };
  const onTgt = (t) => game.minions.filter(mn => mn._mnTgt === t).length;

  // ---- 1+2. abandon the immune (MARKED) boss, return when it surfaces -----
  reset();
  castSkill('darkPulse');
  const boss = mk(180); boss.isBoss = true;
  const add = mk(-320);
  run(45, () => { boss.currentHp = boss.maxHp; add.currentHp = add.maxHp; }, null);
  try { hitMonster(boss, 500, false, 'probe'); } catch (e) {}   // marked mid-fight
  boss.invulnerable = 100000;
  let onAddFrames = 0, onBossFrames = 0, total = 0;
  run(60 * 4, (f) => {
    boss.currentHp = boss.maxHp; add.currentHp = add.maxHp;
    boss.x = boss._px; add.x = add._px;
    boss.invulnerable = 100000;
    if (f % 20 === 0) { try { hitMonster(boss, 500, false, 'probe'); } catch (e) {} }   // player keeps attacking (all IMMUNE)
  }, () => { total++; if (onTgt(add) >= 3) onAddFrames++; if (onTgt(boss) >= 3) onBossFrames++; });
  const abandonPct = +(onAddFrames / total * 100).toFixed(1);
  const stuckPct = +(onBossFrames / total * 100).toFixed(1);
  // it surfaces — the still-fresh mark should pull the pack straight back
  boss.invulnerable = 0;
  let backFrames = 0; total = 0;
  run(60 * 2, (f) => {
    boss.currentHp = boss.maxHp; add.currentHp = add.maxHp;
    boss.x = boss._px; add.x = add._px;
    if (f % 20 === 0) { try { hitMonster(boss, 500, false, 'probe'); } catch (e) {} }
  }, () => { total++; if (onTgt(boss) >= 3) backFrames++; });
  const returnPct = +(backFrames / total * 100).toFixed(1);

  // ---- 3+4. wolf and eagle also refuse the immune target ------------------
  reset();
  player.pet = { x: player.x, y: GY, vx: 0, vy: 0, hp: 80000, maxHp: 80000,
                 life: 60000, maxLife: 60000, cdAtk: 0, scale: 2.4 };
  player.ultPet = { x: player.x, y: GY - 80, vx: 0, vy: 0, hp: 9999, maxHp: 9999,
                    life: 60000, maxLife: 60000, shooter: true, fireCd: 0, scale: 1 };
  const wImmune = mk(150); wImmune.invulnerable = 100000;
  const wLive = mk(-300);
  let wolfOnLive = 0, eagleOnLive = 0, wTot = 0;
  run(60 * 4, () => {
    wImmune.currentHp = wImmune.maxHp; wLive.currentHp = wLive.maxHp;
    wImmune.x = wImmune._px; wLive.x = wLive._px;
    wImmune.invulnerable = 100000;
  }, () => {
    wTot++;
    if (player.pet && player.pet._tgtRef === wLive) wolfOnLive++;
    if (player.ultPet && player.ultPet._tgtRef === wLive) eagleOnLive++;
  });
  const wolfPct = +(wolfOnLive / wTot * 100).toFixed(1);
  const eaglePct = +(eagleOnLive / wTot * 100).toFixed(1);

  // ---- 5. an immune mob still HURTS minions (contact half intact) ---------
  reset();
  castSkill('darkPulse');
  const biter = mk(60);
  biter.invulnerable = 100000; biter.atk = 300;
  const mn0 = game.minions[0];
  let hpBefore = null;
  run(60 * 4, () => {
    biter.currentHp = biter.maxHp; biter.invulnerable = 100000;
    if (mn0) { biter.x = mn0.x; biter.y = mn0.y; if (hpBefore == null) hpBefore = mn0.currentHp; }
  }, null);
  const minionHurt = mn0 ? (hpBefore - mn0.currentHp) : 0;

  // ---- 6. ordinary vulnerable targets unaffected (regression) -------------
  reset();
  castSkill('darkPulse');
  const plain = mk(200);
  let engaged = 0; total = 0;
  run(60 * 3, () => { plain.currentHp = plain.maxHp; plain.x = plain._px; },
      () => { total++; if (onTgt(plain) >= 3) engaged++; });
  const plainPct = +(engaged / total * 100).toFixed(1);

  return { abandonPct, stuckPct, returnPct, wolfPct, eaglePct, minionHurt, plainPct };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 125) });

ok('pack abandons an immune marked boss for the live add', R.abandonPct >= 70,
   `${R.abandonPct}% of frames with 3+/5 on the add (pre-fix: pack stuck on the boss 100%)`);
ok('pack does not sit on the immune boss', R.stuckPct <= 10, `${R.stuckPct}% stuck (pre-fix 100%)`);
ok('the pack returns the moment immunity ends (mark survived)', R.returnPct >= 60,
   `${R.returnPct}% of the 2s after surfacing`);
ok('the wolf refuses the immune target', R.wolfPct >= 70, `${R.wolfPct}% on the live mob`);
ok('the eagle refuses the immune target', R.eaglePct >= 70, `${R.eaglePct}% on the live mob`);
ok('an immune mob still deals contact damage to minions', R.minionHurt > 0,
   `minion lost ${R.minionHurt} HP (the scoring gate must not disable the damage half)`);
ok('ordinary vulnerable targets are engaged as before', R.plainPct >= 80, `${R.plainPct}%`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
