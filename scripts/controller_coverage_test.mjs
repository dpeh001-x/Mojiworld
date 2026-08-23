// PARTIAL CONTROLLER SUPPORT — is EVERY gameplay function reachable?
// ============================================================================
// Steam's wording was specific: "The user is not able to access all of the
// gameplay functions using the controller." That is a coverage claim, so this
// is a coverage test rather than a behaviour test.
//
// It presses every button the pad has -- alone, and again with the modifier
// held -- plus both stick axes, and records which game key each one dispatches.
// The result is the complete set of gameplay functions a controller can reach.
// Anything in the required set that is missing from that map is a function a
// controller player cannot perform, which is exactly the failure.
//
// The required set is not hand-written: the skill slots come from the game's
// own KEY_TO_SLOT and the actions from ACTION_KEY_DEFAULT, so a slot added
// later shows up here as a gap instead of being silently uncovered.
// Run: node scripts/controller_coverage_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9897);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'PadCov');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  for (let i = 0; i < 12; i++) { const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); if (!r) break; r.style.display = 'none'; }

  const dispatched = [];
  const origDispatch = window._lxPadDispatch;
  window._lxPadDispatch = function (key, down) { if (down) dispatched.push(String(key).toLowerCase()); };
  const origGet = navigator.getGamepads.bind(navigator);

  const NB = 17;
  const pad = { index: 30, id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', mapping: 'standard',
                connected: true, axes: [0, 0, 0, 0],
                buttons: Array.from({ length: NB }, () => ({ pressed: false, value: 0 })) };
  navigator.getGamepads = () => [pad];
  try { window.dispatchEvent(new Event('gamepadconnected')); } catch (e) {}

  const setBtns = (down) => { for (let i = 0; i < NB; i++) { pad.buttons[i].pressed = down.includes(i); pad.buttons[i].value = down.includes(i) ? 1 : 0; } };
  const release = () => { setBtns([]); pad.axes[0] = 0; pad.axes[1] = 0; for (let i = 0; i < 4; i++) _lxPadPoll(); };
  // Press a combination and report what it dispatched. Release first so the
  // edge detector actually sees a new press.
  const press = (down, polls) => {
    release();
    dispatched.length = 0;
    setBtns(down);
    for (let i = 0; i < (polls || 3); i++) _lxPadPoll();
    const got = dispatched.slice();
    release();
    return got;
  };

  const MOD = (typeof _LX_PAD_MOD !== 'undefined') ? _LX_PAD_MOD : -1;
  const reach = {};                      // key -> how you press it
  const note = (keys, how) => { for (const k of keys) if (!reach[k]) reach[k] = how; };

  // every button alone
  for (let i = 0; i < NB; i++) note(press([i]), 'button ' + i);
  // every button with the modifier held
  if (MOD >= 0) for (let i = 0; i < NB; i++) { if (i === MOD) continue; note(press([MOD, i]), 'MOD+' + i); }
  // the modifier tapped on its own: press, then release, and keep polling so
  // the queued tap lands
  if (MOD >= 0) {
    release(); dispatched.length = 0;
    setBtns([MOD]); for (let i = 0; i < 3; i++) _lxPadPoll();
    setBtns([]);    for (let i = 0; i < 4; i++) _lxPadPoll();
    note(dispatched.slice(), 'MOD tapped');
  }
  // both stick axes, in both directions (deflect after a settle so the
  // stuck-axis guard trusts them)
  for (const [ax, sign, how] of [[0, -1, 'stick left'], [0, 1, 'stick right'], [1, -1, 'stick up'], [1, 1, 'stick down']]) {
    release();
    pad.axes[ax] = sign * 0.2; _lxPadPoll(); pad.axes[ax] = 0; _lxPadPoll();
    dispatched.length = 0;
    pad.axes[ax] = sign; for (let i = 0; i < 3; i++) _lxPadPoll();
    note(dispatched.slice(), how);
    release();
  }

  // ---- what SHOULD be reachable, read from the game's own tables ----------
  const need = {};
  try { for (const k in KEY_TO_SLOT) need[String(k).toLowerCase()] = 'skill slot "' + KEY_TO_SLOT[k] + '"'; } catch (e) {}
  const ACTIONS = ['jump', 'dodge', 'block', 'talkNpc', 'hpPotion', 'mpPotion', 'attributesU', 'escape',
                   'moveLeft', 'moveRight', 'moveUp', 'moveDown'];
  for (const a of ACTIONS) {
    try { const k = _lxPadResolveKey({ a }); if (k) need[String(k).toLowerCase()] = a; } catch (e) {}
  }

  window._lxPadDispatch = origDispatch;
  navigator.getGamepads = origGet;
  const missing = Object.keys(need).filter(k => !reach[k]).map(k => `${need[k]} (key "${k}")`);
  return { reach, need, missing, mod: MOD, reachCount: Object.keys(reach).length, needCount: Object.keys(need).length };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 300) });

console.log('  reachable from the pad (' + R.reachCount + '):');
for (const k of Object.keys(R.reach).sort()) console.log(`    ${JSON.stringify(k).padEnd(14)} <- ${R.reach[k]}`);
console.log('  required gameplay functions: ' + R.needCount);

ok('a modifier layer exists', R.mod >= 0, 'modifier button index: ' + R.mod);
ok('EVERY gameplay function is reachable with the controller', (R.missing || []).length === 0,
   (R.missing || []).length ? 'UNREACHABLE: ' + R.missing.join(' | ') : 'all ' + R.needCount + ' reachable');
// Name the five that were missing before, individually, so a regression in any
// one of them is legible rather than hidden inside a single coverage number.
for (const [k, what] of [['c', 'skill 4'], ['d', 'skill 5'], ['g', 'MASTER SIGNATURE'], ['b', 'MASTER ULTIMATE']]) {
  ok(`${what} (key "${k}") can be cast from the pad`, !!R.reach[k], R.reach[k] || 'UNREACHABLE');
}
{
  const dodgeKey = Object.keys(R.need).find(k => R.need[k] === 'dodge');
  ok('dodge can be performed from the pad', !!(dodgeKey && R.reach[dodgeKey]),
     dodgeKey ? (R.reach[dodgeKey] || 'UNREACHABLE') : 'no dodge bind');
}
{
  const panel = Object.keys(R.need).find(k => R.need[k] === 'attributesU');
  ok('tapping the modifier alone still opens the character panel',
     !!(panel && R.reach[panel]), panel ? (R.reach[panel] || 'UNREACHABLE') : 'n/a');
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
