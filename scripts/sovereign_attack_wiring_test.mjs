// SOVEREIGN ATTACK SETS — wired to the attacks that actually fire.
// ============================================================================
// Per user: "ensure that all of the sprites are wired into the game".
//
// sovereign_attack_sets_test.mjs proves the sets decode, that _lxSovAtkPose
// stamps five distinct keys and that the renderer resolves them. What it does
// NOT prove is the thing the user is asking about: that the game's own five
// attacks reach that helper. Every one of those assertions passes on a build
// where the five fire sites were never edited, because the test calls the
// helper itself.
//
// So this one never calls the helper. It starts a REAL Sovereign fight -- the
// expedition final-boss flags and the three attack timers the spawn code sets,
// a player in melee range so the swing and column trigger -- runs it, and
// records which key the boss stamps on its own. Every one of the five sets must
// show up, from its own attack, or that set is dead art.
// Run: node scripts/sovereign_attack_wiring_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9810);
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
await page.fill('#hero-name-input', 'SovWire');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  player.maxMp = 999999; player.mp = 999999;
  game.monsters.length = 0;
  const boss = spawnMonster(player.x + 150, player.y, 'towerSovereign', false);
  if (!boss) return { error: 'no boss' };
  // The real fight's own setup: the expedition finale flag plus the three
  // timers the spawn path arms. Nothing here touches _sovAtkKey.
  boss._expeditionFinalBoss = true;
  boss.maxHp = 1e9; boss.currentHp = 1e9;
  boss.atk = 0;                       // the boss must not kill the test dummy
  boss._sovereignOhkoTick = (game.time | 0) + 30;
  boss._sovereignOhkoCd = 840;
  boss._sovereignHomingAt = (game.time | 0) + 20;
  boss._sovereignDrainAt = (game.time | 0) + 40;
  boss._bigMeleeCd = 0; boss._columnCd = 0;

  const seen = {};
  const order = [];
  let lastKey = null;
  for (let f = 0; f < 1400; f++) {
    await new Promise(r => requestAnimationFrame(r));
    // keep the fight alive and the player in melee+column range
    boss.currentHp = boss.maxHp;
    player.hp = getMaxHp();
    // Inside the bigMelee window on BOTH axes: range 200 horizontally between
    // centres, swingH 130 vertically. Standing 90px from the boss's left edge
    // put the centres ~197px apart -- just outside 200 -- so the swing never
    // armed and the set looked dead.
    player.x = boss.x + boss.w / 2 - player.w / 2 - 80;
    player.invulnerable = 60;
    // The active-boss AI opens distance and retreats; both gate the heavy.
    boss._dirOpenT = 0; boss._dirFleeT = 0;
    if ((boss._bigMeleeCd | 0) > 200) boss._bigMeleeCd = 0;
    if ((boss._columnCd | 0) > 200) boss._columnCd = 0;
    // re-arm the slow timers so all three fire inside the sample window
    const now = game.time | 0;
    if ((boss._sovereignOhkoTick | 0) > now + 200) boss._sovereignOhkoTick = now + 5;
    if ((boss._sovereignHomingAt | 0) > now + 200) boss._sovereignHomingAt = now + 5;
    if ((boss._sovereignDrainAt | 0) > now + 200) boss._sovereignDrainAt = now + 5;
    // these three gate the timer attacks; the fight clears them naturally but
    // the test cannot wait minutes for that
    boss._sovShielded = false; boss._sovExposedUntil = 0; boss._sovSpentUntil = 0;
    const k = boss._sovAtkKey && (game.time | 0) < (boss._sovAtkUntil | 0) ? boss._sovAtkKey : null;
    if (k && k !== lastKey) { seen[k] = (seen[k] || 0) + 1; order.push(k.replace('towerSovereign', '')); }
    lastKey = k;
  }
  return { seen, order: order.slice(0, 24), frames: 1400 };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 150) });
const WANT = ['swing', 'column', 'collapse', 'volley', 'drain'];
const seen = R.seen || {};
for (const w of WANT) {
  const k = 'towerSovereign' + w;
  ok(`the ${w} attack stamps its own set in a real fight`, (seen[k] | 0) > 0,
     `${seen[k] | 0} activations across ${R.frames} frames`);
}
ok('all five sets are reached by the game itself, not just by the helper',
   WANT.every(w => (seen['towerSovereign' + w] | 0) > 0),
   'observed order: ' + (R.order || []).join(' > '));

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
