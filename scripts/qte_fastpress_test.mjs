// SHACKLE QTE INPUT UNDER FAST PRESSING (v0.30.1706, per user: "check that the key pressing is sensitive (meaning that even fast
// pressing of the correct directions does not glitch and unlocks the player from the stun)" and "for those players that get it
// wrong, stun them for a little longer time"). Real keyboard events through the page, many random sequences per style:
//   1. a burst: every key of the sequence pressed and released back to back, all inside one frame
//   2. rolling: each next key goes down before the last one comes up (15 ms apart)
//   3. quick taps two frames apart; and a burst of a sequence that repeats a key (UP UP DOWN DOWN ...)
//   4. a stray arrow in the same burst right after the last correct key must not touch the finished lock (no fail sound,
//      no reset of the finished chips, no shake, still a PERFECT break)
//   each must break the lock as a PERFECT break, release the stun at once, and let the hero walk away
//   5. a wrong key holds you LONGER (it used to cut 0.3 s off the lock): +0.4 s each, 1.5 s in all over the whole lock (so
//      mashing wrong keys non-stop still ends by the lock's length + 1.5 s), the timer bar never over full; a lock left to
//      run out still releases the hero
//   node scripts/qte_fastpress_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11925), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const KEY = { arrowleft: 'ArrowLeft', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowright: 'ArrowRight' };
const ALL = Object.keys(KEY);
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  // the game reloads itself on a lost graphics context (a busy machine can drop it): name that instead of crashing mid-run
  const navs = []; let booted = false; page.on('framenavigated', (f) => { if (booted && f === page.mainFrame()) navs.push(f.url()); });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _qteShackleStart === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._tutorialSeen = true; player.invulnerable = 1e9; player._god = false;
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;   // no story card mid-trial
    await new Promise((r) => setTimeout(r, 2500));
    try { closeAllModals(); } catch (e) {}
    game.paused = false;
    // the game pauses itself when its window loses focus (it should: a lock must not drain while you are tabbed away), and
    // headless browsers run side by side steal focus from each other - which froze whole sections of this test mid-run
    try { window._lxAutoPause = () => {}; } catch (e) {}
    // wait in GAME FRAMES, not wall-clock ms: on a busy machine the renderer can go seconds without a frame, and the lock's
    // clock (rightly) only moves when the game does
    window.__fr = 0; (function tick() { window.__fr++; requestAnimationFrame(tick); })();
    window.__frames = async (n, capMs) => { const f0 = window.__fr, t0 = Date.now(); while (window.__fr - f0 < n && Date.now() - t0 < (capMs || 20000)) await new Promise((r) => setTimeout(r, 20)); };
    // a new hero is walked into the Void intro a few seconds after boot: dismiss it, start every trial in town, fade finished
    { const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show'); }
    window.__fading = () => { const f = document.getElementById('map-fade-overlay'); if (!f) return false; const cs = getComputedStyle(f); return cs.display !== 'none' && +cs.opacity > 0.05; };
    loadMap('town', 900); for (let i = 0; i < 60 && (window.__fading() || game.currentMap !== 'town'); i++) await new Promise((r) => setTimeout(r, 100));
    { const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show'); }
    window.__home = { map: game.currentMap, x: Math.round(player.x), y: Math.round(player.y) };   // every trial starts here, portals cleared (a freed hero's Up enters a portal)
    window.__qteLog = []; const oPlay = audio.play.bind(audio); audio.play = (n, ...a) => { window.__qteLog.push(n); return oPlay(n, ...a); };
  });
  booted = true;
  await page.mouse.click(640, 360);   // focus the page for real key events
  // start a lock with a chosen (or random) sequence; wait out the capture hit-stop
  const start = async (seq) => page.evaluate(async (seq) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 30 && _QTE.active; i++) await sleep(100);
    player.stunTimer = 0; player.frozenTimer = 0; player.hp = player.maxHp;
    if (game.currentMap !== window.__home.map) { loadMap(window.__home.map, window.__home.x); await sleep(1500); }
    for (let i = 0; i < 50 && window.__fading(); i++) await sleep(100);
    { const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show'); }
    if (game.mapData && game.mapData.portals) game.mapData.portals = [];
    player.x = window.__home.x; player.vx = 0; player.vy = 0;
    for (let i = 0; i < 20; i++) { try { closeAllModals(); } catch (e) {} game.paused = false; await sleep(60); if (!game.paused && !(typeof _anyOtherModalOpen === 'function' && _anyOtherModalOpen())) break; }
    const keys = ['arrowleft', 'arrowup', 'arrowdown', 'arrowright']; const rolls = seq ? seq.map((k) => (keys.indexOf(k) + 0.5) / 4) : null;
    let k = 0; const oR = Math.random; if (rolls) Math.random = () => (k < rolls.length ? rolls[k++] : oR());
    try { _qteShackleStart({ type: 'zodiac_scorpio', zodiacSign: 'scorpio', boss: true, superBoss: !!(seq && seq.length === 5) }); } finally { Math.random = oR; }
    await window.__frames(10);   // past the capture hit-stop
    window.__qteLog.length = 0; window.__qteBreaks = (game._qteStats && game._qteStats.breaks) || 0; window.__qteClean = (game._qteStats && game._qteStats.clean) || 0;
    return { seq: _QTE.seq.slice(), remain: _QTE.remain, total: _QTE.total };
  }, seq);
  const result = async () => page.evaluate(async () => {
    await window.__frames(14);
    const chips = [...document.querySelectorAll('#lx-qte .lxq-chip')];
    return { active: _QTE.active, stun: player.stunTimer | 0, breaks: ((game._qteStats && game._qteStats.breaks) || 0) - window.__qteBreaks,
      clean: ((game._qteStats && game._qteStats.clean) || 0) - window.__qteClean, mistakes: _QTE.mistakes || 0, fails: window.__qteLog.filter((n) => n === 'fail').length,
      allOk: chips.length > 0 && chips.every((c) => c.classList.contains('ok')), err: !!(_QTE.card && _QTE.card.classList.contains('err')),
      diag: { paused: !!game.paused, remain: Math.round(_QTE.remain), q: (_QTE.queue || []).length, idx: _QTE.idx, hitStop: game.hitStop | 0, frozen: player.frozenTimer | 0, photo: !!game._photoMode,
        modal: (typeof _anyOtherModalOpen === 'function') ? !!_anyOtherModalOpen() : null, map: game.currentMap, hp: player.hp | 0, x: Math.round(player.x),
        open: [...document.querySelectorAll('.modal, #dialog, [id$="-overlay"]')].filter((e) => e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden').map((e) => e.id || e.className).slice(0, 5) } };
  });
  const press = async (k) => { await page.keyboard.down(KEY[k]); await page.keyboard.up(KEY[k]); };
  const styles = {
    burst: async (seq) => { for (const k of seq) await press(k); },
    rolling: async (seq) => { for (let i = 0; i < seq.length; i++) { await page.keyboard.down(KEY[seq[i]]); await page.waitForTimeout(15); if (i > 0 && seq[i - 1] !== seq[i]) await page.keyboard.up(KEY[seq[i - 1]]); if (i > 0 && seq[i - 1] === seq[i]) { await page.keyboard.up(KEY[seq[i]]); await page.keyboard.down(KEY[seq[i]]); } } await page.keyboard.up(KEY[seq[seq.length - 1]]); },
    taps: async (seq) => { for (const k of seq) { await press(k); await page.waitForTimeout(34); } },
  };
  const rnd = (n, s) => { let x = s; const out = []; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; out.push(ALL[x % 4]); } return out; };
  // A trial the game paused (it auto-pauses when the window loses focus - headless browsers run side by side can steal it)
  // proves nothing about input: the lock rightly freezes. Re-run it, at most twice, and report how many were re-run.
  const T = {}; let rerun = 0;
  const trial = async (bucket, run) => {
    let r; for (let a = 0; a < 3; a++) { r = await run(); if (!r.diag.paused && !r.diag.modal) break; rerun++; }
    (T[bucket] = T[bucket] || []).push(r);
  };
  for (const [name, fn] of Object.entries(styles)) {
    T[name] = [];
    for (let t = 0; t < 8; t++) await trial(name, async () => { const st = await start(rnd(t % 2 ? 5 : 4, 7 + t * 31 + name.length)); await fn(st.seq); return { seq: st.seq.map((k) => k.slice(5, 6)).join(''), ...(await result()) }; });
  }
  for (const seq of [['arrowup', 'arrowup', 'arrowdown', 'arrowdown'], ['arrowleft', 'arrowleft', 'arrowleft', 'arrowright'], ['arrowright', 'arrowright', 'arrowright', 'arrowright', 'arrowright']]) {
    await trial('repeats', async () => { const st = await start(seq); await styles.burst(st.seq); return { seq: st.seq.map((k) => k.slice(5, 6)).join(''), ...(await result()) }; });
  }
  for (let t = 0; t < 6; t++) await trial('stray', async () => {
    const st = await start(rnd(4, 900 + t * 17)); const last = st.seq[st.seq.length - 1]; const extra = ALL.find((k) => k !== last);
    for (const k of st.seq) await press(k);
    await press(extra);   // in the same burst, after the lock is already broken
    return { seq: st.seq.map((k) => k.slice(5, 6)).join(''), extra: extra.slice(5, 6), ...(await result()) };
  });
  for (let t = 0; t < 6; t++) await trial('stray', async () => {   // ...and still HELD when the frame that breaks the lock runs
    const st = await start(rnd(4, 400 + t * 23)); const last = st.seq[st.seq.length - 1]; const extra = ALL.find((k) => k !== last);
    for (const k of st.seq) await press(k);
    await page.keyboard.down(KEY[extra]); const r = await result(); await page.keyboard.up(KEY[extra]);
    return { seq: st.seq.map((k) => k.slice(5, 6)).join(''), extra: extra.slice(5, 6) + ' held', ...r };
  });
  // the worst case, made certain: the whole sequence plus a HELD stray LEFT (the poll checks left first) in ONE task, so one frame
  for (const seq of [['arrowdown', 'arrowup', 'arrowright', 'arrowdown'], ['arrowup', 'arrowright', 'arrowup', 'arrowdown'], ['arrowright', 'arrowright', 'arrowdown', 'arrowup'], ['arrowdown', 'arrowdown', 'arrowdown', 'arrowright']]) {
    await trial('same', async () => {
      await start(seq);
      await page.evaluate(() => {
        const KEYS = { arrowleft: 'ArrowLeft', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowright: 'ArrowRight' };
        const fire = (type, k) => window.dispatchEvent(new KeyboardEvent(type, { key: KEYS[k], code: KEYS[k], bubbles: true }));
        for (const k of _QTE.seq) { fire('keydown', k); fire('keyup', k); }
        fire('keydown', 'arrowleft');
      });
      const r = await result();
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true })));
      return { seq: seq.map((k) => k.slice(5, 6)).join(''), extra: 'l held, same frame', ...r };
    });
  }
  console.log('trials re-run after a focus pause: ' + rerun);
  const good = (r) => !r.active && r.stun === 0 && r.breaks === 1 && r.clean === 1 && r.mistakes === 0 && r.fails === 0 && r.allOk && !r.err;
  ok('1. a burst (every key inside one frame) breaks the lock cleanly every time', T.burst.every(good), T.burst.filter((r) => !good(r)));
  ok('2. rolling presses (next key down before the last comes up) break it cleanly', T.rolling.every(good), T.rolling.filter((r) => !good(r)));
  ok('3. quick taps two frames apart break it cleanly', T.taps.every(good), T.taps.filter((r) => !good(r)));
  ok('3. a burst of a sequence that repeats keys breaks it cleanly', T.repeats.every(good), T.repeats);
  ok('4. a stray arrow after the last correct key leaves the finished lock alone (no fail sound, chips kept, still PERFECT)', T.stray.every(good), T.stray.filter((r) => !good(r)));
  ok('4. ...even held in the very frame that breaks the lock', T.same.every(good), T.same.filter((r) => !good(r)));
  // ...and the hero walks away
  const walk = await page.evaluate(async () => { const x0 = player.x; return x0; });
  await page.keyboard.down('ArrowRight'); await page.evaluate(async (x0) => { const t0 = Date.now(); while (player.x - x0 < 25 && Date.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 25)); }, walk); await page.keyboard.up('ArrowRight');
  const walked = await page.evaluate((x0) => player.x - x0, walk);
  ok('4. after a fast break the hero walks away at once', walked > 20, Math.round(walked));
  // 5. wrong keys hold you longer
  const st = await start(['arrowup', 'arrowup', 'arrowup', 'arrowup']);
  // read once the press has registered (under load a frame can lag the key event); what the key ADDED is exact, the clock is not
  const settle = (n) => page.evaluate(async (n) => { { const t0 = Date.now(); while ((_QTE.mistakes || 0) < n && Date.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 25)); await window.__frames(2); } return { remain: _QTE.remain, total: _QTE.total, extra: _QTE.extra, w: parseFloat(_QTE.fill.style.width), mistakes: _QTE.mistakes, idx: _QTE.idx, stun: player.stunTimer | 0 }; }, n);
  await press('arrowdown');
  const W1 = await settle(1);
  for (let i = 0; i < 7; i++) { await press('arrowdown'); await page.waitForTimeout(40); }
  const W2 = await settle(8);
  ok('5. a wrong key adds 0.4 s to the lock (it used to take 0.3 s away) and sends you back to the first arrow', W1.mistakes === 1 && W1.extra === 400 && W1.idx === 0, W1);
  ok('5. ...capped: eight wrong keys add 1.5 s in all, and the stun follows the lock', W2.mistakes === 8 && W2.extra === 1500 && W2.remain <= st.total + 1500 && Math.abs(W2.stun - W2.remain) < 40, W2);
  ok('5. ...the timer bar never goes over full', W1.w <= 100 && W2.w <= 100, { w1: W1.w, w2: W2.w });
  const R = await page.evaluate(async () => { const t0 = performance.now(); for (let i = 0; i < 600 && _QTE.active; i++) await new Promise((r) => setTimeout(r, 50)); return { active: _QTE.active, stun: player.stunTimer | 0, ms: Math.round(performance.now() - t0) }; });
  ok('5. a lock left to run out still releases the hero', !R.active && R.stun === 0, R);
  // the cap is on what wrong keys ADD over the whole lock: mashing wrong keys non-stop cannot hold a player past 3 s + 1.5 s
  const st2 = await start(['arrowup', 'arrowup', 'arrowup', 'arrowup']);
  const t0 = Date.now(); let presses = 0;
  while (Date.now() - t0 < 30000) {
    const live = await page.evaluate(() => _QTE.active); if (!live) break;
    await press('arrowdown'); presses++; await page.waitForTimeout(70);
  }
  const M = await page.evaluate(() => ({ active: _QTE.active, stun: player.stunTimer | 0, extra: _QTE.extra }));
  const held = Date.now() - t0 + 350;   // + the wait inside start()
  ok('5. mashing wrong keys non-stop adds 1.5 s at most (the game-time length of the lock is its own + what was added), then the stun ends', !M.active && M.stun === 0 && M.extra === 1500 && presses > 20 && held < 30000, { heldMs: held, presses, extra: M.extra, gameMsMax: st2.total + M.extra });
  ok('6. no page errors', errs.length === 0, errs);
} catch (e) {
  if (!navs.length) throw e;
  ok('the page stayed put (the game reloaded itself mid-run - a lost graphics context on a busy machine; re-run)', false, navs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
