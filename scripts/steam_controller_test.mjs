// STEAM CONTROLLER REVIEW FIX — gamepad layer, proven with injected devices.
// ============================================================================
// Steam rejected the build twice over on controllers:
//   "the camera automates down and to the right throughout the whole gameplay"
//   "Dual Shock and Dual Sense controllers have no functionality"
//
// Neither can be reproduced here -- there is no pad on this machine and no
// Steam client -- so this does the next best thing and INJECTS the devices.
// navigator.getGamepads is replaced with fixtures that reproduce the exact
// shapes a browser hands you for an Xbox pad, for a Sony pad that Chromium did
// NOT standard-map, and for a device with a pinned axis. The real _lxPadPoll
// then runs against them and the keys it dispatches are recorded.
//
// What that can and cannot show is worth being exact about: it proves the input
// layer handles every documented layout and refuses to walk the player on a
// dead axis. It does NOT prove what Steam's reviewer had plugged in. The
// Steam-side half (action set activation) is covered by steam_input_test.mjs.
// Run: node scripts/steam_controller_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9891);
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
await page.fill('#hero-name-input', 'PadTest');
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
  const out = {};
  const has = (n) => typeof window[n] === 'function';
  out.helpers = ['_lxPadPick', '_lxPadAxis', '_lxPadBtn', '_lxPadHat', '_lxPadProfile'].filter(n => !has(n));

  // ---- fixture builders --------------------------------------------------
  const btns = (n, downIdx) => Array.from({ length: n }, (_, i) => ({ pressed: downIdx.includes(i), value: downIdx.includes(i) ? 1 : 0, touched: false }));
  const xbox = (axes, downIdx = []) => ({
    index: 0, id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', mapping: 'standard',
    connected: true, axes, buttons: btns(17, downIdx), timestamp: 1,
  });
  // The shape Chromium hands you for a DualShock 4 / DualSense it did NOT
  // standard-map: 14 buttons in Sony order, no D-pad buttons at all, and the
  // D-pad as a hat on axes[9] whose RESTING value is 3.2857 -- out of [-1,1].
  const sony = (axes, downIdx = [], idx = 1) => ({
    index: idx, id: 'Wireless Controller (Vendor: 054c Product: 0ce6)', mapping: '',
    connected: true, axes, buttons: btns(14, downIdx), timestamp: 1,
  });
  const SONY_REST = [0, 0, 0, -1, -1, 0, 0, 0, 0, 3.2857];

  // ---- unit level: the helpers -------------------------------------------
  out.pick = {};
  try {
    const s = sony([...SONY_REST]), x = xbox([0, 0, 0, 0]);
    out.pick.prefersStandard = _lxPadPick([s, x]) === x;         // order deliberately puts junk first
    out.pick.fallsBackToSony = _lxPadPick([s]) === s;
    out.pick.ignoresButtonless = _lxPadPick([{ index: 3, connected: true, id: 'ghost', mapping: '', axes: [1, 1], buttons: [] }]) === null;
  } catch (e) { out.pickErr = String(e).slice(0, 90); }
  try { out.hat = {
    restIsCentre: JSON.stringify(_lxPadHat(3.2857)) === JSON.stringify({ 12: false, 13: false, 14: false, 15: false }),
    up: _lxPadHat(-1)[12] === true,
    right: _lxPadHat(-0.4286)[15] === true,
    down: _lxPadHat(0.1429)[13] === true,
    left: _lxPadHat(0.7143)[14] === true,
  }; } catch (e) { out.hat = null; out.hatErr = String(e).slice(0, 90); }
  out.sonyFace = {};
  try {
    // Cross sits at index 1 on this layout. Standard index 0 (A / jump) must
    // resolve to it, and standard 0 must NOT read the device's own index 0
    // (square), or every Sony pad plays the wrong action for every button.
    const crossDown = sony([...SONY_REST], [1]);
    out.sonyFace.crossIsStandardA = _lxPadBtn(crossDown, 0) === true;
    out.sonyFace.squareIsNotA = _lxPadBtn(sony([...SONY_REST], [0]), 0) === false;
    out.sonyFace.squareIsStandardX = _lxPadBtn(sony([...SONY_REST], [0]), 2) === true;
    out.sonyFace.hatRightIsDpadRight = _lxPadBtn(sony([0,0,0,-1,-1,0,0,0,0,-0.4286]), 15) === true;
    out.sonyFace.restHatNoDpad = [12,13,14,15].every(i => _lxPadBtn(sony([...SONY_REST]), i) === false);
  } catch (e) { out.sonyErr = String(e).slice(0, 90); }
  // ---- the drift guard ---------------------------------------------------
  out.stuck = {};
  try {
    const p = xbox([1.0, 1.0, 0, 0]); p.index = 7;             // pinned hard right+down forever
    let moved = false;
    for (let i = 0; i < 40; i++) if (_lxPadAxis(p, 'x') !== 0 || _lxPadAxis(p, 'y') !== 0) moved = true;
    out.stuck.pinnedAxisIgnored = !moved;
    // ...but a real stick that actually moves is trusted from then on.
    const q = xbox([1.0, 0, 0, 0]); q.index = 8;
    _lxPadAxis(q, 'x');                                         // first sample: 1.0
    q.axes[0] = 0; _lxPadAxis(q, 'x');                          // released -> range appears
    q.axes[0] = 1.0;
    out.stuck.realStickTrusted = _lxPadAxis(q, 'x') === 1.0;
  } catch (e) { out.stuckErr = String(e).slice(0, 90); }

  // ---- integration: run the REAL poll against injected devices -----------
  const dispatched = [];
  const origDispatch = window._lxPadDispatch;
  window._lxPadDispatch = function (key, down) { if (down) dispatched.push(key); };
  const origGet = navigator.getGamepads.bind(navigator);
  // _lxPadPoll early-outs on `let _lxPadPresent`, which is script-scoped and so
  // cannot be set from here -- and its self-healing re-probe only runs once
  // every 2s, which a tight test loop never reaches. The connect EVENT is the
  // supported way in, and firing it is also what a real pad does.
  const runPoll = (list, times) => {
    navigator.getGamepads = () => list;
    try { window.dispatchEvent(new Event('gamepadconnected')); } catch (e) {}
    dispatched.length = 0;
    for (let i = 0; i < (times || 4); i++) _lxPadPoll();
    return dispatched.slice();
  };
  // Ask the game which keys its movement actions resolve to instead of guessing
  // them. A hardcoded ['ArrowRight', ...] list matched NOTHING -- the dispatch
  // is lowercase 'arrowright' -- so every "no movement was dispatched" result
  // was vacuously true and would have stayed green on a build that drifts. The
  // positive control is what caught it.
  const MOVE = new Set(['moveLeft', 'moveRight', 'moveUp', 'moveDown']
    .map(a => _lxPadResolveKey({ a }))
    .filter(Boolean)
    .map(k => String(k).toLowerCase()));
  out.moveKeys = [...MOVE];
  const moveKeys = (keys) => keys.filter(k => MOVE.has(String(k).toLowerCase()));

  out.poll = {};
  // A modal (tutorial card, story beat) makes _lxPadPoll route to MENU nav and
  // return before it ever touches gameplay -- which would make every assertion
  // below pass for the wrong reason, on any build. Close everything, then prove
  // the path is live with a POSITIVE CONTROL before trusting any negative one.
  // Hiding a known list of ids was not enough -- the control still reported a
  // modal open. Ask the game itself what surface it sees and shut that, rather
  // than guessing at ids.
  out.poll.closed = [];
  for (let i = 0; i < 12; i++) {
    const root = (typeof _lxPadModalRoot === 'function') ? _lxPadModalRoot() : null;
    if (!root) break;
    out.poll.closed.push(root.id || root.className || '(anonymous)');
    root.style.display = 'none';
    root.classList.remove('show', 'open', 'active');
  }
  out.poll.modalOpen = !!(typeof _lxPadModalRoot === 'function' && _lxPadModalRoot());
  {
    // Deflect right, having first moved, so the drift guard trusts it. This
    // MUST dispatch on every build; if it does not, the harness is measuring
    // nothing and the negative results below are worthless.
    const p = xbox([0, 0, 0, 0]); p.index = 20;
    runPoll([p], 2);
    p.axes[0] = 1.0;
    out.poll.positiveControl = moveKeys(runPoll([p], 3));
  }
  out.poll.idleXbox = moveKeys(runPoll([xbox([0, 0, 0, 0])]));
  out.poll.idleSonyRestingHat = moveKeys(runPoll([sony([...SONY_REST])]));
  {
    const p = xbox([1.0, 1.0, 0, 0]); p.index = 11;
    out.poll.pinnedAxis = moveKeys(runPoll([p], 30));
  }
  // ---- Steam Input: analog Move, and the contradictory-direction gate -----
  // window.SteamAPI only exists inside the Electron wrapper, so it is stubbed
  // here to drive the same code path the shipped build takes.
  out.steam = {};
  try {
    const realSteam = window.SteamAPI;
    // Each case releases everything first. _lxPadPrev survives between polls by
    // design (it is the edge-detection memo), so a direction still held from the
    // previous case produces no fresh keydown and the next case silently reads
    // as "dispatched nothing" -- a false pass on a good build and a false
    // failure on a bad one.
    const withSteam = (snap, list, times) => {
      window.SteamAPI = { available: true, input: { snapshot: () => ({}) } };
      runPoll(list || [], 2);                       // release any held direction
      window.SteamAPI = { available: true, input: { snapshot: () => snap } };
      const keys = runPoll(list || [], times || 3);
      window.SteamAPI = realSteam;
      return moveKeys(keys);
    };
    const idle = xbox([0, 0, 0, 0]);
    out.steam.analogRight = withSteam({ _moveX: 1, _moveY: 0 }, [idle]);
    out.steam.analogUp = withSteam({ _moveX: 0, _moveY: 1 }, [idle]);
    out.steam.analogIdle = withSteam({ _moveX: 0, _moveY: 0 }, [idle]);
    // An unactivated action set reports every direction at once. That is not a
    // stick position, it is broken data, and believing it is what walks the
    // player down-and-right for the whole session.
    out.steam.allFourDirections = withSteam(
      { moveUp: true, moveDown: true, moveLeft: true, moveRight: true }, [idle]);
    out.steam.digitalRightAlone = withSteam({ moveRight: true }, [idle]);
  } catch (e) { out.steamErr = String(e).slice(0, 120); }

  navigator.getGamepads = origGet;
  window._lxPadDispatch = origDispatch;
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 170) });

