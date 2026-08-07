// Per user: "Summoned Mojimon should have the same HP as the current player."
//
//   node serve.js 8852 && node scripts/mojimon_hp_parity_test.mjs 8852 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8852';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try {
  return typeof eval('_mojimonSummon') === 'function' && typeof eval('getMaxHp') === 'function'
    && typeof eval('updateMinions') === 'function' && !!eval('player');
} catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(async () => {
  const p = eval('player'), g = eval('game');
  const ensure = eval('_mojimonEnsure'), statsFor = eval('_mojimonStatsFor');
  const summon = eval('_mojimonSummon'), dismiss = eval('_mojimonDismiss');
  const maxHp = eval('getMaxHp');
  // Level 40 buys 8 upgrade points (1 per 5 levels). At level 1 the roster
  // validator zeroes any allocation, which silently neutered the upgrade check.
  p.cls = 'warrior'; p.level = 40; p.x = 600; p.y = 400;
  g.mapData = g.mapData || {};
  g.mapData.platforms = [{ type: 'ground', x: 0, y: 448, w: 4000, h: 40 }];
  g.mapData.worldWidth = 4000;
  g.monsters = []; g.minions = []; g.particles = g.particles || [];

  const mm = ensure();
  // Bind a species outright — 10,000 kills is not a thing a test can farm.
  const TYPE = Object.keys(eval('monsterTypes')).find(k => {
    const t = eval('monsterTypes')[k]; return t && !t.isBoss && (t.w | 0) > 0;
  });
  mm.roster[TYPE] = { upg: { hp: 0, atk: 0, def: 0 }, at: 1 };
  mm.cdUntil = 0;
  const fielded = () => (g.minions || []).find(x => x && x.mojimon);

  // --- 1. parity at summon, un-upgraded
  dismiss(true);
  summon(TYPE, { free: true, quiet: true });
  const a = fielded();
  const atSummon = { player: maxHp(), mon: a ? a.maxHp : null, cur: a ? a.currentHp : null };

  // --- 2. parity holds after the player's max HP moves
  const savedMods = p.mods.maxHp;
  p.mods.maxHp = savedMods + 5000;
  if (p._equipBonusCache !== undefined) p._equipBonusCache = null;
  // drive the tick that owns the re-sync
  a.currentHp = Math.floor(a.maxHp * 0.5);        // damage it first, so we can see how the rescale treats it
  const before = { player: maxHp(), mon: a.maxHp, cur: a.currentHp, frac: a.currentHp / a.maxHp };
  // Drive the real tick directly — rAF does not run the minion update at rest,
  // which made the first cut of this test read an unchanged pool as a pass.
  // Needs dt (life -= dt goes NaN without it) and enough frames to clear the
  // 18-frame `spawn` gate at the top of updateMinions, which `continue`s past
  // everything below it.
  for (let i = 0; i < 30; i++) eval('updateMinions')(1);
  const afterLevel = { player: maxHp(), mon: a.maxHp, cur: a.currentHp, frac: a.currentHp / a.maxHp };

  // --- 3. upgrades scale from the NEW base, not the old x10
  const base = statsFor(TYPE).maxHp;
  mm.roster[TYPE].upg.hp = 5;
  const upg = statsFor(TYPE).maxHp;
  mm.roster[TYPE].upg.hp = 0;
  const UPG = eval('MOJIMON_UPG');

  p.mods.maxHp = savedMods;
  if (p._equipBonusCache !== undefined) p._equipBonusCache = null;
  dismiss(true);
  return { TYPE, atSummon, before, afterLevel, base, upg, upgStep: UPG.hp, playerNow: maxHp() };
});

ok('a mon was actually fielded', r.atSummon.mon != null, { type: r.TYPE });
ok('SAME HP: a fresh mon\'s max HP equals the player\'s max HP',
   r.atSummon.mon === r.atSummon.player, { player: r.atSummon.player, mon: r.atSummon.mon });
ok('it is summoned at full health', r.atSummon.cur === r.atSummon.player, r.atSummon);
ok('NOT the old 10x pool', r.atSummon.mon < r.atSummon.player * 2,
   { mon: r.atSummon.mon, oldWouldHaveBeen: r.atSummon.player * 10 });

ok('parity survives the player gaining max HP',
   r.afterLevel.mon === r.afterLevel.player,
   { player: r.afterLevel.player, mon: r.afterLevel.mon, wasBefore: r.before.mon });
// Guard the check above from passing vacuously: the pool MUST actually have
// moved, or "fraction preserved" is just reading back the value we set.
ok('the re-sync actually fired (the pool moved)',
   r.afterLevel.mon !== r.before.mon, { was: r.before.mon, now: r.afterLevel.mon });
// Absolute HP carries across, so growing the pool must not restore health —
// otherwise toggling a +HP item becomes a free heal for the companion.
ok('growing the pool does NOT heal the mon (absolute HP carried, not the fraction)',
   r.afterLevel.mon !== r.before.mon && r.afterLevel.cur === r.before.cur,
   { curBefore: r.before.cur, curAfter: r.afterLevel.cur, maxAfter: r.afterLevel.mon });

// Compare against the base measured in the SAME state — `playerNow` is read
// after the +5000 mod is rolled back, so it is not the baseline these used.
const want = Math.floor(r.base * (1 + 5 * r.upgStep));
ok('HP upgrade points still scale, from the new base',
   r.upg === want && r.upg > r.base, { base: r.base, with5pts: r.upg, expected: want });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
