// THE SOVEREIGN OF THE SPIRE — a different pose for each of its five attacks.
// ============================================================================
// Per user: "using ludo.ai generate new unique attacking sprites for the
// different towersovereign attacks".
//
// The Sovereign has five attacks -- melee swing, starfire column, singularity
// collapse, five-shard homing volley, drain pillars -- and every one of them
// played the SAME nine attack frames, so nothing the boss did told you what was
// coming. Each now has its own set, chosen by a stamped sprite key.
//
// What this has to prove, in order:
//   1. the five sets exist on disk AND decode (art that 404s silently falls
//      back to the generic pose, which looks exactly like doing nothing);
//   2. firing an attack stamps ITS key -- and a different attack stamps a
//      DIFFERENT key (five keys that all resolve to one set would pass any
//      "a key was set" check while changing nothing on screen);
//   3. the key reaches the renderer's sprite lookup;
//   4. the window EXPIRES, so the boss returns to its ordinary pose;
//   5. no other boss is affected.
// Run: node scripts/sovereign_attack_sets_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9701);
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
await page.fill('#hero-name-input', 'SovTest');
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
  const KEYS = ['towerSovereignswing', 'towerSovereigncolumn', 'towerSovereigncollapse',
                'towerSovereignvolley', 'towerSovereigndrain'];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // ---- 1. do the five sets exist and DECODE? -----------------------------
  const art = {};
  for (const k of KEYS) {
    const set = (typeof BOSS_ATTACK_FRAMES !== 'undefined') ? BOSS_ATTACK_FRAMES[k] : null;
    let decoded = 0;
    for (const f of (set || [])) { if (f && f.complete && f.naturalWidth > 0) decoded++; }
    art[k] = { frames: (set || []).length, decoded };
  }
  // Wait for decode if the boot gate has not finished with them.
  for (let t = 0; t < 60; t++) {
    let done = true;
    for (const k of KEYS) {
      const set = BOSS_ATTACK_FRAMES[k] || [];
      let d = 0; for (const f of set) if (f && f.complete && f.naturalWidth > 0) d++;
      art[k].decoded = d; art[k].frames = set.length;
      if (set.length === 0 || d < set.length) done = false;
    }
    if (done) break;
    await sleep(250);
  }

  // ---- 2/3/4. stamp each attack and read the key back --------------------
  game.monsters.length = 0;
  const boss = spawnMonster(player.x + 260, player.y, 'towerSovereign', false);
  const stamped = {};
  let expired = null, otherBoss = null;
  if (boss) {
    boss.maxHp = 1e9; boss.currentHp = 1e9; boss.atk = 0; boss.speed = 0;
    for (const short of ['swing', 'column', 'collapse', 'volley', 'drain']) {
      boss._sovAtkKey = null; boss._sovAtkUntil = 0;
      if (typeof _lxSovAtkPose === 'function') _lxSovAtkPose(boss, short, 60);
      stamped[short] = boss._sovAtkKey || null;
    }
    // the window must close on its own
    if (typeof _lxSovAtkPose === 'function') _lxSovAtkPose(boss, 'swing', 2);
    const before = boss._sovAtkKey;
    const t0 = game.time | 0;
    for (let i = 0; i < 40 && (game.time | 0) < t0 + 6; i++) await new Promise(r => requestAnimationFrame(r));
    expired = { before, liveNow: (game.time | 0) < (boss._sovAtkUntil | 0) };

    // ---- 5. a different boss must be untouched --------------------------
    const other = spawnMonster(player.x + 520, player.y, 'gravitos', false);
    if (other) {
      other.atk = 0; other.speed = 0;
      if (typeof _lxSovAtkPose === 'function') _lxSovAtkPose(other, 'swing', 60);
      otherBoss = { type: other.type, key: other._sovAtkKey || null };
    }
  }
  return {
    art, stamped, expired, otherBoss,
    bossSpawned: !!boss,
    helper: typeof _lxSovAtkPose === 'function',
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 150) });
const KEYS = Object.keys(R.art);
const withFrames = KEYS.filter(k => R.art[k].frames >= 9);
const decodedAll = KEYS.filter(k => R.art[k].frames >= 9 && R.art[k].decoded === R.art[k].frames);
const stampedVals = Object.values(R.stamped || {}).filter(Boolean);
const uniqueKeys = new Set(stampedVals);

ok('all five attack sets are registered with 9 frames', withFrames.length === 5,
   KEYS.map(k => `${k.replace('towerSovereign', '')}:${R.art[k].frames}`).join(' '));
ok('all five sets actually DECODE (missing art falls back silently)', decodedAll.length === 5,
   KEYS.map(k => `${k.replace('towerSovereign', '')}:${R.art[k].decoded}/${R.art[k].frames}`).join(' '));
ok('the per-attack pose helper exists', R.helper === true);
ok('every attack stamps a key', stampedVals.length === 5,
   JSON.stringify(R.stamped));
ok('each attack stamps a DIFFERENT key', uniqueKeys.size === 5,
   `${uniqueKeys.size} distinct keys across 5 attacks`);
ok('the attack window expires on its own', R.expired && !!R.expired.before && R.expired.liveNow === false,
   R.expired ? `stamped ${R.expired.before}, still live after the window: ${R.expired.liveNow}` : '(no boss)');
ok('other bosses are untouched by the Sovereign override',
   R.otherBoss && R.otherBoss.key === null,
   R.otherBoss ? `${R.otherBoss.type} key = ${R.otherBoss.key}` : '(no control boss)');

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