ok('the layout-aware helpers exist', (R.helpers || []).length === 0, 'missing: ' + ((R.helpers || []).join(', ') || 'none'));
ok('a standard-mapped pad wins over a non-standard one', R.pick && R.pick.prefersStandard === true);
ok('a Sony pad is still used when it is the only device', R.pick && R.pick.fallsBackToSony === true);
ok('a button-less ghost device is never selected', R.pick && R.pick.ignoresButtonless === true);
ok('a RESTING hat reads as centred, not as a held direction',
   R.hat && R.hat.restIsCentre === true, 'hat 3.2857 -> ' + JSON.stringify(R.hat));
ok('the hat decodes to the four D-pad directions',
   R.hat && R.hat.up && R.hat.right && R.hat.down && R.hat.left, JSON.stringify(R.hat));
ok('Sony CROSS drives the standard A action (jump)', R.sonyFace && R.sonyFace.crossIsStandardA === true);
ok('Sony SQUARE is not mistaken for A', R.sonyFace && R.sonyFace.squareIsNotA === true);
ok('Sony SQUARE drives the standard X action (attack)', R.sonyFace && R.sonyFace.squareIsStandardX === true);
ok('a Sony D-pad press is seen through the hat', R.sonyFace && R.sonyFace.hatRightIsDpadRight === true);
ok('a resting Sony hat presses no D-pad direction', R.sonyFace && R.sonyFace.restHatNoDpad === true);
ok('an axis pinned since the first poll never moves the player', R.stuck && R.stuck.pinnedAxisIgnored === true);
ok('a stick that genuinely moves is still trusted', R.stuck && R.stuck.realStickTrusted === true);
ok('CONTROL: the poll really reaches gameplay (a deflected stick DOES move)',
   (R.poll.positiveControl || []).length > 0,
   'dispatched: ' + JSON.stringify(R.poll.positiveControl) + '; movement keys watched: ' + JSON.stringify(R.moveKeys) + '; modal open: ' + R.poll.modalOpen);
