// PAUSE MENU (final polish audit U4; per user "Work on all the above"). Esc with nothing open pauses behind a pause card
// (Resume / Settings / Hotkeys / Save slots / Return to title) and Esc again resumes; Esc with a panel open still closes
// the panel first; the card survives the stuck-pause watchdog; arrows walk it; Settings opens from it; the pad's Start
// opens it too.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/pause_menu_test.mjs [page.html] [--shot=<png>]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11205';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SHOT = (process.argv.find((a) => a.startsWith('--shot=')) || '').slice(7);
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof closeAllModals === 'function', null, { timeout: 120000 });
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 30; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(2500); try { closeAllModals(); } catch (e) {} game.paused = false; game.monsters.length = 0;
  });
  const st = () => page.evaluate(() => { const c = document.getElementById('lx-pause'); return { card: !!c, paused: !!game.paused, focus: document.activeElement && document.activeElement.textContent && document.activeElement.textContent.trim().slice(0, 24),
    buttons: c ? Array.from(c.querySelectorAll('button')).map((b) => b.textContent.trim().replace(/\s+/g, ' ')) : [], settings: document.getElementById('settings-modal-bg').classList.contains('on') }; });
  const esc = async () => { await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement !== document.body && document.activeElement.blur()); await page.keyboard.press('Escape'); await page.waitForTimeout(250); };
  await esc(); const a = await st();
  check(a.card && a.paused, 'Esc with nothing open pauses behind the pause card', J(a));
  check(['Resume', 'Settings', 'Hotkeys', 'Save slots', 'Return to title'].every((w) => a.buttons.some((b) => b.includes(w))), 'the card offers Resume, Settings, Hotkeys & Skills, Save slots and Return to title', J(a.buttons));
  if (SHOT) await page.screenshot({ path: SHOT });
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100); const f = await st();
  check(/Settings/.test(f.focus || ''), 'the arrow keys walk the card (Resume -> Settings)', J(f.focus));
  await page.waitForTimeout(4200); const w = await st();
  check(w.card && w.paused, 'the stuck-pause watchdog leaves it alone (still paused after 4 s)', J(w));
  await page.keyboard.press('Escape'); await page.waitForTimeout(250); const b = await st();
  check(!b.card && !b.paused, 'Esc again resumes', J(b));
  await esc(); await page.evaluate(() => { const x = Array.from(document.querySelectorAll('#lx-pause button')).find((y) => /Settings/.test(y.textContent)); if (x) x.click(); }); await page.waitForTimeout(300);
  const s = await st(); check(!s.card && s.settings && s.paused, 'Settings opens from the card (the card steps aside, the game stays paused)', J(s));
  await page.evaluate(() => closeAllModals()); await page.waitForTimeout(200);
  await page.evaluate(() => { if (typeof toggleAttributesPanel === 'function') toggleAttributesPanel(); else if (typeof _lxOpenUPanelTab === 'function') _lxOpenUPanelTab('lp'); }); await page.waitForTimeout(300);
  const u0 = await page.evaluate(() => !!game.paused);
  await esc(); const u = await st();
  check(u0 && !u.card, 'with a panel open, Esc closes the panel first (no pause card)', J({ panelPaused: u0, card: u.card }));
  const pad = await page.evaluate(async () => { closeAllModals(); game.paused = false; await new Promise((r) => setTimeout(r, 200)); try { _lxPadRootAt = -1; } catch (e) {} _lxPadDispatch('escape', true); _lxPadDispatch('escape', false); await new Promise((r) => setTimeout(r, 200)); return { card: !!document.getElementById('lx-pause'), settings: document.getElementById('settings-modal-bg').classList.contains('on') }; });
  check(pad.card && !pad.settings, 'the pad\'s Start opens the pause card too', J(pad));
  const t = await page.evaluate(async () => { const x = Array.from(document.querySelectorAll('#lx-pause button')).find((y) => /title/.test(y.textContent)); if (x) x.click(); await new Promise((r) => setTimeout(r, 300)); const m = document.getElementById('confirm-modal'); const up = !!(m && m.style.display && m.style.display !== 'none'); const body = (document.getElementById('confirm-title') || {}).textContent; if (up) document.getElementById('confirm-no').click(); return { up, body }; });
  check(t.up && /title/i.test(t.body || ''), '"Return to title" asks first', J(t));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
