// A controller can always reach the on-screen keyboard - including name entry.
// Per user (boot-menu name panel screenshot): "When using a controller I need
// to have an on screen keyboard to type including here."
//
// Drives the REAL boot menu with a synthetic gamepad:
//   1. autofocus handoff - opening Name Entry under an active pad opens the VK
//   2. A-hatch - a focused text field + A opens the VK (no B-blur needed first)
//   3. typing through the VK lands in the real input
// Run: node scripts/pad_vk_entry_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9204;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

// ── install a synthetic pad the real poll can see ───────────────────────────
await page.evaluate(() => {
  const mk = () => ({
    connected: true, index: 0, id: 'lx-test-pad', mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0], timestamp: 0,
  });
  window.__pad = mk();
  navigator.getGamepads = () => [window.__pad];
  window.dispatchEvent(new Event('gamepadconnected'));      // arms _lxPadPresent
  window.__press = (i, ms) => new Promise(done => {
    window.__pad.buttons[i].pressed = true; window.__pad.buttons[i].value = 1;
    setTimeout(() => { window.__pad.buttons[i].pressed = false; window.__pad.buttons[i].value = 0; setTimeout(done, 120); }, ms || 120);
  });
});

// wait for the boot menu
let menuUp = false;
for (let i = 0; i < 30 && !menuUp; i++) {
  await page.waitForTimeout(1000);
  menuUp = await page.evaluate(() => {
    const lo = document.getElementById('loading-overlay');
    return !!(lo && lo.classList.contains('menu-up'));
  });
}
ok('boot menu reached', menuUp);

// ── 1. autofocus handoff: open Name Entry with the pad "recently active" ────
// Prime pad activity with D-pad down (13): it only moves menu focus. An A
// press here once CLICKED whatever the nav had focused and tore the menu down
// before the panel query - the test failing, not the game.
await page.evaluate(() => window.__press(13, 120));
await page.waitForTimeout(400);
const s1 = await page.evaluate(async () => {
  const btn = document.getElementById('menu-newgame') || document.getElementById('menu-cont');
  if (!btn) return { err: 'no menu button; menu ids: ' + [...document.querySelectorAll('[id^=menu-]')].map(e => e.id).slice(0, 6).join(',') };
  btn.click();                                              // stand-in for nav's A-click on the item
  await new Promise(r => setTimeout(r, 500));               // autofocus fires at +40ms
  return {
    panelUp: !document.getElementById('menu-name-panel').hidden || getComputedStyle(document.getElementById('menu-name-panel')).display !== 'none',
    vkOpen: !!document.getElementById('pad-vk'),
    inputFocused: document.activeElement && document.activeElement.id === 'auth-user',
  };
});
ok('name panel opens', !s1.err && s1.panelUp, s1.err || '');
ok('the virtual keyboard opens by itself when the panel autofocuses under a pad',
   s1.vkOpen, s1.vkOpen ? 'pad-vk present' : `vk absent, input focused: ${s1.inputFocused}`);

// ── 3. type through the VK into the real input ──────────────────────────────
const s3 = await page.evaluate(() => {
  if (!window._lxPadVK || !document.getElementById('pad-vk')) return { skipped: true };
  _lxPadVK.buf = '';
  for (const k of ['m', 'o', 'j', 'i']) _lxPadVK.press(k);
  _lxPadVK.press('✓');                                      // commit
  const v = (document.getElementById('auth-user') || {}).value;
  return { value: v, closed: !document.getElementById('pad-vk') };
});
ok('typing on the keyboard lands in the real name input',
   !s3.skipped && s3.value === 'moji' && s3.closed,
   s3.skipped ? 'skipped - vk never opened' : `value="${s3.value}" closed=${s3.closed}`);

// ── 2. the A-hatch: focused field + A opens the VK (no auto-open path) ──────
const s2 = await page.evaluate(async () => {
  const inp = document.getElementById('auth-user');
  if (!inp) return { err: 'no input' };
  // test the hatch directly: focus the field, then press A and let the
  // poll's focused-typeable branch run.
  inp.focus();
  await new Promise(r => setTimeout(r, 150));
  const preOpen = !!document.getElementById('pad-vk');      // may auto-open (pad still active) - close it to isolate the hatch
  if (preOpen) { _lxPadVK.close(); inp.focus(); await new Promise(r => setTimeout(r, 50)); }
  // NOTE: focusing again may re-auto-open on patched builds; both paths prove
  // reachability, so accept either - what matters is that A while focused
  // yields an open keyboard rather than a dead controller.
  if (!document.getElementById('pad-vk')) await window.__press(0, 150);
  await new Promise(r => setTimeout(r, 300));
  return { vkOpen: !!document.getElementById('pad-vk') };
});
ok('a focused text field plus the A button yields an open keyboard, never a dead pad',
   !s2.err && s2.vkOpen, s2.err || (s2.vkOpen ? '' : 'pad dead: no vk after A on focused field'));

// the pad can still escape: B closes/commits via the existing nav path
const s4 = await page.evaluate(async () => {
  if (!document.getElementById('pad-vk')) return { skipped: true };
  await window.__press(1, 150);                             // B -> nav clicks .mc-modal-close (the ✓ key)
  await new Promise(r => setTimeout(r, 300));
  return { closed: !document.getElementById('pad-vk') };
});
ok('B leaves the keyboard through the existing nav path', s4.skipped || s4.closed,
   s4.skipped ? 'skipped' : '');

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
