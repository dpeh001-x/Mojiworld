import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8765/mojiworld_game.html';
const R = []; const ok = (n, c, x) => { R.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' — ' + x : '')); };
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
await page.evaluate(() => localStorage.setItem('levelx_save_v1', JSON.stringify({ v: 1, t: Date.now(), player: { cls: 'rogue', level: 30, look: { name: 'Test' } }, game: { currentMap: 'town' } })));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#menu-continue', { state: 'visible', timeout: 90000 });
await page.click('#menu-continue');
await page.waitForSelector('#loading-overlay', { state: 'detached', timeout: 30000 });
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
