// RELEASE 8 (per user: the phone boss bar, the advancement "Not yet", and five small items) stays fixed:
//   A the boss plate drops below the phone menu row (desktop unchanged)   B "Advance my class" from a captain has "Not yet"
//   C/E/F phone wording + taps (source)   D the title logo keeps its box   G a scene cut off by a reload plays again after Continue
//   node scripts/release8_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11981), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const bootIn = async (page) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
};
const setup = `try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  player._tutorialSeen = true; window._prologueAfterCreation = false;
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls) applyClass('warrior'); player._gravitosCineSeen = true; player.invulnerable = 1e12; player._god = true;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;`;
try {
  // ---- desktop
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await bootIn(page);
  const D = await page.evaluate(async (setup) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    eval(setup);
    out.d = { aspect: getComputedStyle(document.getElementById('lo-logo') || document.body).aspectRatio };
    out.a = { drop: _lxBossBarDrop() };
    // B
    player.level = 20; player.job = null; player.quests = player.quests || { active: {}, completed: {}, unlocked: {} }; player.quests.completed.q_inner_dim_trial = 1;
    game._advFromNpc = true; openAdvancement(); await sleep(400);
    const ny = document.querySelector('#advancement-options .adv-not-yet'); out.b = { notYet: !!ny, paused: !!game.paused };
    if (ny) ny.click(); await sleep(300);
    out.b.closed = (document.getElementById('advancement-modal') || {}).style.display === 'none'; out.b.after = !!game.paused;
    openAdvancement(); await sleep(400); out.b.gateNotYet = !!document.querySelector('#advancement-options .adv-not-yet');
    document.getElementById('advancement-modal').style.display = 'none'; game.paused = false;
    const src = [...document.scripts].map((x) => x.textContent).join('\n');
    out.cef = { c: src.includes("$('tut-body') ? $('tut-body') : pill).insertAdjacentElement('afterend', db);"),
      e: src.includes("if (typeof _lxIsTouchDevice === 'function' && _lxIsTouchDevice()) return;   // "),
      f1: src.includes("(_lxInputDevice === 'pad' || (typeof _lxIsTouchDevice === 'function' && _lxIsTouchDevice())) ? 'D-pad'"),
      f2: src.includes("gugumaLineTouch: 'Tweet! Tap Block right before it hits."), f3: src.includes('_LX_PROLOGUE_COACH_TOUCH') };
    // G - a scene opened and cut off by a reload
    delete player._storyBeatsSeen.first_zodiac_kill; _playStoryBeat('first_zodiac_kill'); await sleep(600);
    out.g = { open: player._lxBeatOpen, seen: !!player._storyBeatsSeen.first_zodiac_kill };
    if (typeof saveState === 'function') saveState(); await sleep(800);
    return out;
  }, setup);
  // reload mid-scene, Continue through the real menu
  await bootIn(page);
  await page.click('#menu-continue').catch(() => {});
  await page.waitForFunction(() => { const o = document.getElementById('loading-overlay'); return !o || o.classList.contains('fade') || getComputedStyle(o).display === 'none'; }, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const G2 = await page.evaluate(() => ({ overlay: !!(document.getElementById('story-beat-overlay') || {}).classList?.contains('on'), seen: !!(player._storyBeatsSeen || {}).first_zodiac_kill, open: player._lxBeatOpen || null }));
  // ---- phone (landscape deck)
  const mctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' });
  const mp = await mctx.newPage(); mp.on('pageerror', (e) => errs.push('phone: ' + String(e.message).slice(0, 120)));
  await bootIn(mp);
  const M = await mp.evaluate(async (setup) => { eval(setup); for (let i = 0; i < 3 && game.currentMap !== 'krookThrone'; i++) { loadMap('krookThrone', 300); await new Promise((r) => setTimeout(r, 1500)); } game.paused = false; for (let i = 0; i < 60 && document.body.classList.contains('cinematic'); i++) await new Promise((r) => setTimeout(r, 500)); await new Promise((r) => setTimeout(r, 800)); _LX_BB_DROP.t = 0; const vis = [...document.querySelectorAll('.mc-menu')].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().bottom)); return { landscape: document.body.classList.contains('mc-landscape'), drop: _lxBossBarDrop(), body: document.body.className.slice(0, 120), vis, deck: (document.getElementById('mobile-deck') || {}).className }; }, setup);
  ok('A. on a phone the boss plate drops below the menu row; on desktop it stays where it was', M.landscape && M.drop > 20 && D.a.drop === 0, { phone: M, desktop: D.a });
  ok('B. "Advance my class" from a captain offers "Not yet", which closes it and unpauses', D.b.notYet && D.b.paused && D.b.closed && !D.b.after, D.b);
  ok('B. ...the level-up gate itself stays mandatory (no "Not yet")', D.b.gateNotYet === false, D.b);
  ok('C/E/F. Details at the card foot on phones, no conversation switch on a stray tap, touch wording', Object.values(D.cef).every(Boolean), D.cef);
  ok('D. the title logo keeps its box before the image loads', /1254\s*\/\s*248/.test(D.d.aspect || ''), D.d);
  ok('G. a scene is remembered as open while it plays', D.g.open === 'first_zodiac_kill' && D.g.seen, D.g);
  ok('G. ...and after a reload and Continue it plays again', G2.overlay && G2.seen, G2);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
