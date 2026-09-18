// VICTORY + DEFEAT STINGS (final polish audit A4 / B6; per user "Work on all the above"). Killing a boss fades the
// playing track out, plays the victory sting and brings the track back; a split twin plays none; a death plays the
// defeat sting as the music falls silent; Gravitos keeps his cinematic score; a muted game stays silent; both decode.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/stingers_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11207';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof killMonster === 'function' && typeof _setBossBgm === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 40; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    try { audio.muted = false; } catch (e) {}
    loadMap('forest', 300); await sleep(2000); try { closeAllModals(); } catch (e) {} game.paused = false;
    _setBossBgm(false, game.currentMap); await sleep(1500);
    const playing = () => [_bgmActiveMapEl, _bgmBossEl, _bgmEl].find((el) => el && !el.paused && el.volume > 0.02) || null;
    const mus = playing(); const tgt = _bgmTargetVol();
    out.musicBefore = mus ? +mus.volume.toFixed(2) : null;
    // files decode
    out.files = {};
    for (const k of ['victory', 'defeat']) { const a = new Audio('audio/stinger/' + k + '.mp3'); out.files[k] = await new Promise((res) => { a.onloadedmetadata = () => res(+a.duration.toFixed(2)); a.onerror = () => res('error'); setTimeout(() => res('timeout'), 8000); }); }
    // a boss kill
    window._lxLastSting = null; game.monsters.length = 0;
    spawnMonster(player.x + 300, player.y - 40, 'king', true, false); const b = game.monsters[game.monsters.length - 1];
    b.currentHp = 0; try { killMonster(b); } catch (e) { out.killErr = e.message; }
    out.victory = window._lxLastSting && window._lxLastSting.kind;
    // v0.30.x - sampled through the window, not once at its end: on a loaded machine the sleeps run long and the
    // 2.8 s sting could finish before a single late look (seen on 2026-09-18 across every build, the sting playing fine).
    let _sp = false;
    for (let i = 0; i < 13; i++) { await sleep(100); const vs = (typeof _lxStingEls !== 'undefined') && _lxStingEls.victory; if (vs && !vs.paused && vs.currentTime > 0) _sp = true; }
    out.musicDuring = mus ? +mus.volume.toFixed(3) : null; out.stingPlaying = _sp;
    try { closeAllModals(); } catch (e) {} game.paused = false;
    await sleep(5600); out.musicAfter = mus ? +mus.volume.toFixed(2) : null; out.target = +tgt.toFixed(2);
    // a split twin
    window._lxLastSting = null; game.monsters.length = 0;
    spawnMonster(player.x + 300, player.y - 40, 'zodiac_gemini', true, false); const tw = game.monsters[game.monsters.length - 1];
    tw._isTwin = true; tw.currentHp = 0; try { killMonster(tw); } catch (e) {}
    out.twin = window._lxLastSting && window._lxLastSting.kind; await sleep(300); try { closeAllModals(); } catch (e) {} game.paused = false;
    // Gravitos keeps his score; muted stays silent
    window._lxLastSting = null; if (typeof _lxVictorySting === 'function') _lxVictorySting({ type: 'gravitos' }); out.gravitos = window._lxLastSting && window._lxLastSting.kind;
    window._lxLastSting = null; audio.muted = true; if (typeof _lxDefeatSting === 'function') _lxDefeatSting(); out.muted = window._lxLastSting && window._lxLastSting.kind; audio.muted = false;
    // a death
    await sleep(2200); const mus2 = playing(); window._lxLastSting = null;
    player.hp = 0; try { triggerDeath(); } catch (e) { out.deathErr = e.message; }
    out.defeat = window._lxLastSting && window._lxLastSting.kind;
    await sleep(700); out.musicOnDeath = mus2 ? +mus2.volume.toFixed(3) : null;
    return out;
  });
  check(r.files.victory > 1.5 && r.files.victory < 7 && r.files.defeat > 1.5 && r.files.defeat < 7, 'both stings exist and decode (a few seconds each)', J(r.files));
  check(r.musicBefore > 0, '(the map music is playing before the fight)', J(r.musicBefore));
  check(r.victory === 'victory' && r.stingPlaying, 'a boss kill plays the victory sting', J({ kind: r.victory, playing: r.stingPlaying, err: r.killErr }));
  check(r.musicDuring !== null && r.musicDuring < 0.05, '...over the track, faded out under it', J(r.musicDuring));
  check(r.musicAfter !== null && r.musicAfter >= r.target * 0.8, '...and the track comes back once the sting is done', J({ after: r.musicAfter, target: r.target }));
  check(!r.twin, 'killing a split twin plays no sting', J(r.twin));
  check(!r.gravitos, 'Gravitos keeps his cinematic score (no sting)', J(r.gravitos));
  check(!r.muted, 'a muted game stays silent', J(r.muted));
  check(r.defeat === 'defeat' && r.musicOnDeath !== null && r.musicOnDeath < r.target * 0.35, 'a death plays the defeat sting into the quiet of the death screen', J({ kind: r.defeat, music: r.musicOnDeath, err: r.deathErr }));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
