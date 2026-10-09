import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
// PORT from the command line or the environment; with none given (or nothing listening there) this script starts the
// checkout's own serve.js on it - it used to need a hand-started server on a fixed port and failed without one.
let PORT = String('' || process.env.PORT || '');
{
  const { spawn: _sSpawn } = await import('node:child_process'); const _sNet = await import('node:net');
  const _sPath = await import('node:path'); const { fileURLToPath: _sF2P } = await import('node:url');
  const _sRoot = _sPath.resolve(_sPath.dirname(_sF2P(import.meta.url)), '..');
  const _sFree = (p) => new Promise((r) => { const sv = _sNet.createServer(); sv.once('error', () => r(false)); sv.once('listening', () => sv.close(() => r(true))); sv.listen(p, '127.0.0.1'); });
  if (!PORT) for (let p = 8767; p <= 8999 && !PORT; p++) if (await _sFree(p)) PORT = String(p);
  if (await _sFree(Number(PORT))) {
    const _srv = _sSpawn(process.execPath, [_sPath.join(_sRoot, 'serve.js'), PORT], { stdio: 'ignore', cwd: _sRoot });
    _srv.unref(); process.on('exit', () => { try { _srv.kill(); } catch (e) {} });
    await new Promise((r) => setTimeout(r, 1500));
  }
}
const URL = `http://localhost:${PORT}/${process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html'}`;
const R = []; const ok = (n, c, x) => { R.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' — ' + x : '')); };
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
// fb8a6edb1 v0.30.1480 save anti-cheat: an unsigned hand-made save is refused (rolled back), so Continue no longer loads
// a rogue Lv 30. Start a fresh session in page and set the same character directly instead.
await page.evaluate(async () => {
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  try { if (window._lxBootHold) window._lxBootHold.release('menu'); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
  applyClass('rogue'); player.level = 30; player.look = Object.assign(player.look || {}, { name: 'Test' });
  loadMap('town'); await new Promise((r) => setTimeout(r, 1500));
  try { closeAllModals(); } catch (e) {} game.paused = false;
});
await page.waitForTimeout(800);

// --- Fix 1: sim runs at ~60 Hz (not halted / not doubled) at the headless 60Hz ---
const t0 = await page.evaluate(() => game.time);
await page.waitForTimeout(1000);
const t1 = await page.evaluate(() => game.time);
const fps = t1 - t0;
// Headless Chromium throttles rAF (no display surface), so the absolute rate
// is unreliable here — the correctness of the 60Hz cap is proven by the pure
// timestamp unit test (144/240Hz -> ~60 steps/sec). In-game we only assert the
// sim PROGRESSES and is never ABOVE the 60Hz cap (i.e. not fast-forwarding).
ok('sim progresses and never exceeds the 60Hz cap', fps > 0 && fps <= 66, fps + '/s');

// player physics still integrates (move right)
const px0 = await page.evaluate(() => Math.round(player.x));
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(450); await page.keyboard.up('ArrowRight');
const px1 = await page.evaluate(() => Math.round(player.x));
ok('player still moves (physics intact)', px1 !== px0, `x ${px0} -> ${px1}`);

// --- Fix 2: confirm dialog appears ABOVE an open modal and is clickable ---
const stack = await page.evaluate(() => {
  const adv = document.getElementById('advancement-modal');
  const cm = document.getElementById('confirm-modal');
  adv.style.display = 'flex';                                   // simulate the talent screen being open
  cm.style.display = 'flex';                                    // simulate uiConfirm opening the confirm
  const zAdv = +getComputedStyle(adv).zIndex || 0;
  const zCm = +getComputedStyle(cm).zIndex || 0;
  // what actually receives a click at viewport centre?
  const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  const inConfirm = !!(el && el.closest && el.closest('#confirm-modal'));
  return { zAdv, zCm, inConfirm };
});
ok('confirm z-index above advancement modal', stack.zCm > stack.zAdv, `confirm=${stack.zCm} adv=${stack.zAdv}`);
ok('centre click lands inside the confirm dialog (not behind it)', stack.inConfirm);

ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
const fails = R.filter(x => !x).length;
console.log(`\n${R.length - fails}/${R.length} checks passed`);
process.exit(fails ? 1 : 0);
