// KAGE RUSH v2 — four on-screen charges, not one map-crossing rocket.
// ============================================================================
// Per user: "kage rush retune - make it a 4x spammable onscreen only crossmap
// skill with new VFX" (with a reference image of a crimson slash beam carrying
// a kanji glyph and lightning).
//
// The two properties that define the rework, and both are measured on the real
// cast rather than read out of the skill table:
//   * REACH — one press must land the player inside the viewport, not at the
//     far map edge. Measured as actual displacement on a deliberately wide map.
//   * CHARGES — four presses must all fire behind a short re-cast gate, and
//     the fifth must not.
//
// The subtle one is the Quickening exclusion. The Sleight precedent this
// cadence copies carries a comment explaining the exploit: a charge skill whose
// "charges <= 0 -> refill" runs on the next press turns a randomly-zeroed
// cooldown into an INFINITE chain. Kage Rush now has that shape, so the test
// pins the exclusion directly.
// Run: node scripts/kage_rush_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9471;
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
await page.fill('#hero-name-input', 'KageTest');
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
  player.cls = 'rogue'; player.job = 'ninja'; player.master = 'shinobi';
  loadMap('forest', 300);
});
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  player.maxMp = 99999; player.mp = 99999; player.baseAtk = 500;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const viewW = (typeof W === 'number' && W > 0) ? W : 960;
  const worldW = game.mapData.worldWidth;

  // Poll for readiness rather than sleeping a fixed amount. The re-cast gate is
  // a wall-clock cooldown but the CAST LOCK is a game.time FRAME counter, and
  // headless does not hold 60 fps -- a fixed sleep therefore measures the
  // harness's frame rate, not the skill's cadence. (The first run of this test
  // reported 3/4 charges for exactly that reason.)
  const castWhenReady = async (id, maxMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      if (isReady(id)) { castSkill(id); return Date.now() - t0; }
      await sleep(25);
    }
    return -1;
  };
  const resetCast = () => {
    player.skillCooldowns = {}; player.mp = 99999;
    player._kageCharges = 0; player._sleightCharges = 0;
    game.smoothFx = []; game.monsters.length = 0;
  };

  // ---- 1. REACH: one press must not cross the map ------------------------
  resetCast();
  player.x = 300; player.facing = 1;
  const x0 = player.x;
  castSkill('shinobi_seal');
  await sleep(900);
  const dash1 = Math.abs(player.x - x0);
  const landedInView = dash1 < viewW * 0.75;
  const wouldHaveCrossed = worldW - 400;   // what the old cast did from x=300

  // ---- 2. CHARGES: four presses fire, the fifth does not -----------------
  resetCast();
  player.x = 300; player.facing = 1;
  const fired = [];
  for (let i = 0; i < 4; i++) {
    const before = player.x;
    const waited = await castWhenReady('shinobi_seal', 1500);
    await sleep(320);   // let the dash resolve so displacement is measurable
    fired.push({ waited, moved: Math.abs(player.x - before) > 20,
                 cd: Math.round(player.skillCooldowns['shinobi_seal'] || 0) });
    player.facing = (i % 2 === 0) ? -1 : 1;   // bounce so we never pin a wall
  }
  const firedCount = fired.filter(f => f.waited >= 0 && f.moved).length;
  const maxWait = Math.max(...fired.map(f => f.waited));
  // The fifth must NOT come up quickly -- that is the whole point of the seal
  // recharging. Give it a generous window; a charge gate would clear in ~300 ms.
  const fifthWait = await castWhenReady('shinobi_seal', 1200);
  const fifthBlocked = fifthWait < 0;
  const cdAfter4 = fired[3].cd;

  // ---- 3. total reach of a full chain is still generous ------------------
  // Four short dashes should cover meaningfully more than one of them.
  resetCast();
  player.x = 200; player.facing = 1;
  const chainStart = player.x;
  for (let i = 0; i < 4; i++) { await castWhenReady('shinobi_seal', 1500); await sleep(320); }
  const chainReach = Math.abs(player.x - chainStart);

  // ---- 4. DAMAGE: a target in the lane takes a hit per dash --------------
  resetCast();
  player.x = 300; player.facing = 1;
  const tgt = spawnMonster(420, player.y, 'slime', false);
  let dmgTotal = 0;
  if (tgt) {
    tgt.maxHp = 1e9; tgt.currentHp = 1e9; tgt.atk = 0; tgt.speed = 0;
    const hp0 = tgt.currentHp;
    for (let i = 0; i < 4; i++) {
      player.x = 300; player.facing = 1; tgt.x = 420;
      await castWhenReady('shinobi_seal', 1500);
      await sleep(320);
    }
    dmgTotal = hp0 - tgt.currentHp;
  }
  const atk = getAtk();

  // ---- 5. VFX: the new primitives actually spawn --------------------------
  resetCast();
  player.x = 300; player.facing = 1;
  game.smoothFx = [];
  castSkill('shinobi_seal');
  // Sample DURING the cast. The beams live ~15 frames and the bolts ~12, so a
  // single read after the dash finishes sees an empty list and proves nothing
  // -- the first version of this test failed here for exactly that reason.
  const kinds = {};
  for (let t = 0; t < 14; t++) {
    await sleep(30);
    for (const fx of (game.smoothFx || [])) kinds[fx.type] = Math.max(kinds[fx.type] || 0, 0) + 0;
    for (const fx of (game.smoothFx || [])) { kinds['_seen_' + fx.type] = 1; }
  }
  for (const k of Object.keys(kinds)) if (!k.startsWith('_seen_')) delete kinds[k];

  // ---- 6. Quickening must not be able to zero it -------------------------
  // Drive the real exclusion: with cdrChance at 1 every cast would otherwise
  // roll a zeroed cooldown, and the refill-on-next-press would chain forever.
  resetCast();
  player.mods = player.mods || {};
  const prevCdr = player.mods.cdrChance;
  player.mods.cdrChance = 1;
  player.x = 300; player.facing = 1;
  for (let i = 0; i < 4; i++) { await castWhenReady('shinobi_seal', 1500); await sleep(320); player.facing *= -1; }
  const cdAfterQuickening = Math.round(player.skillCooldowns['shinobi_seal'] || 0);
  player.mods.cdrChance = prevCdr;

  return {
    viewW, worldW, dash1: Math.round(dash1), landedInView, wouldHaveCrossed: Math.round(wouldHaveCrossed),
    firedCount, fifthBlocked, cdAfter4, chainReach: Math.round(chainReach), maxWait, fifthWait,
    dmgRatio: atk > 0 ? +(dmgTotal / atk).toFixed(2) : 0, kinds,
    cdAfterQuickening,
    hasCharges: typeof LX_KAGE_CHARGES !== 'undefined' ? LX_KAGE_CHARGES : null,
    mp: (typeof SKILLS !== 'undefined' && SKILLS.shinobi_seal) ? SKILLS.shinobi_seal.mp : null,
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 135) });

