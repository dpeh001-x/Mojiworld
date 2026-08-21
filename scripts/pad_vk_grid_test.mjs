// The on-screen keyboard navigates as a grid: down goes DOWN.
// Per user: "The on screen keyboard is clunky, when i press down it does not
// go downwards it goes to the right."
// Run: node scripts/pad_vk_grid_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9208;
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

// synthetic pad + helpers
await page.evaluate(() => {
  window.__pad = { connected: true, index: 0, id: 'lx-test-pad', mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], timestamp: 0 };
  navigator.getGamepads = () => [window.__pad];
  window.dispatchEvent(new Event('gamepadconnected'));
  window.__press = (i, ms) => new Promise(done => {
    window.__pad.buttons[i].pressed = true; window.__pad.buttons[i].value = 1;
    setTimeout(() => { window.__pad.buttons[i].pressed = false; window.__pad.buttons[i].value = 0; setTimeout(done, 140); }, ms || 140);
  });
  window.__focusKey = () => {
    const el = document.querySelector('#pad-vk .pad-focus') || document.querySelector('.pad-focus');
    return el ? (el.textContent || '').trim() : null;
  };
});

// boot to menu, open the VK on the name field
let up = false;
for (let i = 0; i < 30 && !up; i++) { await page.waitForTimeout(1000);
  up = await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); return !!(lo && lo.classList.contains('menu-up')); }); }
ok('boot menu reached', up);
await page.evaluate(() => window.__press(13, 140));                    // prime pad activity (D-pad only)
await page.waitForTimeout(400);
const opened = await page.evaluate(async () => {
  const btn = document.getElementById('menu-newgame');
  if (btn) btn.click();
  await new Promise(r => setTimeout(r, 500));
  if (!document.getElementById('pad-vk') && window._lxPadVK) _lxPadVK.open(document.getElementById('auth-user'));
  return !!document.getElementById('pad-vk');
});
ok('virtual keyboard open', opened);
await page.waitForTimeout(400);                                        // one nav pass paints the ring

// ── the reported bug: DOWN must go DOWN ─────────────────────────────────────
const start = await page.evaluate(() => window.__focusKey());
await page.evaluate(() => window.__press(13, 140));                    // D-pad down
await page.waitForTimeout(250);
const afterDown = await page.evaluate(() => window.__focusKey());
ok('pressing down moves to the row below, not sideways',
   start === '1' ? afterDown === 'q' : afterDown !== null && afterDown !== start && !'1234567890'.includes(afterDown),
   `'${start}' -> down -> '${afterDown}' (expected the key beneath, e.g. 1->q)`);

// walk a column: three more downs should descend a row each time
const walk = [afterDown];
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => window.__press(13, 140));
  await page.waitForTimeout(250);
  walk.push(await page.evaluate(() => window.__focusKey()));
}
const rowOf = (k) => ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm-_.', '⇧␣⌫✕✓'].findIndex(r => k && r.includes(k));
const rowsVisited = walk.map(rowOf);
ok('four downs descend four rows (a straight column, one row per press)',
   rowsVisited.every((r, i) => r === rowsVisited[0] + i),
   `keys ${JSON.stringify(walk)} -> rows ${JSON.stringify(rowsVisited)}`);

// wrap: one more down from the bottom row returns to the number row
await page.evaluate(() => window.__press(13, 140));
await page.waitForTimeout(250);
const wrapped = await page.evaluate(() => window.__focusKey());
ok('down from the bottom row wraps to the top', rowOf(wrapped) === 0, `landed '${wrapped}'`);

// up reverses: one up goes back to the bottom row
await page.evaluate(() => window.__press(12, 140));
await page.waitForTimeout(250);
const backUp = await page.evaluate(() => window.__focusKey());
ok('up from the top row wraps back to the bottom', rowOf(backUp) === 4, `landed '${backUp}'`);

// left/right still walk within a row
await page.evaluate(() => window.__press(15, 140));
await page.waitForTimeout(250);
const right = await page.evaluate(() => window.__focusKey());
ok('right still moves along the row', rowOf(right) === 4 && right !== backUp, `'${backUp}' -> right -> '${right}'`);

// ── console shortcuts: X erases, Y spaces ───────────────────────────────────
const sc = await page.evaluate(async () => {
  _lxPadVK.buf = 'ab'; _lxPadVK.render();
  await window.__press(2, 140);                                        // X -> backspace
  const afterX = _lxPadVK.buf;
  await window.__press(3, 140);                                        // Y -> space
  return { afterX, afterY: _lxPadVK.buf };
});
ok('X erases the last character', sc.afterX === 'a', `buf 'ab' -> X -> '${sc.afterX}'`);
ok('Y types a space', sc.afterY === 'a ', `-> Y -> '${sc.afterY}'`);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
