// GRAVITOS AWAKENS + ASCENDS - his two transformation films (2026-10-09). Per user: "when gravitos first form is defeated a ghastly evil aura occurs
// and he undergoes an epic transformation to gravitos2 form ... make it 5s and include audio, to play when gravitos first form is
// down. when the video is playing player is immune to damage".
//   1. the film ships: on disk (5 s, under 16 MB, with an audio track), listed in steam/package.json, its SPEC beside it
//   2. a LX_KILL_FILMS row under the pseudo-type _gravitosAwaken (the other rows kept); his spawn warms it
//   3. form 1's death: he becomes form 2 and the film opens full screen, paused game under it, playing with sound
//   4. the hero is immune from the killing blow, all through the film, and for a grace after it closes
//   5. his awakened speech waits for the film and opens once it is skipped
//   6. once per save; his final death (and a type-keyed kill) never plays it; no page errors
//   node scripts/gravitos_awaken_film_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, statSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11931), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const CLIP = 'steam/higgsfield/cinematics/clip_gravitos_awaken.mp4', P = path.join(SERVE_ROOT, CLIP);
const head = existsSync(P) ? readFileSync(P).subarray(0, 1 << 20).toString('latin1') : '';
ok('1. the film is on disk, under 16 MB, with an audio track', existsSync(P) && statSync(P).size > 5e5 && statSync(P).size < 16 * 1048576 && /soun/.test(head + (existsSync(P) ? readFileSync(P).toString('latin1').slice(-400000) : '')), existsSync(P) ? +(statSync(P).size / 1048576).toFixed(2) + ' MB' : 'missing');
ok('1. ...in the Steam packaging filter', readFileSync(path.join(SERVE_ROOT, 'steam/package.json'), 'utf8').includes('"' + CLIP + '"'));
ok('1. ...with its SPEC beside it', existsSync(P.replace(/\.mp4$/, '.SPEC.md')));
const CLIP3 = 'steam/higgsfield/cinematics/clip_gravitos_ascend.mp4', P3 = path.join(SERVE_ROOT, CLIP3);
ok('1. the ascension film (form 2 -> 3) is on disk under 16 MB, in the Steam filter, with its SPEC', existsSync(P3) && statSync(P3).size > 5e5 && statSync(P3).size < 16 * 1048576 && readFileSync(path.join(SERVE_ROOT, 'steam/package.json'), 'utf8').includes('"' + CLIP3 + '"') && existsSync(P3.replace(/\.mp4$/, '.SPEC.md')), existsSync(P3) ? +(statSync(P3).size / 1048576).toFixed(2) + ' MB' : 'missing');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errs = [], clipReq = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  page.on('request', (q) => { if (/clip_gravitos_awaken/.test(q.url())) clipReq.push(q.url().split('/').pop()); });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxPlayKillFilm === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._tutorialSeen = true; player._gravitosCineSeen = true; player.level = 80; player.invulnerable = 0;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    for (const k of Object.values(LX_KILL_FILMS)) player._storyBeatsSeen[k.key] = true;
    delete player._storyBeatsSeen.gravitos_awaken; delete player._storyBeatsSeen.gravitos_awakened; delete player._storyBeatsSeen.gravitos_ascend; delete player._storyBeatsSeen.gravitos_ascendant;   // his speech shows after the film
    await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    try { const s = _lxGetSettings(); s.bgm = 70; s.mute = false; } catch (e) {}
    const ov = () => document.getElementById('kill-film-overlay');
    // his voice + subtitle inside the film, and the background the speech dialog is painted over afterwards
    const voice = () => { const a = game._lxKillFilmVo, s = ov() && ov().querySelector('.kf-sub');
      return { src: a ? (a.getAttribute('src') || '') : '', playing: !!(a && !a.paused && a.currentTime > 0), muted: a ? a.muted : null, sub: s ? s.textContent : '', subOn: !!(s && s.style.opacity === '1') }; };
    const ground = () => { const sb = document.getElementById('story-beat-overlay'); return sb ? (sb.style.getPropertyValue('--sb-ground') || '') : ''; };
    const beatUp = () => { const sb = document.getElementById('story-beat-overlay'); const d = document.getElementById('dialog'); return !!((sb && sb.classList.contains('on')) || (d && d.style.display === 'block' && /Gravitos/.test(d.textContent || ''))); };
    const clear = () => { try { closeAllModals(); } catch (e) {} const sbo = document.getElementById('story-beat-overlay'); if (sbo && sbo.classList.contains('on')) sbo.click(); const d = document.getElementById('dialog'); if (d && d.style.display === 'block') try { closeDialog(); } catch (e) {} game.paused = false; };   // his speech is a dialog beat: read and closed before the next form can fall
    out.rows = { g: LX_KILL_FILMS._gravitosAwaken || null, others: ['sundered_smith', 'miraFallen', 'aetherion'].every((k) => !!LX_KILL_FILMS[k]), typed: !!LX_KILL_FILMS.gravitos };
    game.visitedMaps = game.visitedMaps || {}; game.visitedMaps.gravitosArena = true;
    loadMap('gravitosArena', 300); await sleep(1500); clear();
    let boss = null; for (let i = 0; i < 40 && !boss; i++) { boss = game.monsters.find((q) => q.type === 'gravitos'); if (!boss) await sleep(250); }
    out.spawned = !!boss;
    // a type-keyed kill (his final death goes through _lxKillFilmKill) must not play the awakening film
    _lxKillFilmKill({ type: 'gravitos', _gravitosFinalForm: true }); await sleep(2000); out.typedKill = { overlay: !!ov(), pending: !!window._lxKillFilmPending };
    for (let i = 0; i < 8; i++) { await sleep(250); clear(); }
    // form 1 goes down
    player.invulnerable = 0; const hp0 = player.hp;
    if (boss) { boss.currentHp = 0; killMonster(boss); }
    out.phase = boss ? boss._gravitosPhase : null;
    await sleep(150); out.gap = { inv: Math.round(player.invulnerable || 0), pending: !!window._lxKillFilmPending, overlay: !!ov() };
    for (let i = 0; i < 40 && !ov(); i++) await sleep(100);
    const v = ov() && ov().querySelector('video');
    for (let i = 0; i < 50 && !(v && v.currentTime > 1.6); i++) await sleep(200);   // judged 1.6 s into the film, however long the file took to arrive
    out.playing = { overlay: !!ov(), film: ov() ? ov().dataset.film : null, src: v ? v.getAttribute('src') : null, t: v ? +v.currentTime.toFixed(2) : -1, rs: v ? v.readyState : -1,
      muted: v ? v.muted : null, audio: v ? (v.webkitAudioDecodedByteCount || 0) : 0, paused: !!game.paused, inv: Math.round(player.invulnerable || 0), beat: beatUp(),
      full: ov() ? (() => { const a = ov().getBoundingClientRect(), b = (document.querySelector('.game-wrapper') || document.body).getBoundingClientRect(); return Math.abs(a.width - b.width) < 5 && Math.abs(a.height - b.height) < 5; })() : false, voice: voice() };
    await sleep(2000);
    out.held = { overlay: !!ov(), paused: !!game.paused, inv: Math.round(player.invulnerable || 0), beat: beatUp(), hp: player.hp >= hp0, hpv: [hp0, player.hp] };   // regen may tick it UP before the pause; nothing may take it down
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    await sleep(700);
    out.closed = { overlay: !!ov(), seen: !!player._storyBeatsSeen.gravitos_awaken, pending: !!window._lxKillFilmPending, inv: Math.round(player.invulnerable || 0) };
    for (let i = 0; i < 20 && !beatUp(); i++) await sleep(250);
    out.speech = beatUp(); out.ground1 = ground();
    out.again = _lxPlayKillFilm(LX_KILL_FILMS._gravitosAwaken); await sleep(400); out.againOverlay = !!ov();
    // form 2 goes down: the ascension film, the same immunity and the speech waiting (his awakened speech is read and closed first)
    for (let i = 0; i < 24 && beatUp(); i++) { await sleep(300); clear(); }
    for (let i = 0; i < 4; i++) { await sleep(250); clear(); }
    out.beatClosed = !beatUp();
    player.invulnerable = 0; const hp3 = player.hp;
    if (boss) { boss.currentHp = 0; killMonster(boss); }
    out.phase3 = boss ? boss._gravitosPhase : null;
    await sleep(150); out.gap3 = { inv: Math.round(player.invulnerable || 0), pending: !!window._lxKillFilmPending };
    for (let i = 0; i < 40 && !ov(); i++) await sleep(100);
    const v3 = ov() && ov().querySelector('video'); for (let i = 0; i < 50 && !(v3 && v3.currentTime > 1.6); i++) await sleep(200);
    out.asc = { film: ov() ? ov().dataset.film : null, src: v3 ? v3.getAttribute('src') : null, t: v3 ? +v3.currentTime.toFixed(2) : -1, muted: v3 ? v3.muted : null, paused: !!game.paused, inv: Math.round(player.invulnerable || 0), beat: beatUp(), hp: player.hp >= hp3, voice: voice() };
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true })); await sleep(700);
    out.asc.closed = !ov(); out.asc.seen = !!player._storyBeatsSeen.gravitos_ascend; out.asc.after = Math.round(player.invulnerable || 0);
    for (let i = 0; i < 20 && !beatUp(); i++) await sleep(250); out.asc.speech = beatUp(); out.asc.ground = ground();
    return out;
  });
  console.log(JSON.stringify(R));
  const G = R.rows.g || {};
  ok('2. a LX_KILL_FILMS row _gravitosAwaken plays this clip on his arena theme; the other films kept; no type-keyed "gravitos" row', G.key === 'gravitos_awaken' && G.src === CLIP && R.rows.others && !R.rows.typed, R.rows);
  ok('2. his spawn in the Singularity warms the film', R.spawned && clipReq.length > 0, { spawned: R.spawned, req: clipReq.length });
  ok('6. his final death (a type-keyed kill) does not play it', !R.typedKill.overlay && !R.typedKill.pending, R.typedKill);
  ok('3. form 1 goes down and he becomes form 2', R.phase === 2, R.phase);
  ok('4. the hero is untouchable from the killing blow, before the film is even up', R.gap.inv > 500 && R.gap.pending, R.gap);
  ok('3. the film opens full screen with its own file, playing, with sound, the game paused under it', R.playing.overlay && R.playing.film === 'gravitos_awaken' && R.playing.src === CLIP && R.playing.t > 0.5 && R.playing.rs >= 2 && R.playing.muted === false && R.playing.audio > 0 && R.playing.paused && R.playing.full, R.playing);
  ok('4. ...immune all through it (i-frames held, no HP lost)', R.playing.inv > 500 && R.held.inv > 500 && R.held.hp && R.held.paused, { inv: [R.playing.inv, R.held.inv], hp: R.held.hpv });
  ok('5. his awakened speech does not open over the film', !R.playing.beat && !R.held.beat, { during: R.playing.beat, held: R.held.beat });
  ok('3. a key skips it; it is marked seen and the pending flag clears', !R.closed.overlay && R.closed.seen && !R.closed.pending, R.closed);
  ok('4. ...with a grace of i-frames after it closes', R.closed.inv >= 900, R.closed.inv);
  ok('5. then his speech opens', R.speech === true, R.speech);
  ok('7. form 2 goes down: he becomes form 3 and the ASCENSION film plays (its own file, sound, paused game)', R.phase3 === 3 && R.asc.film === 'gravitos_ascend' && R.asc.src === CLIP3 && R.asc.t > 0.5 && R.asc.muted === false && R.asc.paused, R.asc);
  ok('7. ...the hero immune from the blow, through it and after (no HP lost)', R.gap3.inv > 500 && R.gap3.pending && R.asc.inv > 500 && R.asc.hp && R.asc.after >= 900, { gap: R.gap3, inv: R.asc.inv, after: R.asc.after });
  ok('7. ...his ascendant speech waits for it, then opens', !R.asc.beat && R.asc.closed && R.asc.seen && R.asc.speech, { beat: R.asc.beat, closed: R.asc.closed, speech: R.asc.speech });
  ok('8. film 1: his voice plays inside it (its own track, sound on) with the subtitle "And you think you have won..."', /vo_gravitos_awaken\.mp3$/.test(R.playing.voice.src) && R.playing.voice.playing && R.playing.voice.muted === false && R.playing.voice.subOn && R.playing.voice.sub === 'And you think you have won...', R.playing.voice);
  ok('8. film 2: his voice plays inside it with the subtitle "I am tired, foreigner..."', /vo_gravitos_ascend\.mp3$/.test(R.asc.voice.src) && R.asc.voice.playing && R.asc.voice.subOn && /^I am tired, foreigner/.test(R.asc.voice.sub), R.asc.voice);
  ok('9. his full speech follows each film as the dialog, over that film\'s final image', /bg_v4_gravitos_awakened\.webp/.test(R.ground1) && /bg_v4_gravitos_ascendant\.webp/.test(R.asc.ground), { g1: R.ground1, g2: R.asc.ground });
  ok('6. it never plays twice', R.again === false && !R.againOverlay, { again: R.again, overlay: R.againOverlay });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.stack || e).slice(0, 400)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
