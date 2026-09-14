// King Gloopaloo: crisp base, visible slime balls, smoother idle.
// ============================================================================
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. HIS BASE IS NOT FEATHERED: the game's own soft-draw is asked to render
//      his sprite the way it renders him in play, and the bottom rows keep
//      their alpha; asking for the old opt-in on the same sprite still fades
//      them, which is what proves the check can tell the two apart
//   3. KROOK KEEPS HIS: the opt-in list still holds kingKrook
//   4. THE SLIME BALLS ARE VISIBLE: his glue spray and splash spawn at the
//      ordinary mob-projectile size (previous build: 16 and 14)
//   5. THE IDLE HAS AUTHORED TIMING: his idle and walk have frame times now
//      (previous build: neither, so both fell back to a flat 130 ms step)
// Run: node scripts/gloop_polish_test.mjs   (MOJI_GAME_FILE=... for a baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12821);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });
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
    try { loadMap('gelwaterGrotto'); game.paused = false; } catch (e) { out.mapErr = String(e); }
    await sleep(1200);
    if (!game.monsters.some((x) => x.type === 'king')) {
      try { loadMap('slimeCave'); } catch (e) {}
      await sleep(1200);
    }
    const g0 = game.time | 0, t0 = performance.now();
    while (((game.time | 0) - g0) < 20 && performance.now() - t0 < 15000) await sleep(16);
    out.framesRan = (game.time | 0) - g0;
    out.map = game.currentMap;
    out.featherList = (typeof _LX_FEATHER_BOTTOM !== 'undefined') ? Array.from(_LX_FEATHER_BOTTOM) : null;

    // --- the feather, measured through the game's own soft draw ---
    const img = (typeof BOSS_IDLE_FRAMES !== 'undefined' && BOSS_IDLE_FRAMES.king && BOSS_IDLE_FRAMES.king[0]) || null;
    out.haveSprite = !!(img && img.complete && img.naturalWidth > 0);
    if (out.haveSprite && typeof _lxDrawSoft === 'function') {
      const bottomAlphaRamp = (opts) => {
        const c = document.createElement('canvas'); c.width = 200; c.height = 200;
        const cc = c.getContext('2d');
        _lxDrawSoft(cc, img, 10, 10, 180, 180, opts);
        const d = cc.getImageData(0, 0, 200, 200).data;
        // mean alpha of the lowest opaque band vs the band above it
        const rowAlpha = (y) => { let s = 0, n = 0; for (let x = 0; x < 200; x++) { const a = d[(y * 200 + x) * 4 + 3]; if (a > 0) { s += a; n++; } } return n ? s / n : 0; };
        let lastRow = -1;
        for (let y = 199; y >= 0; y--) { if (rowAlpha(y) > 0) { lastRow = y; break; } }
        if (lastRow < 12) return null;
        const low = (rowAlpha(lastRow) + rowAlpha(lastRow - 1) + rowAlpha(lastRow - 2)) / 3;
        const mid = (rowAlpha(lastRow - 10) + rowAlpha(lastRow - 11) + rowAlpha(lastRow - 12)) / 3;
        return { low: Math.round(low), mid: Math.round(mid), ratio: mid ? +(low / mid).toFixed(2) : 0 };
      };
      out.crisp = bottomAlphaRamp({ deep: true });                      // how he is drawn now
      out.faded = bottomAlphaRamp({ deep: true, softBottom: true });    // the old opt-in, for contrast
    }

    // --- his projectiles ---
    let m = game.monsters.find((x) => x.type === 'king');
    out.foundBoss = !!m;
    if (!m) { try { spawnMonster(player.x + 320, player.y - 120, 'king', true); } catch (e) { out.spawnErr = String(e); } m = game.monsters.find((x) => x.type === 'king'); }
    if (m) {
      const sizes = {};
      out.spawnedBoss = !!m;
      for (const [label, st] of [['gluespray', 'gluespray'], ['leap', 'leap'], ['quake', 'quake']]) {
        game.projectiles.length = 0;
        m.patternState = st; m.patternTimer = 0;
        const gg = game.time | 0, tt = performance.now();
        while (((game.time | 0) - gg) < 260 && performance.now() - tt < 20000) {
          await sleep(16);
          // his AI reclaims the state, so keep asking until the pattern actually fires
          if (!game.projectiles.some((p) => p.owner === 'enemy' && p.skill)) {
            m.patternState = st;
            if ((m.patternTimer | 0) > 1200) m.patternTimer = 0;
          }
          for (const p of game.projectiles) if (p.owner === 'enemy' && p.skill) sizes[p.skill] = Math.max(sizes[p.skill] || 0, p.w);
        }
      }
      out.projSizes = sizes;
    }
    // --- the idle / walk timing ---
    out.ft = {
      idle: (typeof _lxCalibFt === 'function') ? _lxCalibFt('king', 'idle') : 'no fn',
      walk: (typeof _lxCalibFt === 'function') ? _lxCalibFt('king', 'walk') : 'no fn',
    };
    return out;
  });
  console.log('  map ' + R.map + ' | frames ' + R.framesRan + ' | feather list ' + JSON.stringify(R.featherList));
  console.log('  bottom rows  now ' + JSON.stringify(R.crisp) + '   with the old opt-in ' + JSON.stringify(R.faded));
  console.log('  projectile sizes ' + JSON.stringify(R.projSizes) + ' | idle ft ' + JSON.stringify(R.ft && R.ft.idle) + ' walk ft ' + JSON.stringify(R.ft && R.ft.walk));
  const C = R.crisp || {}, Fd = R.faded || {}, P = R.projSizes || {}, FT = R.ft || {};
  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('HIS BASE IS NOT FEATHERED: the bottom rows keep their alpha',
    C.ratio >= 0.55 && Fd.ratio > 0 && Fd.ratio < C.ratio * 0.5,
    `bottom/mid alpha now ${C.ratio} vs ${Fd.ratio} with the old opt-in`);
  ok('KROOK KEEPS HIS: the opt-in list still holds kingKrook',
    Array.isArray(R.featherList) && R.featherList.includes('kingKrook') && !R.featherList.includes('king'),
    JSON.stringify(R.featherList));
  // He fires whichever pattern his AI reaches first; assert on every enemy projectile
  // he actually spawned - splash was 14 px and the glue spray 16 before this change.
  const ballSizes = Object.entries(P).filter(([k]) => k === 'goo' || k === 'splash');
  ok('THE SLIME BALLS ARE VISIBLE: every ball he throws is at the ordinary mob size',
    ballSizes.length > 0 && ballSizes.every(([, v]) => v >= 28),
    JSON.stringify(P) + ' (previous build: splash 14, goo 16)');
  ok('THE IDLE HAS AUTHORED TIMING: idle and walk carry frame times',
    Array.isArray(FT.idle) && Array.isArray(FT.walk) && FT.idle.length >= 9,
    `idle ${Array.isArray(FT.idle) ? FT.idle.length + ' frames, mean ' + Math.round(FT.idle.reduce((a, b) => a + b, 0) / FT.idle.length) + ' ms' : FT.idle} (previous build: none, flat 130 ms)`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
