// THE WOMAN WHO TURNED BACK BECOMES AETHERION (v0.30.1642, per user: "ship it after defeating distorted mira").
//   1. the film ships: committed, under 16 MB, in steam/package.json's extraResources (unlisted clips do not ship), SPEC beside it
//   2. it is a row of LX_KILL_FILMS beside the Smith's ashes (that row kept)
//   3. her spawn on the Last Step warms the film; an Echo Keeper rematch, an expedition boss or a mirage never plays it
//   4. her first real death (she revives once - revivesOnce 0.30 - so the film waits for the second fall) plays it ~1.5 s later:
//      full screen, its own file, playing, with sound when the music is up; the game is paused under it past the stuck-pause
//      watchdog's 3 s and the cinematic mix owns the music
//   5. any key skips it: the overlay goes, the mix is handed back, the save remembers it; it never plays twice; no page errors
//   node scripts/mira_aetherion_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn, execFileSync } from 'node:child_process';
import { existsSync, statSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11917), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const CLIP = 'steam/higgsfield/cinematics/clip_mira_aetherion.mp4', P = path.join(SERVE_ROOT, CLIP);
ok('1. the film is on disk, ~12 s of 1080p under 16 MB', existsSync(P) && statSync(P).size > 2e6 && statSync(P).size < 16 * 1048576, existsSync(P) ? +(statSync(P).size / 1048576).toFixed(1) + ' MB' : 'missing');
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
  page.on('request', (q) => { if (/clip_mira_aetherion/.test(q.url())) clipReq.push(q.url().split('/').pop()); });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxPlayKillFilm === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._tutorialSeen = true; player._gravitosCineSeen = true; player.level = 55; player.invulnerable = 1e9;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    player._storyBeatsSeen.captains_teaser = true; player._storyBeatsSeen.barnaby_fall = true; player._storyBeatsSeen.mira_ashes = true;
    delete player._storyBeatsSeen.mira_aetherion;
    await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    try { const s = _lxGetSettings(); s.bgm = 70; s.mute = false; } catch (e) {}
    const ov = () => document.getElementById('kill-film-overlay');
    const clear = () => { try { closeAllModals(); } catch (e) {} const d = document.getElementById('dialog'); if (d && d.style.display === 'block') try { closeDialog(); } catch (e) {} game.paused = false; };
    out.rows = { mira: LX_KILL_FILMS.miraFallen || null, smith: !!(LX_KILL_FILMS.sundered_smith && LX_KILL_FILMS.sundered_smith.key === 'mira_ashes') };
    game.visitedMaps = game.visitedMaps || {}; game.visitedMaps.lastStep = true; game.visitedMaps.sundered_forge = true;
    loadMap('lastStep', 300); await sleep(1500); game.paused = false;
    let boss = null; for (let i = 0; i < 40 && !boss; i++) { boss = game.monsters.find((q) => q.type === 'miraFallen'); if (!boss) await sleep(250); }
    out.spawned = !!boss;
    for (const f of ['_echoBoss', '_expeditionBoss', '_isMirage']) _lxKillFilmKill({ type: 'miraFallen', [f]: true });
    await sleep(2200); out.guards = { overlay: !!ov(), pending: !!window._lxKillFilmPending, seen: !!player._storyBeatsSeen.mira_aetherion };
    // she revives once (revivesOnce 0.30) - the film waits for her real death, so kill her through the revive
    out.kills = 0; if (boss) for (let k = 0; k < 4 && game.monsters.includes(boss) && !boss._kfPlayed; k++) { boss.currentHp = 0; killMonster(boss); out.kills++; await sleep(700); }
    out.revived = !!(boss && boss._revivedOnce);
    for (let i = 0; i < 60 && !ov(); i++) { await sleep(250); if (!ov()) clear(); }   // never unpause once it is up
    const v = ov() && ov().querySelector('video');
    await sleep(2500);
    out.playing = { overlay: !!ov(), film: ov() ? ov().dataset.film : null, src: v ? v.getAttribute('src') : null, t: v ? +v.currentTime.toFixed(2) : -1, rs: v ? v.readyState : -1, muted: v ? v.muted : null, vol: v ? +v.volume.toFixed(2) : null,
      paused: !!game.paused, mix: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null, full: ov() ? (() => { const a = ov().getBoundingClientRect(), b = document.querySelector('.game-wrapper').getBoundingClientRect(); return Math.abs(a.width - b.width) <= 4 && Math.abs(a.height - b.height) <= 4; })() : false };
    await sleep(3500);   // past the stuck-pause watchdog
    out.held = { overlay: !!ov(), paused: !!game.paused, t: v ? +v.currentTime.toFixed(2) : -1, mix: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null };
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    await sleep(1400);
    out.skipped = { overlay: !!ov(), seen: !!player._storyBeatsSeen.mira_aetherion, mix: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null, pending: !!window._lxKillFilmPending, paused: !!game.paused };
    out.again = _lxPlayKillFilm(LX_KILL_FILMS.miraFallen); _lxKillFilmKill({ type: 'miraFallen' }); await sleep(2200); out.againOverlay = !!ov();
    return out;
  });
  ok('2. LX_KILL_FILMS has her row (and the Smith\'s ashes kept)', R.rows.mira && R.rows.mira.key === 'mira_aetherion' && /clip_mira_aetherion\.mp4$/.test(R.rows.mira.src) && R.rows.smith, R.rows);
  ok('3. the Woman Who Turned Back is on the Last Step, and her spawn warmed the film', R.spawned && clipReq.length >= 1, { spawned: R.spawned, req: clipReq });
  ok('3. an echo rematch, an expedition boss or a mirage never plays it (nothing pending, nothing spent)', !R.guards.overlay && !R.guards.pending && !R.guards.seen, R.guards);
  const P2 = R.playing;
  ok('4. her real death (after her one revive) opens the film full screen, on its own file', P2.overlay && P2.film === 'mira_aetherion' && P2.full && /clip_mira_aetherion\.mp4$/.test(P2.src || '') && R.revived && R.kills >= 2, { ...P2, kills: R.kills, revived: R.revived });
  ok('4. ...and it is playing, with sound at the music volume', P2.rs >= 2 && P2.t > 0.5 && P2.muted === false && P2.vol > 0, P2);
  ok('4. the game is paused under it and the cinematic mix owns the music', P2.paused && P2.mix === true, P2);
  ok('4. ...still paused and playing past the 3 s watchdog', R.held.overlay && R.held.paused && R.held.t > P2.t + 2 && R.held.mix === true, R.held);
  ok('5. any key skips it: overlay gone, the mix handed back, the save remembers, nothing left pending', !R.skipped.overlay && R.skipped.seen && R.skipped.mix === false && !R.skipped.pending, R.skipped);
  ok('5. it never plays twice (called again, or another real kill)', R.again === false && !R.againOverlay, { again: R.again, overlay: R.againOverlay });
  ok('5. no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
