// Guguma's chip at the level cap opens at full size, and the browser's ResizeObserver notice never reaches a player as a
// crash (players at Lv 100 saw "Something went wrong, but the game kept running" with no fault behind it). Until v0.30.1454
// the chip docked by left/top with right:auto, so the width-less fixed box shrank to the room left of it: the card opened
// from the docked pill laid out 166 px wide, then crept 12 px a frame to full size for ~30 frames - each step a
// ResizeObserver loop notice inside the dock's own callback - and the first notice raised the crash toast.
//   1. desktop 1280x720, the locked card players see: full width on its first frame, no notice, no crash toast
//   2. the same with the lock opened (the real offer, a bigger card); folded and reopened, the same again
//   3. a landscape phone with the touch deck: the card is fitted and placed on screen, no notice, no toast
//   4. the notice itself (an error event with no error object) is one [layout] console line, not a crash note or toast
//   5. a real error still raises the crash toast, and a thrown Error carrying the notice's words still counts as an error
//   6. no page errors besides the two thrown on purpose in 5
//   node scripts/guguma_chip_ro_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11893), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 320) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const PROBE_A = 'probe: a real error in a timer', RO_WORDS = 'ResizeObserver loop completed with undelivered notifications.';
const boot = async (opts) => {
  const page = await (await browser.newContext({ serviceWorkers: 'block', ...opts })).newPage();
  page._errs = []; page._console = [];
  page.on('pageerror', (e) => page._errs.push(String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') page._console.push(m.type() + ': ' + m.text().slice(0, 200)); });
  await page.addInitScript(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    window.__roN = 0; window.addEventListener('error', (ev) => { if (ev && /ResizeObserver loop/.test(ev.message || '') && !ev.error) window.__roN++; }, true);
  });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _gugumaAscendChip === 'function' && typeof _gugumaAscendPrompt === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    game.paused = false; window._god = true; player.invulnerable = 1e9; loadMap('town');
    window.__toasts = []; const st = showToast; window.showToast = function (t) { window.__toasts.push(String(t)); return st.apply(this, arguments); };
    await new Promise((r) => setTimeout(r, 2000));
  });
  return page;
};
// dock the pill at the cap, open it, and watch the card frame by frame
const openCard = (page, locked) => page.evaluate(async (locked) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  LX_ASCENSION_LOCKED = locked; player.level = PRESTIGE_LEVEL; game._prestigeOffered = false;
  _gugumaAscendChip(false); _gugumaAscendPrompt(true); await sleep(900);
  window.__roN = 0; const t0 = window.__toasts.length;
  const pill = document.getElementById('guguma-ascend-pill'); if (!pill) return { pill: false };
  pill.click(); const widths = [];
  for (let i = 0; i < 45; i++) { await frame(); const el = document.getElementById('guguma-ascend'); if (el) widths.push(Math.round(el.getBoundingClientRect().width)); }
  await sleep(300);
  const el = document.getElementById('guguma-ascend'), r = el.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  const out = { pill: true, widths: [...new Set(widths)].slice(0, 8), distinct: new Set(widths).size, notices: window.__roN, crash: window.__toasts.slice(t0).filter((t) => /Something went wrong/.test(t)).length,
    card: !!el.querySelector('.guguma-tutorial'), onScreen: r.left >= 0 && r.top >= 0 && r.right <= W + 1 && r.bottom <= H + 1, shown: getComputedStyle(el).visibility !== 'hidden', rect: [r.left, r.top, r.width, r.height].map(Math.round) };
  LX_ASCENSION_LOCKED = true;
  return out; }, locked);
const clean = (c) => c.pill && c.card && c.notices === 0 && c.crash === 0 && c.onScreen && c.shown;
try {
  // ---- 1-2 ----
  const D = await boot({ viewport: { width: 1280, height: 720 } });
  const d1 = await openCard(D, true);
  ok('1. desktop, the locked card players see: full width on its first frame, no ResizeObserver notice, no crash toast', clean(d1) && d1.distinct === 1, d1);
  const d2 = await openCard(D, false);
  ok('2. desktop, the real offer (lock opened for this check): full width at once, no notice, no toast', clean(d2) && d2.distinct === 1, d2);
  const d3 = await openCard(D, true);
  ok('2. folded and opened again: still full width at once, no notice, no toast', clean(d3) && d3.distinct === 1, d3);
  // ---- 4-5 (desktop page) ----
  const n4 = await D.evaluate(async () => { const t0 = window.__toasts.length;
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' })); await new Promise((r) => setTimeout(r, 200));
    return { crash: window.__toasts.slice(t0).filter((t) => /Something went wrong/.test(t)).length }; });
  const layoutNote = D._console.some((l) => /^warning: \[layout\] v[0-9.]+ ResizeObserver loop/.test(l)), crashNote = D._console.some((l) => /^error: \[error\] v[0-9.]+ ResizeObserver loop/.test(l));
  ok('4. the notice itself (no error object) is a [layout] console line - no crash note, no toast', n4.crash === 0 && layoutNote && !crashNote, { ...n4, layoutNote, crashNote });
  const r5 = await D.evaluate(async ({ a, w }) => { const t0 = window.__toasts.length;
    setTimeout(() => { throw new Error(a); }, 0); await new Promise((r) => setTimeout(r, 300));
    const toast = window.__toasts.slice(t0).some((t) => /Something went wrong/.test(t));
    setTimeout(() => { throw new Error(w); }, 0); await new Promise((r) => setTimeout(r, 300));
    return { toast }; }, { a: PROBE_A, w: RO_WORDS });
  // (a thrown Error reaches the handler as "Uncaught Error: <message>"; the bare notice has no prefix)
  const noteA = D._console.some((l) => l.includes('[error]') && l.includes(PROBE_A)), noteW = D._console.some((l) => /^error: \[error\] v[0-9.]+ Uncaught Error: ResizeObserver loop completed/.test(l));
  ok('5. a real error still raises the crash toast and note, and a thrown Error carrying the notice\'s words still counts', r5.toast && noteA && noteW, { ...r5, noteA, noteW });
  // ---- 3 ----
  const P = await boot({ viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p1 = await openCard(P, true);
  ok('3. a landscape phone with the touch deck: the card is fitted and placed on screen, no notice, no toast', clean(p1), p1);
  // ---- 6 ----
  const errs = [...D._errs, ...P._errs].filter((e) => !e.includes(PROBE_A) && !e.includes('ResizeObserver loop completed'));
  ok('6. no page errors (besides the two thrown on purpose in 5)', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log((fail ? 'FAIL(' + fail + ')' : 'PASS(0)') + ' - ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
