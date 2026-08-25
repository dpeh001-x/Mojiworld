#!/usr/bin/env node
// Per user: "the ps5 pad is not working properly, please try to debug and make
// it work for steam."
//
// Three failure modes a DualSense can hit that an Xbox pad cannot. Each is
// driven through the game's own _lxPadPick / _lxPadBtn / _lxPadAxis with a
// synthetic pad, so the checks exercise the shipped code rather than a copy.
//
//   1. TWO PADS. With Steam's PlayStation Controller Support on, Steam's
//      virtual XInput pad and the physical DualSense are both enumerated and
//      both standard-mapped. Picking by mapping alone ties, the tie breaks on
//      enumeration order, and half the time the game listens to the device
//      nobody is holding -> "no functionality".
//   2. THE HAT IS NOT ALWAYS AT AXIS 9. The Sony profile hardcodes the
//      DualShock-4 index; if the DualSense puts it elsewhere the D-pad is
//      silently dead.
//   3. A TRIGGER IS NOT A STICK. L2/R2 rest at -1 and sit next to the
//      right-stick indices. Once pulled they pass the "has it moved" guard,
//      and a resting trigger then reads as a stick held hard in one direction.
//
//   node scripts/ps5_pad_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _lxPadPick === 'function' && typeof _lxPadBtn === 'function',
                           { timeout: 90000 });

const out = await page.evaluate(() => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 150) });
  const btns = (n, down = []) => Array.from({ length: n }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 }));
  const forget = (i) => { try { _lxPadForget(i); } catch (e) {} };

  // ---- 1. Steam's virtual pad next to the real DualSense -------------------
  {
    forget(0); forget(1);
    // index 0: Steam's virtual XInput pad — enumerated, standard, untouched.
    const virt = { index: 0, connected: true, mapping: 'standard',
                   id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)',
                   axes: [0, 0, 0, 0], buttons: btns(17) };
    // index 1: the physical DualSense, and the player is pressing Cross.
    const real = { index: 1, connected: true, mapping: 'standard',
                   id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
                   axes: [0, 0, 0, 0], buttons: btns(17, [0]) };
    // Enumeration order puts the inert virtual pad first, which is the case
    // the old "first standard pad wins" scoring lost.
    let pick = _lxPadPick([virt, real]);
    ok('with two standard pads, the one being PRESSED is chosen', pick === real,
       'picked index ' + (pick ? pick.index : 'none') + ' (0 = inert virtual, 1 = real DualSense)');
    // and it must stay chosen for a moment after the button is released
    const real2 = Object.assign({}, real, { buttons: btns(17) });
    pick = _lxPadPick([virt, real2]);
    ok('...and stays chosen after the button is released', pick === real2,
       'picked index ' + (pick ? pick.index : 'none'));
  }

  // ---- 2. a Sony pad whose hat is NOT at axis 9 ----------------------------
  {
    forget(3);
    // Non-standard Sony layout, hat parked at axis 6 instead of 9. 3.2857 is
    // the canonical centred-hat value; UP is -1.
    const mk = (hatVal) => ({
      index: 3, connected: true, mapping: '',
      id: 'Wireless Controller (Vendor: 054c Product: 0ce6)',
      axes: [0, 0, 0, -1, -1, 0, hatVal, 0, 0, 0],
      buttons: btns(14),
    });
    const rest = mk(3.2857);
    _lxPadScanAxes(rest);                       // let the scan classify axis 6 as a hat
    const restDirs = [12, 13, 14, 15].filter((i) => _lxPadBtn(rest, i));
    ok('a resting hat at a non-standard index presses nothing', restDirs.length === 0,
       'directions asserted at rest: ' + JSON.stringify(restDirs));
    const up = mk(-1);
    _lxPadScanAxes(up);
    ok('D-pad UP is read from the DETECTED hat, not the hardcoded axis 9', _lxPadBtn(up, 12),
       'up=' + _lxPadBtn(up, 12) + ' down=' + _lxPadBtn(up, 13) +
       ' left=' + _lxPadBtn(up, 14) + ' right=' + _lxPadBtn(up, 15));
  }

  // ---- 3. a pulled trigger must not become a stick -------------------------
  {
    forget(4);
    const mk = (ry) => ({
      index: 4, connected: true, mapping: '',
      id: 'Wireless Controller (Vendor: 054c Product: 0ce6)',
      axes: [0, 0, 0, -1, -1, ry, 3.2857, 0, 0, 0],
      buttons: btns(14),
    });
    // The profile reads the right stick's Y at axis 5. On this device axis 5 is
    // a trigger: it rests at -1 and rises when pulled.
    _lxPadScanAxes(mk(-1));                     // resting
    _lxPadScanAxes(mk(1));                      // player pulls it fully
    _lxPadScanAxes(mk(-1));                     // and lets go
    const atRest = _lxPadAxis(mk(-1), 'ry');
    ok('a trigger that has been pulled does not read as a held stick', atRest === 0,
       'ry at rest after one pull: ' + atRest + '  (non-zero = permanent input)');
  }

  // ---- 4. control: a real stick still works -------------------------------
  {
    forget(5);
    const mk = (ly) => ({
      index: 5, connected: true, mapping: 'standard',
      id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      axes: [0, ly, 0, 0], buttons: btns(17),
    });
    _lxPadScanAxes(mk(0)); _lxPadScanAxes(mk(-1)); _lxPadScanAxes(mk(1));
    ok('CONTROL: a genuine stick push is still reported', _lxPadAxis(mk(1), 'y') === 1,
       'y pushed = ' + _lxPadAxis(mk(1), 'y'));
    ok('CONTROL: a centred stick reports nothing', _lxPadAxis(mk(0), 'y') === 0,
       'y centred = ' + _lxPadAxis(mk(0), 'y'));
  }
  return res;
});
await browser.close();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + FILE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