ok('an idle Xbox pad dispatches no movement', (R.poll.idleXbox || []).length === 0, JSON.stringify(R.poll.idleXbox));
ok('an idle Sony pad with a resting hat dispatches no movement',
   (R.poll.idleSonyRestingHat || []).length === 0, JSON.stringify(R.poll.idleSonyRestingHat));
ok('THE REPORTED BUG: a pinned axis never walks the player down-and-right',
   (R.poll.pinnedAxis || []).length === 0,
   'dispatched over 30 polls: ' + JSON.stringify(R.poll.pinnedAxis));

ok('Steam Input analog Move drives movement (it was read by nothing)',
   (R.steam.analogRight || []).some(k => /right/i.test(k)), JSON.stringify(R.steam.analogRight) + (R.steamErr ? ' err: ' + R.steamErr : ''));
ok('...with the right sign: +Y on a Steam stick is UP',
   (R.steam.analogUp || []).some(k => /up/i.test(k)), JSON.stringify(R.steam.analogUp));
ok('...and a centred Steam stick moves nothing', (R.steam.analogIdle || []).length === 0, JSON.stringify(R.steam.analogIdle));
ok('THE OTHER HALF: all-four-directions at once is rejected, not obeyed',
   (R.steam.allFourDirections || []).length === 0, 'dispatched: ' + JSON.stringify(R.steam.allFourDirections));
ok('...while one honest direction still works',
   (R.steam.digitalRightAlone || []).some(k => /right/i.test(k)), JSON.stringify(R.steam.digitalRightAlone));

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
