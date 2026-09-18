// FINAL POLISH, SECOND PASS - BOSS CUES, THE TITLES MEDAL, THE INTRO CARDS (audit A3, R6, F5; per user "keep going to
// test and debug"). A boss's warnings, big calls and phase changes used the PLAYER's hit / crit pops, whose 85 ms limiter
// could swallow them: they have three cues of their own. The Titles medal was the one emoji the atlas lacks. After the
// prologue the intro cards opened under the Void's eye-zoom: they now wait for it.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/polish_cues_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11219';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
// static: what the boss code still borrows from the player (the game file under test, read as text)
const src = fs.readFileSync(cand ? path.resolve(SERVE_ROOT, cand) : path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const body = (head) => { const i = src.indexOf(head); const j = src.indexOf('\nfunction ', i + head.length); return i < 0 ? '' : src.slice(i, j); };
const borrowed = ['function bossAI(m, dt, distToPlayer) {', 'function _bossSpecialAttacks(m, dt) {', 'function _lxOctoMaybeLance(leg, proj) {']
  .map((h) => (body(h).match(/audio\.play\('(hit|crit)'\)/g) || []).length).reduce((a, b) => a + b, 0);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof bossAI === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    try { audio.muted = false; if (!audio.ctx && audio.init) audio.init(); if (audio.ctx && audio.ctx.resume) await audio.ctx.resume(); } catch (e) {}
    loadMap('forest', 300); await sleep(2000); try { closeAllModals(); } catch (e) {} game.paused = true;
    // a real warning: King Krook's stomp announcement
    const played = []; const _pl = audio.play.bind(audio); audio.play = (k) => { played.push(k); return _pl(k); };
    game.monsters.length = 0; spawnMonster(player.x + 260, player.y - 40, 'kingKrook', true, false); const m = game.monsters[game.monsters.length - 1];
    m._krookInit = true; m.patternState = 'stomp'; m.patternTimer = 0; m._kAnnounced = false;   // _krookInit: the first call would reset him to idle
    for (let i = 0; i < 4 && !m._kAnnounced; i++) bossAI(m, 16, 260);
    out.stomp = played.slice();
    // the cues sound even right after the player's own hit (the 85 ms limiter is not theirs), and each makes a sound
    const envs = []; const _env = audio.env.bind(audio); audio.env = function (...a) { envs.push(a[0]); return _env(...a); };
    audio.play = _pl;
    const sounds = (k) => { envs.length = 0; audio._lastPop = {}; if (audio._lastBossCue) audio._lastBossCue = {}; audio.play('hit'); const before = envs.length; audio.play(k); return envs.length - before; };
    out.warn = sounds('boss_warn'); out.alarm = sounds('boss_alarm'); out.phase = sounds('boss_phase');
    audio.env = _env;
    // F5 - a fresh hero finishes the prologue: the tour is started only once the Void's eye-zoom has cleared
    player._tutorialSeen = false;
    const vo = document.getElementById('void-intro-overlay'); const starts = []; const t0 = performance.now();
    const _stt = window.startTutorial; window.startTutorial = function () { starts.push({ t: Math.round(performance.now() - t0), zoomUp: vo.classList.contains('show') }); return _stt.apply(this, arguments); };
    window._prologueActive = true; game.paused = false; _prologueFinish(false); const zoomAtStart = vo.classList.contains('show');
    for (let w = 0; w < 9000 && !starts.length; w += 200) await sleep(200);
    window.startTutorial = _stt; out.f5 = { zoomAtStart, starts: starts.slice(0, 2) };
    return out;
  });
  check(borrowed === 0, 'the boss code no longer borrows the player\'s hit / crit pops', J(borrowed));
  check(r.stomp.includes('boss_warn') && !r.stomp.includes('hit'), 'King Krook\'s stomp announcement plays the boss warning', J(r.stomp));
  check(r.warn > 0 && r.alarm > 0 && r.phase > 0, 'each boss cue sounds, even right after one of your own hits', J({ warn: r.warn, alarm: r.alarm, phase: r.phase }));
  // R6 - every emoji the page shows must be in the atlas, or it draws the generic tile: the Titles medal was not
  const atlas = fs.readFileSync(path.join(SERVE_ROOT, 'data', 'emoji_atlas.js'), 'utf8');
  const cp = (e) => [...e].filter((c) => c !== '️').map((c) => c.codePointAt(0).toString(16)).join('-');
  const medal = (src.match(/<h2>(\S+) Titles<\/h2>/) || [])[1] || '';
  check(!src.includes('🎖') && medal && atlas.includes('"' + cp(medal) + '"'), 'the Titles button and header use a medal the emoji atlas has (not 🎖)', J({ medal, code: cp(medal) }));
  check(r.f5.zoomAtStart && r.f5.starts.length > 0 && r.f5.starts.every((x) => !x.zoomUp), 'after the prologue the tour starts once the Void eye-zoom has cleared, not under it', J(r.f5));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
