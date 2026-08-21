// MIRROR SHADOW — blink to your clones.
// ============================================================================
// Per user: "For mirror shadow you can teleport to clone's location as well".
//
// The change is additive, and the additive part is what needs pinning hardest:
// the clones must SURVIVE being blinked to. The tester's "explode the clone"
// idea belonged to a different (Shinobi) proposal that is not in this batch, so
// a blink that consumed its turret would be a different skill than the one
// asked for -- and would quietly halve the summon's damage.
//
// Also guarded: the first press must still SUMMON (blink is only a follow-up),
// re-pressing must not silently re-roll the clones, and the landing must be ON
// the clone rather than near it -- clone coords are a centre, player coords a
// top-left corner, so a missing half-extent lands you low and to the right on
// every single blink.
// Run: node scripts/mirror_blink_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9483;
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
await page.fill('#hero-name-input', 'MirrorTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*rogue\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  player.level = 99; player._god = true;
  player.cls = 'rogue'; player.job = 'ninja'; player.master = 'shadowlord';
  loadMap('forest', 300);
});
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  player.maxMp = 999999; player.mp = 999999; player.baseAtk = 500;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const reset = () => {
    player.skillCooldowns = {}; player.mp = 999999;
    player._castLockUntil = 0; player.hitStun = 0;
    player._clones = null; player._mirrorIdx = -1; player._mirrorBlink = false;
    game.monsters.length = 0;
    player.x = 900; player.facing = 1;
  };
  const castWhenReady = async (id, maxMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      if (isReady(id)) { castSkill(id); return true; }
      await sleep(20);
    }
    return false;
  };
  // ANCHORS, not live positions. Clones hover on a sine bob, so their drawn Y
  // changes every frame by design -- comparing that would report "the clones
  // moved" on a build where nothing moved them.
  const clonePos = () => (player._clones || []).map(c => ({
    x: Math.round(c.anchorX), y: Math.round(c.anchorY),
  }));

  // ---- 1. the first press still SUMMONS ----------------------------------
  reset();
  castSkill('shadowlord_clones');
  await sleep(300);
  const cloneCount = (player._clones || []).length;
  const posAfterSummon = clonePos();
  const posAfterSummonRaw = JSON.stringify(posAfterSummon);
  const cdAfterSummon = Math.round(player.skillCooldowns['shadowlord_clones'] || 0);

  // ---- 2. re-pressing BLINKS to a clone ----------------------------------
  const hops = [];
  for (let i = 0; i < 3; i++) {
    const before = { x: Math.round(player.x + player.w / 2), y: Math.round(player.y + player.h / 2) };
    const fired = await castWhenReady('shadowlord_clones', 2500);
    await sleep(120);
    const after = { x: Math.round(player.x + player.w / 2), y: Math.round(player.y + player.h / 2) };
    // Distance from where we landed to the NEAREST clone centre.
    let best = Infinity, bestIdx = -1;
    (player._clones || []).forEach((c, ci) => {
      const cx = c.lastX != null ? c.lastX : c.anchorX;
      const cy = c.lastY != null ? c.lastY : c.anchorY;
      const d = Math.hypot(after.x - cx, after.y - cy);
      if (d < best) { best = d; bestIdx = ci; }
    });
    hops.push({ fired, moved: Math.round(Math.hypot(after.x - before.x, after.y - before.y)),
                landedWithin: Math.round(best), idx: bestIdx,
                clonesLeft: (player._clones || []).length });
  }

  // ---- 3. the clones SURVIVED all of it ----------------------------------
  const clonesAfterBlinks = (player._clones || []).length;
  const posAfterBlinks = JSON.stringify(clonePos());
  const positionsUnchanged = (posAfterBlinks === posAfterSummonRaw);

  // ---- 4. the rotation actually visits different clones ------------------
  const visited = new Set(hops.filter(h => h.fired).map(h => h.idx));

  // ---- 5. a blink is cheap and short, a summon is not --------------------
  const cdAfterBlink = Math.round(player.skillCooldowns['shadowlord_clones'] || 0);
  reset();
  const mp0 = player.mp;
  castSkill('shadowlord_clones');            // summon
  const mpSummon = mp0 - player.mp;
  await sleep(300);
  // Sampled immediately either side of the cast. Polling for readiness first
  // and then differencing lets MP regen accrue during the wait, which reported
  // the blink as REFUNDING mana.
  let mpBlink = null;
  {
    const t = Date.now();
    while (Date.now() - t < 2500) {
      if (isReady('shadowlord_clones')) {
        const before = player.mp;
        castSkill('shadowlord_clones');
        mpBlink = before - player.mp;
        break;
      }
      await sleep(20);
    }
  }

  // ---- 5b. blinking must not advance the summon's own cooldown ----------
  // castSkill re-stamps a full cooldown on every cast and can also roll
  // Quickening (a random zeroing). Both would be disasters here: the first
  // restarts the summon timer on every hop, the second hands out a free
  // re-summon. The blink branch restores the PRE-CAST cooldown, which defeats
  // both -- so drive cdrChance to 1 and check the cooldown only ever falls.
  reset();
  player.mods = player.mods || {};
  const prevCdr = player.mods.cdrChance;
  // Summon with Quickening OFF so the baseline cooldown is a real number --
  // at cdrChance 1 the SUMMON itself legitimately rolls a zeroed cooldown and
  // the whole series reads 0, which measures Quickening rather than blinking.
  player.mods.cdrChance = 0;
  castSkill('shadowlord_clones');
  await sleep(200);
  player.mods.cdrChance = 1;   // now make every BLINK roll it
  const cdSeries = [Math.round(player.skillCooldowns['shadowlord_clones'] || 0)];
  for (let i = 0; i < 3; i++) {
    await castWhenReady('shadowlord_clones', 2500);
    await sleep(80);
    cdSeries.push(Math.round(player.skillCooldowns['shadowlord_clones'] || 0));
  }
  player.mods.cdrChance = prevCdr;
  const cdMonotonic = cdSeries.every((v, i) => i === 0 || v <= cdSeries[i - 1]);
  const cdNeverZeroed = cdSeries.every(v => v > 0);
  const cdStart = cdSeries[0], cdEnd = cdSeries[cdSeries.length - 1];

  // ---- 6. once the clones expire, the key SUMMONS again ------------------
  reset();
  castSkill('shadowlord_clones');
  await sleep(300);
  player._clones = null;                      // simulate expiry
  player.skillCooldowns['shadowlord_clones'] = 0;
  player._castLockUntil = 0;
  castSkill('shadowlord_clones');
  await sleep(300);
  const resummoned = (player._clones || []).length;

  return {
    cloneCount, cdAfterSummon, hops, clonesAfterBlinks, positionsUnchanged,
    visitedCount: visited.size, cdAfterBlink,
    mpSummon: Math.round(mpSummon), mpBlink: Math.round(mpBlink), resummoned,
    cdSeries, cdMonotonic, cdNeverZeroed, cdStart, cdEnd,
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 140) });
const fired = R.hops.filter(h => h.fired);
const landed = fired.filter(h => h.landedWithin <= 40).length;

