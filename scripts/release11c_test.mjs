// RELEASE 11c (bug hunt round 11, HUD sizes) stays fixed:
//   1 the boss HP bar starts after the stats card (a boss under ~16% HP no longer shows an empty bar), right end kept
//   2 a non-touch window opened narrow (< 900 CSS px) gets the sharp canvas back when widened; touch devices unchanged
//   3 the docked tour card on touch / narrow layouts never covers #stats or the boss plate, stays on screen, buttons tappable
//   4 the K panel's key captions (emote glyphs included) are 10 px, nothing truncated, key boxes unchanged
//   5 tablet control labels are >= 9 px; a landscape phone's deck labels are unchanged
//   node scripts/release11c_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11983), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const bootIn = async (page) => {
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    player._tutorialSeen = true; window._prologueAfterCreation = false;
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player._gravitosCineSeen = true; player.invulnerable = 1e12; player._god = true;
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
  });
};
const toBoss = (page) => page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 3 && game.currentMap !== 'krookThrone'; i++) { loadMap('krookThrone', 300); await sleep(1500); }
  game.paused = false; for (let i = 0; i < 60 && document.body.classList.contains('cinematic'); i++) await sleep(500);
  for (let i = 0; i < 40 && !game._lxBossPlateBox; i++) await sleep(250);
  const sb = game._superBossRef; if (sb) { sb.currentHp = Math.round(sb.maxHp * 0.12); sb.aiDisabled = true; }
  await sleep(1200); return !!game._lxBossPlateBox;
});
const R = (r) => r && [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
const barGeo = (page) => page.evaluate(() => {
  const st = document.getElementById('stats').getBoundingClientRect(), gc = document.getElementById('game').getBoundingClientRect();
  return { plate: game._lxBossPlateBox.map(Math.round), statsRight: Math.round((st.right - gc.left) * W / gc.width), W };
});
try {
  // ---- 1 + 4: desktop
  const dctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const dp = await dctx.newPage(); await bootIn(dp);
  const bossUp = await toBoss(dp);
  const b1 = await barGeo(dp);
  await dp.setViewportSize({ width: 1920, height: 1080 }); await dp.waitForTimeout(1500);
  const b2 = await barGeo(dp);
  const barOk = (b) => b.plate[0] >= b.statsRight + 8 && b.plate[1] === Math.round(b.W / 2 + Math.min(660, b.W - 120) / 2) && b.plate[1] - b.plate[0] >= 260;
  ok('1. the boss bar starts after the stats card and keeps its right end (1280x720, 1920x1080)', bossUp && barOk(b1) && barOk(b2), { b1, b2 });
  const K = await dp.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    toggleKeybindModal(); await new Promise((r) => setTimeout(r, 800));
    const eff = (e) => parseFloat(getComputedStyle(e).fontSize) * (e.getBoundingClientRect().width / Math.max(1, e.offsetWidth));
    const caps = [...document.querySelectorAll('#keybind-modal .kbm-key i')].filter((e) => e.getClientRects().length);
    const emo = caps.filter((e) => e.querySelector('.lx-emo'));
    const key = document.querySelector('#keybind-modal .kbm-key');
    const out = { n: caps.length, min: +Math.min(...caps.map(eff)).toFixed(2), emo: emo.length, emoMin: emo.length ? +Math.min(...emo.map(eff)).toFixed(2) : null,
      trunc: caps.filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent), keyH: key && key.offsetHeight };
    toggleKeybindModal(); return out;
  });
  ok('4. K panel key captions (emote glyphs too) are 10 px, none cut off, keys still 40 px tall', K.n > 30 && K.min >= 9.5 && K.emo >= 5 && K.emoMin >= 9.5 && K.trunc.length === 0 && K.keyH === 40, K);
  await dctx.close();
  // ---- 2: a non-touch window opened narrow, then widened
  const nctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 860, height: 540 }, deviceScaleFactor: 2 });
  const np = await nctx.newPage(); await bootIn(np);
  const n1 = await np.evaluate(() => ({ dpr: _LX_DPR, mobileAtBoot: _LX_IS_MOBILE, touch: navigator.maxTouchPoints }));
  await np.setViewportSize({ width: 1400, height: 820 }); await np.waitForTimeout(1500);
  const n2 = await np.evaluate(() => ({ dpr: _LX_DPR, cw: canvas.width }));
  ok('2. a desktop window opened at 860 px wide gets the sharp canvas back when widened', n1.dpr === 1 && n1.mobileAtBoot && n2.dpr >= 1.99 && n2.cw >= 1900, { n1, n2 });
  await nctx.close();
  // ---- 3 + 5 + 2(touch): touch layouts
  const mctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' });
  const mp = await mctx.newPage(); await bootIn(mp);
  const mBoss = await toBoss(mp);
  const tour = {};
  const lbl = () => mp.evaluate(() => [...document.querySelectorAll('.mc-btn > span.mc-lbl')].filter((e) => e.getClientRects().length).map((e) => { const b = e.closest('.mc-btn'); return +(parseFloat(getComputedStyle(e).fontSize) * (b.getBoundingClientRect().width / Math.max(1, b.offsetWidth))).toFixed(2); }));   // the button's scale (an inline label's own rect rounds)
  const phoneLbl = await lbl();
  await mp.evaluate(() => _showTutorialModal());
  for (const [w, h] of [[844, 390], [932, 430], [1024, 768], [1366, 1024]]) {
    await mp.setViewportSize({ width: w, height: h }); await mp.waitForTimeout(1800);
    tour[w + 'x' + h] = await mp.evaluate(() => {
      try { _lxTutFit(); } catch (e) {}
      const card = document.querySelector('#tutorial-modal.tut-dock .modal'), st = document.getElementById('stats');
      const c = card.getBoundingClientRect(), s = st.getBoundingClientRect(), gc = document.getElementById('game').getBoundingClientRect();
      const plateB = game._bbLabelVeiled && game._lxBossPlateBox ? gc.top + game._lxBossPlateBox[2] * gc.height / H : 0;
      const hit = ['tut-next', 'tut-skip', 'tut-collapse'].map((id) => { const b = document.getElementById(id); if (!b || !b.getClientRects().length) return id + ':hidden'; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return (e && (e === b || b.contains(e))) ? '' : id; }).filter(Boolean);
      const over = !(c.right <= s.left || c.left >= s.right || c.bottom <= s.top || c.top >= s.bottom);
      return { card: [Math.round(c.left), Math.round(c.top), Math.round(c.right), Math.round(c.bottom)], stats: [Math.round(s.left), Math.round(s.top), Math.round(s.right), Math.round(s.bottom)], plateB: Math.round(plateB), over, onScreen: c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight, hit };
    });
  }
  const tourOk = Object.values(tour).every((t) => !t.over && t.onScreen && t.hit.length === 0 && t.card[1] >= t.plateB);
  ok('3. the tour card never covers the stats card or the boss plate, stays on screen, its buttons take taps (844x390 .. 1366x1024)', mBoss && tourOk, tour);
  const tabLbl = await lbl();
  ok('5. tablet (1366x1024) control labels are >= 9 px', tabLbl.length >= 8 && Math.min(...tabLbl) >= 9, tabLbl);
  await mp.setViewportSize({ width: 1024, height: 768 }); await mp.waitForTimeout(800);
  const tabLbl2 = await lbl();
  ok('5. ...at 1024x768 too, while a landscape phone (844x390) keeps its 7 / 8 px deck labels', tabLbl2.length >= 8 && Math.min(...tabLbl2) >= 9 && phoneLbl.length >= 8 && Math.min(...phoneLbl) >= 7 && Math.max(...phoneLbl) <= 8, { tabLbl2, phoneLbl });
  const td = await mp.evaluate(() => _LX_DPR);
  ok('2. a touch device keeps the phone resolution cap (DPR 1 after a resize)', td === 1, td);
  await mctx.close();
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
