// Verify v0.28.5: monster EXP halved (LX_MONSTER_EXP_MULT 2 -> 1).
// Kills a live monster with a clean Lv45 save (no xp gear, no prestige,
// no combo, solo) and asserts the exact award = floor(m.exp * 1.35 * EVENT * 1).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const URL = 'http://localhost:' + (process.env.PORT || 8765) + '/mojiworld_game.html';
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
  // v0.30.923 (bb8fe7e4): a kill pays the raw stats-table number. Pin a round exp and a same-level
  // mob so the level-gap falloff (v0.29.858) and the max(1, ...) floor cannot hide a stray multiplier.
  m.level = player.level; m.exp = 400;
  const baseExp = m.exp;
  const before = player.exp | 0;
  const beforeLvl = player.level;
  const f = (n) => (typeof window[n] === 'function') ? window[n]() : 1;
  const sit = { diff: f('_diffExpMul'), affix: f('_affixExpMul'), ks: f('_ksXpMul'), dawn: f('_lxDawnExpMul'), gear: 1 + (player.mods.xpBoost || 0) + getEquipBonus('xpBoost') };
  m.currentHp = 0; killMonster(m);
  const gain = (player.exp | 0) - before;
  const evt = (typeof LX_EVENT_EXP_MULT === 'number') ? LX_EVENT_EXP_MULT : 1;
  const mult = (typeof LX_MONSTER_EXP_MULT === 'number') ? LX_MONSTER_EXP_MULT : null;
  return { sit, baseExp, gain, evt, mult, lvlChanged: player.level !== beforeLvl, map: game.currentMap };
});
console.log(JSON.stringify(r));
// v0.30.923 (bb8fe7e4) retired the monster knob and the x1.35 curve from the kill award: "a kill pays
// what the stats table says". LX_EXP.monster (2 since v0.29.869) survives only as a record, and the
// halving this suite protected is now subsumed - the award carries NO monster multiplier at all.
ok('the knob is a record only (LX_MONSTER_EXP_MULT is still defined)', typeof r.mult === 'number', 'mult=' + r.mult);
// expected: the raw table number times only the SITUATIONAL, earned multipliers the award line lists
// (difficulty, world affix, kill streak, dawn, gear xpBoost) - read live, since the save/map may carry one.
const sitMul = Object.values(r.sit).reduce((a, b) => a * b, 1);
const expected = Math.max(1, Math.floor(r.baseExp * sitMul));
const expectedOld = Math.floor(r.baseExp * 1.35 * r.mult);
ok('kill awards exactly the raw table EXP', !r.lvlChanged && r.gain === expected, `gain=${r.gain} expected=${expected} (old would be ${expectedOld})`);
ok('neither the knob nor the x1.35 curve is applied', r.gain < expectedOld, `${r.gain} < ${expectedOld}`);
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
const fails = R.filter(x => !x).length;
console.log(`\n${R.length - fails}/${R.length} checks passed`);
process.exit(fails ? 1 : 0);
