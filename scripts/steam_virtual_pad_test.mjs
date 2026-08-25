#!/usr/bin/env node
// Per user: "using the controller that steam uses, ensure that the fix fixes
// the issues."
//
// What Steam hands the game is usually NOT the DualSense. With Steam Input or
// PlayStation Controller Support on, Steam captures the physical pad and
// presents a VIRTUAL XInput gamepad (Valve's vendor 28de, product 11ff). So
// this drives the real _lxPadPoll with the devices Steam actually enumerates
// and captures the KeyboardEvents the pad layer dispatches — the same events
// gameplay listens to. Nothing here inspects internals: if a key does not
// reach the document, the control does not work.
//
// The common Steam case is the REVERSE of ps5_pad_test's: there the physical
// pad carried the input; here the VIRTUAL pad does while the DualSense sits
// enumerated and inert. A pick rule that favoured either device by identity
// would pass one and fail the other. Only "follow the input" passes both.
//
//   node scripts/steam_virtual_pad_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _lxPadPoll === 'function' && typeof _lxPadPick === 'function',
                           { timeout: 90000 });

const out = await page.evaluate(async () => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 155) });

  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise((r) => setTimeout(r, 15000))]); } catch (e) {}
  try { loadMap('forest'); player.cls = 'warrior'; player.level = 60; game.paused = false; } catch (e) {}
  // Get into GAMEPLAY mode. The poll deliberately routes the pad to MENU
  // navigation while any surface is open, so a story beat left on screen makes
  // every gameplay check dispatch nothing — which looks exactly like a broken
  // pad. A first run of this test measured that and blamed the fix. Clear
  // whatever the game itself reports as the modal root, then assert it is gone.
  // HIDE, never remove. An earlier version called .remove() on whatever the
  // game reported, which can detach a structural node — and every later check
  // then measured a page whose body had been replaced, so even a direct
  // _lxPadDispatch(' ', true) reached no listener. That looked exactly like a
  // dead controller and was entirely self-inflicted.
  for (let i = 0; i < 40; i++) {
    const r = (typeof _lxPadModalRoot === 'function') ? _lxPadModalRoot() : null;
    if (!r) break;
    if (r === document.body || r === document.documentElement || r.id === 'game') break;
    try { r.style.display = 'none'; r.style.visibility = 'hidden'; } catch (e) {}
    await new Promise((res2) => setTimeout(res2, 30));
  }
  ok('the harness reached gameplay mode (no surface open)',
     (typeof _lxPadModalRoot !== 'function') || _lxPadModalRoot() === null,
     'modal root: ' + (() => { const r = _lxPadModalRoot && _lxPadModalRoot(); return r ? (r.id || r.className) : 'none'; })());

  const btns = (n, down = []) => Array.from({ length: n }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 }));
  // Steam's virtual gamepad: Valve vendor 28de, product 11ff, standard-mapped.
  const steamVirtual = (down = [], axes = [0, 0, 0, 0]) => ({
    index: 0, connected: true, mapping: 'standard',
    id: 'Microsoft X-Box 360 pad (Vendor: 28de Product: 11ff)',
    axes, buttons: btns(17, down),
  });
  // The physical DualSense, still enumerated behind Steam's capture, untouched.
  const dualsenseIdle = () => ({
    index: 1, connected: true, mapping: 'standard',
    id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
    axes: [0, 0, 0, 0], buttons: btns(17),
  });

  const realGP = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;
  const setPads = (arr) => { navigator.getGamepads = () => arr; };
  // Wake the poller the way a real pad does. `_lxPadPresent` is a `let`, so it
  // is NOT a window property — assigning window._lxPadPresent creates a
  // different variable and the poll keeps early-returning before it ever calls
  // getGamepads. (Measured: 0 calls. The same lexical-vs-window trap that makes
  // `window.ctx = x` silently do nothing.) The game flips the real flag from
  // this event, so fire the event.
  setPads([steamVirtual(), dualsenseIdle()]);
  try { window.dispatchEvent(new Event('gamepadconnected')); } catch (e) {}
  ok('the poller woke up (getGamepads is actually being called)',
     (() => { let n = 0; const g = navigator.getGamepads;
              navigator.getGamepads = () => { n++; return [steamVirtual(), dualsenseIdle()]; };
              try { _lxPadPoll(); } catch (e) {}
              navigator.getGamepads = g; return n > 0; })(),
     'if this fails every check below is measuring a poll that never ran');

  // Capture what the pad layer actually injects.
  const seenKeys = [];
  const onKey = (e) => { if (e.type === 'keydown') seenKeys.push(String(e.key).toLowerCase()); };
  // Listen at DOCUMENT capture, not on body. The game handles keys with a
  // document-level capture listener and stops propagation for space, so a
  // listener on document.body never sees jump - and an earlier run of this
  // test read that as a dead button. A hand-built space event behaves exactly
  // the same way, which is what proved it was the harness and not the pad.
  document.addEventListener('keydown', onKey, true);
  const drive = (pads, polls = 3) => {
    seenKeys.length = 0;
    setPads(pads);
    for (let i = 0; i < polls; i++) { try { _lxPadPoll(); } catch (e) {} }
    return seenKeys.slice();
  };
  // For PRESS checks, drive a full press-release-press cycle and measure only
  // the SECOND edge. The poll swallows one press when it leaves menu mode
  // (so a button that closed a panel cannot also act in gameplay), and a
  // single-edge probe cannot tell that deliberate swallow apart from a dead
  // button — an earlier run of this test reported exactly that and blamed the
  // pad layer. Two edges make the distinction unambiguous.
  const drivePress = (pads) => {
    const idle = [steamVirtual(), dualsenseIdle()];
    try {
      setPads(idle); _lxPadPoll();
      setPads(pads); _lxPadPoll();
      setPads(idle); _lxPadPoll();
    } catch (e) {}
    seenKeys.length = 0;
    setPads(pads);
    for (let i = 0; i < 2; i++) { try { _lxPadPoll(); } catch (e) {} }
    return seenKeys.slice();
  };
  const clearHeld = () => { try { setPads([steamVirtual(), dualsenseIdle()]); _lxPadPoll(); _lxPadPoll(); } catch (e) {} };
  // Burn the mode-boundary swallow before measuring anything. Leaving menu
  // mode, the poll deliberately marks the first still-held press as already
  // down WITHOUT dispatching, so a button that closed a panel cannot also act
  // in gameplay. That is correct — but it means the very first press this
  // harness makes is eaten, and an earlier run read that as a dead button.
  try {
    setPads([steamVirtual([2]), dualsenseIdle()]); _lxPadPoll();
    setPads([steamVirtual(), dualsenseIdle()]); _lxPadPoll(); _lxPadPoll();
  } catch (e) {}

  try { _lxPadForget(0); _lxPadForget(1); } catch (e) {}

  // ---- 1. Steam's virtual pad is the one carrying input --------------------
  {
    clearHeld();
    const pick = _lxPadPick([steamVirtual([0]), dualsenseIdle()]);
    ok('Steam virtual pad is chosen when IT is the one being pressed', pick && pick.index === 0,
       'picked index ' + (pick ? pick.index : 'none') + ' (0 = Steam virtual, 1 = idle DualSense)');
  }

  // ---- 2. its buttons actually reach the game ------------------------------
  {
    clearHeld();
    const k = drivePress([steamVirtual([0]), dualsenseIdle()]);   // A / Cross = jump
    ok('a press on the Steam virtual pad dispatches a key to the game', k.length > 0,
       'keys dispatched: ' + JSON.stringify(k));
  }

  // ---- 3. THE REPORTED BUG: an untouched Steam pad moves nothing ----------
  {
    clearHeld();
    const k = drive([steamVirtual(), dualsenseIdle()], 30);
    const dirs = k.filter((x) => ['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(x));
    ok('THE REPORTED BUG: a resting Steam pad never walks the player', dirs.length === 0,
       'movement keys over 30 polls: ' + JSON.stringify(dirs));
  }

  // ---- 4. the D-pad and stick still drive movement -------------------------
  {
    clearHeld();
    const kd = drivePress([steamVirtual([15]), dualsenseIdle()]);       // D-pad right
    ok('D-pad RIGHT on the Steam virtual pad moves right', kd.length > 0, 'keys: ' + JSON.stringify(kd));
    clearHeld();
    // A stick must be seen to move before it is trusted (the stuck-axis guard).
    setPads([steamVirtual([], [0, 0, 0, 0]), dualsenseIdle()]); _lxPadPoll();
    setPads([steamVirtual([], [-1, 0, 0, 0]), dualsenseIdle()]); _lxPadPoll();
    const ks = drive([steamVirtual([], [1, 0, 0, 0]), dualsenseIdle()]);
    ok('LEFT STICK on the Steam virtual pad moves the player', ks.length > 0, 'keys: ' + JSON.stringify(ks));
  }

  // ---- 5. a standard-mapped Sony device must NOT get the Sony profile ------
  {
    // Chromium standard-maps a modern DualSense. Applying the DirectInput
    // profile on top would rotate the face buttons (cross would read as
    // square) and read the D-pad off a stick axis.
    const dsStd = { index: 2, connected: true, mapping: 'standard',
                    id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
                    axes: [0, 0, 0, 0], buttons: btns(17) };
    ok('a STANDARD-mapped DualSense is not run through the Sony profile',
       _lxPadProfile(dsStd) === null, 'profile: ' + JSON.stringify(_lxPadProfile(dsStd)));
  }

  // ---- 6. and Steam's virtual pad never gets it either ---------------------
  {
    // Steam sometimes names the virtual pad after the device it is emulating,
    // so the id can contain "Wireless Controller" while the LAYOUT is XInput.
    // Matching the Sony profile on the name alone would scramble every button.
    const impostor = { index: 6, connected: true, mapping: 'standard',
                       id: 'Steam Virtual Gamepad - Wireless Controller (Vendor: 28de Product: 11ff)',
                       axes: [0, 0, 0, 0], buttons: btns(17) };
    ok('a Steam virtual pad named after a Sony device keeps the XInput layout',
       _lxPadProfile(impostor) === null, 'profile: ' + JSON.stringify(_lxPadProfile(impostor)));
  }

  document.removeEventListener('keydown', onKey, true);
  if (realGP) navigator.getGamepads = realGP;
  return res;
});
await browser.close();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + FILE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