ok('one press lands inside the viewport, not at the map edge', R.landedInView,
   `dashed ${R.dash1}px on a ${R.worldW}px map (viewport ${R.viewW}; the old cast travelled ~${R.wouldHaveCrossed}px)`);
ok('the dash is a real step, not a stutter', R.dash1 >= 120, `${R.dash1}px`);
ok('four presses all fire, each behind only a short gate', R.firedCount === 4 && R.maxWait < 700,
   `${R.firedCount}/4 fired; longest wait for the next charge ${R.maxWait}ms`);
ok('the fifth press is gated behind the full cooldown', R.fifthBlocked && R.cdAfter4 > 3000,
   `5th still not ready after 1200ms=${R.fifthBlocked}; cd after the 4th = ${R.cdAfter4}ms`);
ok('a full chain still covers ground', R.chainReach >= R.dash1 * 2.5,
   `${R.chainReach}px over 4 dashes vs ${R.dash1}px for one`);
ok('a target in the lane is hit by each dash', R.dmgRatio >= 4,
   `${R.dmgRatio}x ATK total across the chain`);
ok('the new crimson VFX spawn (beam + bolt + kanji)',
   !!R.kinds._seen_beam && !!R.kinds._seen_bolt && !!R.kinds._seen_kanji,
   'types seen during the cast: ' + Object.keys(R.kinds).map(k => k.replace('_seen_','')).join(', '));
ok('Quickening cannot zero the charge cooldown (no infinite chain)',
   R.cdAfterQuickening > 3000, `cd after 4 casts at cdrChance=1: ${R.cdAfterQuickening}ms`);
ok('MP per cast was rebalanced for a 4-charge chain', R.mp !== null && R.mp < 30, `effective mp=${R.mp} (was 44 for a single map-crossing cast)`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