ok('the first press still summons three clones', R.cloneCount === 3, `${R.cloneCount} clones`);
ok('re-pressing teleports the player', fired.length >= 2 && fired.every(h => h.moved > 60),
   fired.map(h => h.moved + 'px').join(', ') || '(no blinks fired)');
ok('the blink lands ON a clone, not near it', fired.length >= 2 && landed === fired.length,
   'distance to nearest clone after each blink: ' + fired.map(h => h.landedWithin + 'px').join(', '));
ok('the clones SURVIVE being blinked to', R.clonesAfterBlinks === 3,
   `${R.clonesAfterBlinks} clones still standing after ${fired.length} blinks`);
ok('blinking does not re-roll the clones to new anchors', R.positionsUnchanged,
   `anchors identical before and after 3 blinks: ${R.positionsUnchanged}`);
ok('the rotation visits more than one clone', R.visitedCount >= 2,
   `${R.visitedCount} distinct clones visited across ${fired.length} blinks`);
ok('blinks come fast (a short gate, not the summon cooldown)',
   fired.length >= 3, `${fired.length} blinks landed inside one clone window`);
ok('a blink costs much less MP than the summon', R.mpBlink > 0 && R.mpBlink < R.mpSummon,
   `summon ${R.mpSummon} MP vs blink ${R.mpBlink} MP`);
ok('blinking never restarts or zeroes the summon cooldown (blinks at cdrChance=1)',
   R.cdMonotonic && R.cdNeverZeroed && R.cdStart > 3000,
   'cooldown after summon then each blink: ' + R.cdSeries.join(' -> ') + ' (must only fall, never reach 0)');
ok('once the clones are gone the key summons again', R.resummoned === 3,
   `${R.resummoned} clones re-summoned after expiry`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
