// AETHERION'S RELEASE (v0.30.1645, per user: "ship this after aetherion 2 death").
//   1. the film ships: committed, under 16 MB, in steam/package.json's extraResources (unlisted clips do not ship), SPEC beside it
//   2. it is a row of LX_KILL_FILMS (need: _aetherionEvolved) beside the Smith's and her films (those rows kept)
//   3. his spawn in the Sanctum warms it; an Echo Keeper rematch, an expedition boss, a mirage or a FIRST-form kill never plays it
//   4. his second form's death plays it ~1.5 s later: full screen, its own file, playing, with sound when the music is up; the game
//      is paused under it past the stuck-pause watchdog's 3 s and the cinematic mix owns the music
//   5. his last-words card ("I WAS THE ANSWER ONCE.", due 3.5 s after his death) does NOT open over the film - it waits, and
//      opens once the film is skipped
//   6. it never plays twice; no page errors
//   node scripts/aetherion_release_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn, execFileSync } from 'node:child_process';
import { existsSync, statSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11919), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const CLIP = 'steam/higgsfield/cinematics/clip_aetherion_release.mp4', P = path.join(SERVE_ROOT, CLIP);
ok('1. the film is on disk, 12 s of 1080p under 16 MB', existsSync(P) && statSync(P).size > 2e6 && statSync(P).size < 16 * 1048576, existsSync(P) ? +(statSync(P).size / 1048576).toFixed(1) + ' MB' : 'missing');
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
  page.on('request', (q) => { if (/clip_aetherion_release/.test(q.url())) clipReq.push(q.url().split('/').pop()); });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxPlayKillFilm === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._tutorialSeen = true; player._gravitosCineSeen = true; player.level = 70; player.invulnerable = 1e9;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    for (const k of ['captains_teaser', 'barnaby_fall', 'mira_ashes', 'mira_aetherion']) player._storyBeatsSeen[k] = true;
    delete player._storyBeatsSeen.aetherion_release; delete player._storyBeatsSeen.warden_falls;   // the card shows only before the farewell
    await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    try { const s = _lxGetSettings(); s.bgm = 70; s.mute = false; } catch (e) {}
    const ov = () => document.getElementById('kill-film-overlay'), card = () => !!document.querySelector('.lx-ending-card');
    const clear = () => { try { closeAllModals(); } catch (e) {} const d = document.getElementById('dialog'); if (d && d.style.display === 'block') try { closeDialog(); } catch (e) {} game.paused = false; };
    out.rows = { ae: LX_KILL_FILMS.aetherion || null, mira: !!LX_KILL_FILMS.miraFallen, smith: !!LX_KILL_FILMS.sundered_smith };
    game.visitedMaps = game.visitedMaps || {}; game.visitedMaps.sanctum = true;
    loadMap('sanctum', 300); await sleep(1500); game.paused = false;
    let boss = null; for (let i = 0; i < 40 && !boss; i++) { boss = game.monsters.find((q) => q.type === 'aetherion'); if (!boss) await sleep(250); }
    out.spawned = !!boss;
    for (const f of ['_echoBoss', '_expeditionBoss', '_isMirage']) _lxKillFilmKill({ type: 'aetherion', _aetherionEvolved: true, [f]: true });
    _lxKillFilmKill({ type: 'aetherion' });   // his first form
    await sleep(2200); out.guards = { overlay: !!ov(), pending: !!window._lxKillFilmPending, seen: !!player._storyBeatsSeen.aetherion_release };
    // drive him into his second form, let the change play out, then end him
    if (boss) boss.currentHp = Math.floor(boss.maxHp * 0.45);
    for (let i = 0; i < 40 && boss && !boss._aetherionEvolved; i++) { await sleep(250); clear(); }
    out.evolved = !!(boss && boss._aetherionEvolved);
    for (let i = 0; i < 24; i++) { await sleep(250); clear(); }
    out.kills = 0; if (boss) for (let k = 0; k < 3 && game.monsters.includes(boss) && !boss._kfPlayed; k++) { boss.currentHp = 0; killMonster(boss); out.kills++; await sleep(700); }
    for (let i = 0; i < 60 && !ov(); i++) { await sleep(250); if (!ov()) clear(); }   // never unpause once it is up
    const v = ov() && ov().querySelector('video');
    await sleep(2500);
    out.playing = { overlay: !!ov(), film: ov() ? ov().dataset.film : null, src: v ? v.getAttribute('src') : null, t: v ? +v.currentTime.toFixed(2) : -1, rs: v ? v.readyState : -1, muted: v ? v.muted : null, vol: v ? +v.volume.toFixed(2) : null,
      paused: !!game.paused, mix: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null, card: card(), full: ov() ? (() => { const a = ov().getBoundingClientRect(), b = document.querySelector('.game-wrapper').getBoundingClientRect(); return Math.abs(a.width - b.width) <= 4 && Math.abs(a.height - b.height) <= 4; })() : false };
    await sleep(3500);   // past the stuck-pause watchdog, and well past the card's old 3.5 s
    out.held = { overlay: !!ov(), paused: !!game.paused, t: v ? +v.currentTime.toFixed(2) : -1, mix: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null, card: card() };
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    await sleep(1400);
    out.skipped = { overlay: !!ov(), seen: !!player._storyBeatsSeen.aetherion_release, mix: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null, pending: !!window._lxKillFilmPending };
    let cardAt = -1; for (let i = 0; i < 16 && cardAt < 0; i++) { if (card()) cardAt = i * 250; else await sleep(250); }
    out.cardAfter = cardAt;
    out.again = _lxPlayKillFilm(LX_KILL_FILMS.aetherion); _lxKillFilmKill({ type: 'aetherion', _aetherionEvolved: true }); await sleep(2200); out.againOverlay = !!ov();
    return out;
  });
  ok('2. LX_KILL_FILMS has his row, asking for his second form (the Smith\'s and her rows kept)', R.rows.ae && R.rows.ae.key === 'aetherion_release' && /clip_aetherion_release\.mp4$/.test(R.rows.ae.src) && R.rows.ae.need === '_aetherionEvolved' && R.rows.mira && R.rows.smith, R.rows);
  ok('3. Aetherion is in his Sanctum, and his spawn warmed the film', R.spawned && clipReq.length >= 1, { spawned: R.spawned, req: clipReq });
  ok('3. an echo, an expedition boss, a mirage or a first-form kill never plays it (nothing pending, nothing spent)', !R.guards.overlay && !R.guards.pending && !R.guards.seen, R.guards);
  const P2 = R.playing;
  ok('4. his second form\'s death opens the film full screen, on its own file', R.evolved && P2.overlay && P2.film === 'aetherion_release' && P2.full && /clip_aetherion_release\.mp4$/.test(P2.src || ''), { ...P2, evolved: R.evolved, kills: R.kills });
  ok('4. ...and it is playing, with sound at the music volume', P2.rs >= 2 && P2.t > 0.5 && P2.muted === false && P2.vol > 0, P2);
  ok('4. the game is paused under it and the cinematic mix owns the music', P2.paused && P2.mix === true, P2);
  ok('4. ...still paused and playing past the 3 s watchdog', R.held.overlay && R.held.paused && R.held.t > P2.t + 2 && R.held.mix === true, R.held);
  ok('5. his last-words card never opens over the film', P2.card === false && R.held.card === false, { during: P2.card, held: R.held.card });
  ok('5. any key skips it: overlay gone, the mix handed back, the save remembers, nothing left pending', !R.skipped.overlay && R.skipped.seen && R.skipped.mix === false && !R.skipped.pending, R.skipped);
  ok('5. ...and then his last words open', R.cardAfter >= 0, R.cardAfter);
  ok('6. it never plays twice (called again, or another real kill)', R.again === false && !R.againOverlay, { again: R.again, overlay: R.againOverlay });
  ok('6. no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
