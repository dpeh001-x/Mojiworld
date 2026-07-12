// Verify v0.28.5: monster EXP halved (LX_MONSTER_EXP_MULT 2 -> 1).
// Kills a live monster with a clean Lv45 save (no xp gear, no prestige,
// no combo, solo) and asserts the exact award = floor(m.exp * 1.35 * EVENT * 1).
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8765/mojiworld_game.html';
const R = []; const ok = (n, c, x) => { R.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' — ' + x : '')); };
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
await page.evaluate(() => localStorage.setItem('levelx_save_v1', JSON.stringify({ v: 1, t: Date.now(),
  player: { cls: 'mage', level: 45, look: { name: 'X' }, _storyBeatsSeen: { tutorial_intro: 1 } }, game: { currentMap: 'town' } })));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#menu-continue', { state: 'visible', timeout: 90000 });
await page.click('#menu-continue');
await page.waitForSelector('#loading-overlay', { state: 'detached', timeout: 30000 });
await page.waitForTimeout(800);

const r = await page.evaluate(() => {
  player._god = true;
  loadMap('slimeCaveEntrance' in MAPS ? 'slimeCaveEntrance' : 'forest');
  game.paused = false;
  // clean baseline: no combo, no boosts
  game.combo = 0; player.mods = player.mods || {}; player.mods.xpBoost = 0;
  const m = spawnMonster(player.x + 60, player.y, 'slime', false, false);
  const baseExp = m.exp;
  const before = player.exp | 0;
  const beforeLvl = player.level;
  m.currentHp = 0; killMonster(m);
  const gain = (player.exp | 0) - before;
  const evt = (typeof LX_EVENT_EXP_MULT === 'number') ? LX_EVENT_EXP_MULT : 1;
  const mult = (typeof LX_MONSTER_EXP_MULT === 'number') ? LX_MONSTER_EXP_MULT : null;
  return { baseExp, gain, evt, mult, lvlChanged: player.level !== beforeLvl, map: game.currentMap };
});
console.log(JSON.stringify(r));
ok('LX_MONSTER_EXP_MULT is 1 (was 2)', r.mult === 1, 'mult=' + r.mult);
// expected: floor(base * boost(1) * combo(>=1: first kill comboBonus=1) * prestige(1)
//           * comboXp(1) * xpCurve(1.35) * coop(1) * pq(1) * early(1) * evt * 1)
const expected = Math.floor(r.baseExp * 1.35 * r.evt * 1);
const expectedOld = Math.floor(r.baseExp * 1.35 * r.evt * 2);
ok('kill awards exactly the HALVED amount', !r.lvlChanged && r.gain === expected, `gain=${r.gain} expected=${expected} (old would be ${expectedOld})`);
ok('award is half the pre-change value', r.gain * 2 === expectedOld, `${r.gain}*2 == ${expectedOld}`);
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
const fails = R.filter(x => !x).length;
console.log(`\n${R.length - fails}/${R.length} checks passed`);
process.exit(fails ? 1 : 0);
