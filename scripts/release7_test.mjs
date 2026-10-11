// RELEASE HUNT 7 (per user: "yes" - round three) - the third-round hunters' fixes stay fixed:
//   K1 tint bakes and map-entry warm bakes count against the canvas budget (canvas memory grew ~9 MP per map hop, unbounded)
//   S1 the M key mute keeps the Settings switch in step, so a later volume nudge cannot unmute it
//   V1 the Boss Rush costs nothing even when you close the game while downed there (_lxDeathToll)
//   V2 / V3 load-time notices go through the title's save notice   N2 a beat waits for a kill film, and a film keeps a beat's pause
//   node scripts/release7_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11971), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    player._tutorialSeen = true; window._prologueAfterCreation = false;
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._gravitosCineSeen = true; player.level = 70; player._god = true; player.invulnerable = 1e12;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    const clear = () => { try { closeAllModals(); } catch (e) {} game.paused = false; };
    const go = async (map) => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[map] = true; for (let i = 0; i < 3 && game.currentMap !== map; i++) { loadMap(map, 300); await sleep(1800); } clear(); };
    // K1 - a fight in a boss arena: its warm bakes and the hit-flash copies are in the budget
    await go('krookThrone');
    const t0 = performance.now(); while (performance.now() - t0 < 6000) { for (const m of (game.monsters || []).slice(0, 6)) { try { hitMonster(m, Math.max(1, Math.floor(m.maxHp * 0.01)), false, null); } catch (e) {} } await sleep(250); }
    const keys = [..._lxCvLru.keys()];
    out.k1 = { tracked: keys.length, flash: keys.filter((c) => c._lxIsFlash).length, warm: keys.filter((c) => Array.isArray(c._lxHolders)).length };
    await go('witheringTide'); await sleep(3500);
    { const memos = (window._lxSpriteWatch || []).filter((im) => im && im._lxBakedCv); out.k1.memos = memos.length; out.k1.trackedMemos = memos.filter((im) => _lxCvLru.has(im._lxBakedCv)).length; out.k1.warm = [..._lxCvLru.keys()].filter((c) => Array.isArray(c._lxHolders)).length; }
    // a tint bake made directly is registered, and its eviction drops it from the source
    const src = (game.monsters || []).map((m) => m && m._lxLastImg).find(Boolean) || [...document.images].find((im) => im.complete && im.naturalWidth > 64);
    let tb = null; try { tb = _lxTintBake(src, 'grayscale(1)'); } catch (e) {}
    out.k1.direct = !!(tb && _lxCvLru.has(tb));
    if (tb) { const e = _lxCvLru.get(tb); try { e.evict(tb); } catch (x) {} out.k1.evicted = !(src._lxTintBakes && src._lxTintBakes['grayscale(1)'] === tb); }
    // S1
    const sw = () => document.getElementById('set-mute').classList.contains('on');
    const m0 = !!audio.muted; audio.toggleMute(); const m1 = !!audio.muted, s1 = sw();
    try { applySettingsLive(); } catch (e) {} const m2 = !!audio.muted;
    audio.toggleMute(); try { applySettingsLive(); } catch (e) {}
    out.s1 = { m0, m1, switch: s1, afterApply: m2, back: !!audio.muted === m0 };
    // V1
    await go('forest'); player.mojicoins = 100000; player.exp = 1000; const fieldToll = _lxDeathToll();
    await go('boss_rush'); const rushToll = _lxDeathToll();
    out.v1 = { field: fieldToll, rush: rushToll };
    const scripts = [...document.scripts].map((x) => x.textContent).join('\n');
    out.v2 = scripts.includes("(typeof _lxSaveNotice === 'function' ? _lxSaveNotice : showToast)('⛑ You were down when the game closed.");
    out.v3 = scripts.includes("'🗼 Your Expedition ended when the game closed'");
    out.n2 = scripts.split("game.paused = _wasPaused || (typeof _anyOtherModalOpen === 'function' && _anyOtherModalOpen());").length - 1;
    out.n2b = scripts.includes("document.getElementById('lx-pause') || document.getElementById('kill-film-overlay')) {");
    return out;
  });
  // T2 - the rotate screen pauses play and hands it back; T3 - text fields are selectable; T4 - Continue busies the menu (source)
  await page.evaluate(async () => { for (let i = 0; i < 3 && game.currentMap !== 'forest'; i++) { loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1500)); } try { closeAllModals(); } catch (e) {} game.paused = false; });
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await page.waitForTimeout(1200);
  const T2a = await page.evaluate(() => ({ nag: document.body.classList.contains('nag-portrait'), paused: !!game.paused, surface: !!(document.getElementById('rotate-nag') || {}).classList?.contains('on') }));
  await page.waitForTimeout(3600);   // past the stuck-pause watchdog
  const T2b = await page.evaluate(() => ({ paused: !!game.paused }));
  await page.setViewportSize({ width: 1280, height: 720 }); await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await page.waitForTimeout(1200);
  const T2c = await page.evaluate(() => ({ nag: document.body.classList.contains('nag-portrait'), paused: !!game.paused }));
  const T3 = await page.evaluate(() => { const ids = ['auth-user', 'menu-coop-code', 'mjx-search']; return ids.map((id) => { const e = document.getElementById(id); return e ? getComputedStyle(e).userSelect || getComputedStyle(e).webkitUserSelect : 'missing'; }); });
  const T4 = await page.evaluate(() => [...document.scripts].map((x) => x.textContent).join('\n').includes("_la.classList.add('lx-menu-busy')"));
  ok('T2. the rotate-your-phone screen pauses play (past the watchdog) and hands it back when it clears', T2a.nag && T2a.paused && T2a.surface && T2b.paused && !T2c.nag && !T2c.paused, { T2a, T2b, T2c });
  ok('T3. text fields are selectable, so iOS can type into them', T3.every((v) => v === 'text' || v === 'missing') && T3.some((v) => v === 'text'), T3);
  ok('T4. Continue takes the title menu out of reach while it loads', T4);
  ok('K1. the fight\'s hit-flash copies and the arena\'s warm bakes count against the canvas budget', R.k1.flash >= 1 && R.k1.memos > 0 && R.k1.trackedMemos === R.k1.memos, R.k1);   // every bake memo in the budget (which pipeline made it depends on timing)
  ok('K1. a tint bake made directly is registered, and evicting it frees it from its source', R.k1.direct && R.k1.evicted, R.k1);
  ok('S1. the M key mute flips the Settings switch, and a later settings apply keeps it muted', R.s1.m1 !== R.s1.m0 && R.s1.switch === R.s1.m1 && R.s1.afterApply === R.s1.m1 && R.s1.back, R.s1);
  ok('V1. the death toll is nothing in the Boss Rush (a reload included) and the usual toll elsewhere', R.v1.rush.coins === 0 && R.v1.rush.exp === 0 && R.v1.field.coins > 0 && R.v1.field.exp > 0, R.v1);
  ok('V2/V3. the downed-reload and Expedition-reload notices go through the title notice', R.v2 && R.v3, { v2: R.v2, v3: R.v3 });
  ok('N2. the three film players keep a beat\'s pause, and a beat waits for a kill film', R.n2 === 3 && R.n2b, { closes: R.n2, waits: R.n2b });
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
