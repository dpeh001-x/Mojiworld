// Confused Barnaby uses the art he has.
// ============================================================================
// Spies on the five frame pickers over 600 frames of a live fight and counts
// which set he actually draws. Measured on the previous build: walk 272 draws,
// idle 175, attack 23, weave 0, duck 0 - 58% walk, 5% attack, two sets never
// drawn - while his states were chase 128, dashIn 48, wind 35, jab 18.
//   1. FRAMES RAN: the sim actually stepped
//   2. HIS ATTACK ART IS USED: at least a fifth of his draws (was 5%)
//   3. HIS DASH LEANS: the weave set is drawn at all (was never)
//   4. WALK IS NO LONGER THE DEFAULT: at most half his draws (was 58%)
//   5. HE STILL WALKS WHEN WALKING: chase and reposition keep the walk loop
//   6. CONTROL: the two opt-in tables name him and nobody else
// Run: node scripts/barnaby_frames_test.mjs   (MOJI_GAME_FILE=... for a baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// v0.30.x — the tree this test lives in. It hardcoded the SHARED working copy, which grades whatever build that checkout
// holds (routinely dozens of commits behind, with other sessions' edits in it). MOJI_SERVE_ROOT overrides.
const ROOT = (process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')).replace(/\\/g, '/');
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12831);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  // a persisted save from an earlier run changes the character level, and with it every
  // level-scaled number - start every run from a clean slate so results are reproducible
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(11000);
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
  for (let i = 0; i < 30; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1000);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) break;
  }
  // .fade is what the boot gate waits for: without it the loop spins without ever stepping the sim
  await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });

  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const maps = ['innerDimension', 'dimensionChamber', 'clockworkChamber', 'sandsChamber'];
    let m = null;
    for (const mp of maps) {
      try { loadMap(mp); } catch (e) { continue; }
      await sleep(1200);
      m = game.monsters.find((x) => x.type === 'young_confused_barnaby');
      if (m) { out.map = mp; break; }
    }
    if (!m) {
      try { spawnMonster(player.x + 320, player.y - 150, 'young_confused_barnaby', true); } catch (e) { out.spawnErr = String(e); }
      await sleep(600);
      m = game.monsters.find((x) => x.type === 'young_confused_barnaby');
      out.map = game.currentMap + ' (spawned)';
    }
    if (!m) { out.err = 'no barnaby'; return out; }
    player._god = true;
    // spy on the five pickers
    const counts = { idle: 0, walk: 0, attack: 0, weave: 0, duck: 0 };
    const wrap = (name, key) => {
      const o = window[name];
      if (typeof o !== 'function') return null;
      window[name] = function (k, mm) { const r = o.apply(this, arguments); if (r && k && /barnaby/.test(String(k))) counts[key]++; return r; };
      return o;
    };
    const orig = {
      _bossIdleFrame: wrap('_bossIdleFrame', 'idle'),
      _bossWalkFrame: wrap('_bossWalkFrame', 'walk'),
      _bossAttackFrame: wrap('_bossAttackFrame', 'attack'),
      _bossWeaveFrame: wrap('_bossWeaveFrame', 'weave'),
      _bossDuckFrame: wrap('_bossDuckFrame', 'duck'),
    };
    const states = {};
    const g0 = game.time | 0, t0 = performance.now();
    let frames = 0, pausedSamples = 0;   // v0.30.x — game.time counts while paused, so "frames ran" alone cannot see a pause
    // v0.30.x — 1800 frames, not 600. His AI is random and so is this driver's repositioning; measured over 3600 frames
    // the walk share per 600-frame window ran 19-33% (and one test window 51.6%), attack 21-60%, so a single short
    // window put both thresholds inside the noise. Three times the sample, same claims.
    while (((game.time | 0) - g0) < 1800 && performance.now() - t0 < 150000) {
      await sleep(16);
      frames++;
      if (game.paused) pausedSamples++;
      const st = m.patternState || 'idle';
      states[st] = (states[st] || 0) + 1;
      if (Math.random() < 0.25) { player.x = m.x + m.w / 2 + (Math.random() < 0.5 ? -180 : 180); }   // keep him engaged
    }
    for (const k in orig) if (orig[k]) window[k] = orig[k];
    out.counts = counts;
    out.states = states;
    out.samples = frames; out.pausedSamples = pausedSamples;
    out.framesRan = (game.time | 0) - g0;
    out.tables = {
      atkWhileMoving: (typeof _LX_ATK_WHILE_MOVING !== 'undefined') ? Array.from(_LX_ATK_WHILE_MOVING) : null,
      dashWeave: (typeof _LX_DASH_WEAVE !== 'undefined') ? Object.keys(_LX_DASH_WEAVE) : null,
    };
    out.hasSets = {
      idle: !!(window.BOSS_IDLE_FRAMES && BOSS_IDLE_FRAMES.young_confused_barnaby),
      walk: !!(window.BOSS_WALK_FRAMES && BOSS_WALK_FRAMES.young_confused_barnaby),
      attack: !!(window.BOSS_ATTACK_FRAMES && BOSS_ATTACK_FRAMES.young_confused_barnaby),
      weave: !!(window.BOSS_WEAVE_FRAMES && BOSS_WEAVE_FRAMES.young_confused_barnaby),
      duck: !!(window.BOSS_DUCK_FRAMES && BOSS_DUCK_FRAMES.young_confused_barnaby),
    };
    return out;
  });
  const C = R.counts || {}, St = R.states || {};
  const total = (C.idle | 0) + (C.walk | 0) + (C.attack | 0) + (C.weave | 0) + (C.duck | 0);
  const pct = (n) => total ? +(((n | 0) / total) * 100).toFixed(1) : 0;
  console.log('  map ' + R.map + ' | frames ' + R.framesRan + ' | paused ' + R.pausedSamples + '/' + R.samples + ' samples | draws ' + JSON.stringify(C));
  console.log('  states ' + JSON.stringify(St) + ' | tables ' + JSON.stringify(R.tables));
  console.log('  shares: walk ' + pct(C.walk) + '%  attack ' + pct(C.attack) + '%  idle ' + pct(C.idle) + '%  weave ' + pct(C.weave) + '%');
  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 1500, R.framesRan + ' frames');
  ok('HIS ATTACK ART IS USED: at least a fifth of his draws', pct(C.attack) >= 20, pct(C.attack) + '% of ' + total + ' draws (previous build: 5%)');
  ok('HIS DASH LEANS: the weave set is drawn at all', (C.weave | 0) > 0, (C.weave | 0) + ' weave draws (previous build: 0)');
  ok('WALK IS NO LONGER THE DEFAULT: at most half his draws', pct(C.walk) <= 50, pct(C.walk) + '% walk (previous build: 58%)');
  ok('HE STILL WALKS WHEN WALKING: the walk loop is still in use', (C.walk | 0) > 40, (C.walk | 0) + ' walk draws');
  ok('CONTROL: the opt-in tables name him and nobody else',
    Array.isArray(R.tables && R.tables.atkWhileMoving) && R.tables.atkWhileMoving.length === 1
      && R.tables.atkWhileMoving[0] === 'young_confused_barnaby'
      && Array.isArray(R.tables.dashWeave) && R.tables.dashWeave.length === 1,
    JSON.stringify(R.tables));
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.n + (r.extra ? '   [' + r.extra + ']' : '')); }
console.log(bad ? (bad + '/' + res.length + ' FAILED') : ('all ' + res.length + ' passed'));
process.exit(bad ? 1 : 0);
