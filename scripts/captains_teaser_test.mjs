// THE FOUR CAPTAINS' TEASER (v0.30.1554, per user: "The introduction needs to be dramatic and epic showing the prowess of each of
// them, use higgsfield to generate a strong introductory video", then "ship it at a key milestone").
//   1. the film ships: committed, under 16 MB, in steam/package.json's extraResources (unlisted clips do not ship), SPEC beside it
//   2. reaching Lv 20 (the class trial) plays it - full screen, the film's own file, playing, with sound when the music is up;
//      Lv 18 only warms the file
//   3. the game stays paused under it past the stuck-pause watchdog's 3 s (it is a registered pause surface), and the map's
//      music has stepped aside (the cinematic mix owns it); the Lv 20 advancement toasts wait for it
//   4. any key skips it: the overlay goes, the running game comes back, the mix is handed back, the save remembers it, and then
//      the advancement toast names your captain
//   5. it never plays twice; a boss arena defers it to the next level-up; no page errors
//   node scripts/captains_teaser_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn, execFileSync } from 'node:child_process';
import { existsSync, statSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11871), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const CLIP = 'steam/higgsfield/cinematics/clip_four_captains.mp4', P = path.join(SERVE_ROOT, CLIP);
ok('1. the film is on disk, 45 s of 1080p under 16 MB', existsSync(P) && statSync(P).size > 4e6 && statSync(P).size < 16 * 1048576, existsSync(P) ? +(statSync(P).size / 1048576).toFixed(1) + ' MB' : 'missing');
let tracked = ''; try { tracked = execFileSync('git', ['ls-files', '--', CLIP], { cwd: SERVE_ROOT, encoding: 'utf8' }).trim(); } catch (e) {}
ok('1. ...committed', tracked === CLIP, tracked || 'untracked');
ok('1. ...in the Steam packaging filter', readFileSync(path.join(SERVE_ROOT, 'steam/package.json'), 'utf8').includes('"' + CLIP + '"'));
ok('1. ...with its SPEC beside it', existsSync(P.replace(/\.mp4$/, '.SPEC.md')));
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errs = [], clipReq = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  page.on('request', (q) => { if (/clip_four_captains/.test(q.url())) clipReq.push(q.url().split('/').pop()); });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxPlayCaptainsTeaser === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._tutorialSeen = true; player._gravitosCineSeen = true; player.job = null; player._advNudge20 = false;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    delete player._storyBeatsSeen.epilogue_gravitos; delete player._storyBeatsSeen.captains_teaser;
    await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    loadMap('town', 300); await sleep(1200); game.paused = false;
    try { const s = _lxGetSettings(); s.bgm = 70; s.mute = false; } catch (e) {}
    const ov = () => document.getElementById('captains-teaser-overlay');
    const toasts = []; const _ts = window.showToast; window.showToast = function (m, k) { toasts.push({ m: String(m).slice(0, 70), up: !!ov() }); return _ts.apply(this, arguments); };
    const levelTo = (lv) => { player.level = lv - 1; player.exp = player.expToNext; _maybeLevelUp(); };
    const clear = () => { try { closeAllModals(); } catch (e) {} const d = document.getElementById('dialog'); if (d && d.style.display === 'block') try { closeDialog(); } catch (e) {} game.paused = false; };
    // Lv 18: warms, plays nothing
    levelTo(18); await sleep(2500); clear();
    out.at18 = { overlay: !!ov(), seen: !!player._storyBeatsSeen.captains_teaser, level: player.level };
    // a boss arena defers it
    const arena = Object.keys(MAPS).find((k) => MAPS[k].isBossArena);
    if (arena) { loadMap(arena, 300); await sleep(900); game.paused = false; levelTo(20); await sleep(2500); out.arena = { map: arena, overlay: !!ov(), seen: !!player._storyBeatsSeen.captains_teaser, pending: !!window._lxTeaserPending }; loadMap('town', 300); await sleep(900); clear(); }
    // Lv 20 in town: the teaser, with the advancement toasts held back
    player._advNudge20 = false; toasts.length = 0;
    levelTo(20);
    for (let i = 0; i < 40 && !ov(); i++) { await sleep(250); if (!ov()) clear(); }   // never unpause once it is up
    const v = ov() && ov().querySelector('video');
    await sleep(2500);
    out.playing = { overlay: !!ov(), level: player.level, src: v ? v.getAttribute('src') : null, t: v ? +v.currentTime.toFixed(2) : -1, rs: v ? v.readyState : -1, muted: v ? v.muted : null, vol: v ? +v.volume.toFixed(2) : null,
      paused: !!game.paused, mix: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null, full: ov() ? (() => { const a = ov().getBoundingClientRect(), b = document.querySelector('.game-wrapper').getBoundingClientRect(); return Math.abs(a.width - b.width) <= 4 && Math.abs(a.height - b.height) <= 4; })() : false };   // inside the wrapper's border
    await sleep(3000);   // past the stuck-pause watchdog
    out.held = { overlay: !!ov(), paused: !!game.paused, t: v ? +v.currentTime.toFixed(2) : -1, mix: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null, advToastWhileUp: toasts.filter((x) => /LEVEL 20|Speak to/.test(x.m) && x.up).length };
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    await sleep(1600);
    out.skipped = { overlay: !!ov(), paused: !!game.paused, seen: !!player._storyBeatsSeen.captains_teaser, mix: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null };
    await sleep(3500);
    out.toasts = toasts.filter((x) => /LEVEL 20|Speak to/.test(x.m));
    out.again = _lxPlayCaptainsTeaser(); levelTo(21); await sleep(1500); out.againOverlay = !!ov();
    window.showToast = _ts;
    return out;
  });
  ok('2. Lv 18 plays nothing (it only warms the film)', !R.at18.overlay && !R.at18.seen && R.at18.level === 18, R.at18);
  ok('2. ...and the warm-up fetched it', clipReq.length >= 1, clipReq);
  ok('5. reaching Lv 20 inside a boss arena defers it (not played, not spent)', !R.arena || (!R.arena.overlay && !R.arena.seen && !R.arena.pending), R.arena);
  const P2 = R.playing;
  ok('2. reaching Lv 20 opens the teaser full screen, on its own file', P2.overlay && P2.level === 20 && P2.full && /clip_four_captains\.mp4$/.test(P2.src || ''), P2);
  ok('2. ...and it is playing, with sound at the music volume', P2.rs >= 2 && P2.t > 0.5 && P2.muted === false && P2.vol > 0, P2);
  ok('3. the game is paused under it and the cinematic mix owns the music', P2.paused && P2.mix === true, P2);
  ok('3. ...still paused, still playing past the 3 s watchdog, and no advancement toast over it', R.held.overlay && R.held.paused && R.held.t > P2.t + 2 && R.held.mix === true && R.held.advToastWhileUp === 0, R.held);
  ok('4. any key skips it: overlay gone, the running game comes back, the mix handed back, the save remembers', !R.skipped.overlay && !R.skipped.paused && R.skipped.seen && R.skipped.mix === false, R.skipped);
  ok('4. ...then the advancement toasts arrive and name your captain', R.toasts.length >= 2 && R.toasts.every((x) => !x.up) && R.toasts.some((x) => /Speak to Will/.test(x.m)), R.toasts);
  ok('5. it never plays twice (called again, or at Lv 21)', R.again === false && !R.againOverlay, { again: R.again, overlay: R.againOverlay });
  ok('5. no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
