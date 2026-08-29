// The four zodiac threats, each driven through the real damage path.
// ============================================================================
// v0.30.297. Not source greps — the engine's own resolvers are invoked and the
// player's HP loss is measured, because every one of these rules sits AFTER a
// band clamp that could otherwise swallow it.
//
//   scorpio    contact >= 40% of the player's max HP
//   capricorn  projectile >= 32% of max HP
//   aquarius   projectile seals potions for 45s (2700 sim frames)
//   pisces     atk doubled in the live stat table
//
// CONTROLS matter more than usual here: a floor that fires for EVERY sign
// would be a balance disaster, so libra (an untouched sign) is pushed through
// the identical paths and must stay far below the floors, and the potion seal
// must not exist before an aquarius hit.
// Run: node scripts/zodiac_threats_test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });

// ---- pisces: the live stat table -------------------------------------------
const stat = readFileSync(path.join(ROOT, 'data', 'monster_stats.js'), 'utf8');
const pis = stat.match(/zodiac_pisces:\s*\{[^}]*atk:\s*(\d+)/);
ok('pisces atk is doubled in the live stat table', pis && +pis[1] === 70278,
   `atk ${pis ? pis[1] : '?'} (was 35139)`);

const PORT = Number(process.env.PORT || 11201);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);

// Reach a live sim: the class-select modal is mandatory, and loop() parks
// until the loading overlay carries .fade (learned the hard way in the PQ pass).
const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const r = await page.evaluate(() => { const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
  if (r) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) break;
}
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.classList.add('fade'); });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { loadMap('forest'); game.paused = false; } catch (e) {}
  await sleep(1500);
  game.monsters.length = 0;
  player.level = 80; player._god = false;
  // A default test character has ~292 maxHP, but the zodiac touch band already
  // floors at 0.15 x the LEVEL reference — which at Lv84 is several times that
  // pool, so EVERY sign one-shots and the new floors cannot be told apart from
  // the pre-existing band. Give the player a pool comparable to the level
  // reference so the per-sign floor is the only variable.
  player.maxHp = 20000;
  const MH = getMaxHp();

  // --- projectile rule: fire one shot of a given sign straight at the player
  const shoot = async (sign) => {
    player.hp = MH; player.invulnerable = 0;
    game.projectiles.length = 0;
    game.projectiles.push({
      x: player.x + player.w / 2 - 8, y: player.y + player.h / 2 - 8,
      vx: 0, vy: 0, w: 24, h: 24, life: 40,
      damage: 5, owner: 'enemy', skill: 'zodiac', color: '#fff',
      noGravity: true, _zodiacAttacker: true, _zodiacSign: sign,
    });
    const before = player.hp;
    for (let i = 0; i < 25 && game.projectiles.length; i++) { game.paused = false; await sleep(35); }
    return { lost: Math.round(before - player.hp), pct: +((before - player.hp) / MH * 100).toFixed(1) };
  };

  const capri = await shoot('capricorn');
  const sealAfterCap = (player._potionLockUntil | 0) > (game.time | 0);
  const libraProj = await shoot('libra');

  // --- potion seal: must be absent before, present after an aquarius hit
  player._potionLockUntil = 0;
  const sealBefore = (player._potionLockUntil | 0) > (game.time | 0);
  const aqua = await shoot('aquarius');
  const sealFrames = (player._potionLockUntil | 0) - (game.time | 0);
  // and the gate must actually refuse a drink
  player.hp = Math.floor(MH * 0.3);
  if (!player.consumables) player.consumables = {};
  player.consumables.hp_small = 5;
  const hpBefore = player.hp;
  try { useConsumable('hp_small'); } catch (e) {}
  const healed = player.hp - hpBefore;

  // --- scorpio contact: place the boss on the player and let it touch
  const touch = async (sign) => {
    game.monsters.length = 0;
    const m = spawnMonster(player.x, player.y, 'zodiac_' + sign, true);
    if (!m) return { lost: -1, pct: -1 };
    await sleep(3600);                       // boss intro auto-closes at 3.2s
    game.paused = false;
    player.hp = MH; player.invulnerable = 0; player._potionLockUntil = 0;
    let worst = 0;
    for (let i = 0; i < 90; i++) {
      game.paused = false;
      m.x = player.x; m.y = player.y;         // hold it inside the player
      const before = player.hp;
      await sleep(45);
      const d = before - player.hp;
      if (d > worst) worst = d;
      if (player.hp < MH * 0.2) player.hp = MH;   // survive to sample again
      player.invulnerable = 0;
    }
    game.monsters.length = 0;
    return { lost: Math.round(worst), pct: +(worst / MH * 100).toFixed(1) };
  };
  const scorp = await touch('scorpio');
  const libraTouch = await touch('libra');

  return { MH, capri, libraProj, aqua, scorp, libraTouch, sealBefore, sealAfterCap, sealFrames, healed };
});
await browser.close(); server.kill();

console.log(`  player maxHP ${R.MH}`);
console.log(`  capricorn projectile: ${R.capri.lost} (${R.capri.pct}% maxHP)   libra projectile: ${R.libraProj.lost} (${R.libraProj.pct}%)`);
console.log(`  scorpio contact:      ${R.scorp.lost} (${R.scorp.pct}% maxHP)   libra contact:    ${R.libraTouch.lost} (${R.libraTouch.pct}%)`);
console.log(`  aquarius seal: before=${R.sealBefore} afterCapricorn=${R.sealAfterCap} frames=${R.sealFrames}  potion healed ${R.healed} hp`);

ok('capricorn projectiles deal at least 32% of max HP', R.capri.pct >= 32,
   `${R.capri.pct}% (base damage was 5)`);
ok('CONTROL: an untouched sign is NOT floored', R.libraProj.pct < 32,
   `libra ${R.libraProj.pct}% — a floor firing for every sign would be a balance disaster`);
ok('scorpio contact deals at least 40% of max HP', R.scorp.pct >= 40, `${R.scorp.pct}%`);
ok('CONTROL: an untouched sign\'s contact is NOT floored', R.libraTouch.pct >= 0 && R.libraTouch.pct < 40,
   `libra contact ${R.libraTouch.pct}%`);
ok('CONTROL: no potion seal before an aquarius hit (nor from capricorn)',
   R.sealBefore === false && R.sealAfterCap === false);
ok('aquarius projectiles seal potions for 45s', R.sealFrames > 2600 && R.sealFrames <= 2700,
   `${R.sealFrames} sim frames (~${(R.sealFrames / 60).toFixed(0)}s at 60Hz)`);
ok('...and the seal actually refuses a drink', R.healed === 0,
   `potion healed ${R.healed} hp while sealed`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
