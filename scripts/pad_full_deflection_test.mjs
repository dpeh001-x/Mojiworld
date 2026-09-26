// A gamepad's sticks must read at FULL deflection in every direction. The Sony trigger guard in _lxPadAxis ("an axis
// whose range hugs -1 at the bottom is a trigger") also matched a real stick pushed fully LEFT or UP - min -1, max above
// -0.95 because it rested at 0, value -1 - and returned 0: a full push left stopped the hero dead, full up did nothing,
// the menu would not scroll back up; only half pushes got through (launch polish sweep). The guard must still hold
// for what it was written for: a trigger that RESTS at -1 on a non-standard pad must not read as a held stick.
// Drives _lxPadAxis itself with a stick's real sequence of readings.
//   node scripts/pad_full_deflection_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9936);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof _lxPadAxis === 'function' && typeof _lxPadAxisSeen === 'object', null, { timeout: 120000 });
const r = await page.evaluate(() => {
  const mk = (index, mapping, id) => ({ id, index, mapping, connected: true, axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], buttons: [] });
  const seq = (pad, i, which, vals, rest) => { for (const k in _lxPadAxisSeen) delete _lxPadAxisSeen[k]; pad.axes[i] = rest; _lxPadAxis(pad, which);
    return vals.map((v) => { pad.axes[i] = v; return +(+_lxPadAxis(pad, which)).toFixed(2); }); };
  const std = mk(0, 'standard', 'Xbox 360 Controller (XInput STANDARD GAMEPAD)');
  const oth = mk(1, '', 'Generic USB Joystick');   // non-standard, unprofiled: STD indices
  return {
    lx: seq(std, 0, 'x', [1, 0, -1, -1, -0.45, 1], 0),
    ly: seq(std, 1, 'y', [-1, 0, 1, -1], 0),
    ry: seq(std, 3, 'ry', [1, 0, -1], 0),
    // the guard's own case: an axis that RESTS at -1 (a trigger) on a non-standard pad, used once
    trig: seq(oth, 3, 'ry', [1, -1, -1], -1),
    // and a real stick on that same non-standard pad still reads full left
    othLx: seq(oth, 0, 'x', [1, 0, -1], 0),
  };
});
await browser.close(); server.kill();
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${JSON.stringify(x)}`); };
ok('left stick: full right, then full LEFT (twice), then half left all read through', r.lx[0] === 1 && r.lx[2] === -1 && r.lx[3] === -1 && r.lx[4] === -0.45 && r.lx[5] === 1, r.lx);
ok('left stick: full UP reads -1 before and after a full down', r.ly[0] === -1 && r.ly[2] === 1 && r.ly[3] === -1, r.ly);
ok('right stick: full UP reads -1 (menus scroll back up)', r.ry[2] === -1, r.ry);
ok('a trigger resting at -1 on a non-standard pad still reads 0 at rest after being pulled', r.trig[0] === 1 && r.trig[1] === 0 && r.trig[2] === 0, r.trig);
ok('a stick on a non-standard pad still reads full left', r.othLx[2] === -1, r.othLx);
ok('no page errors', errs.length === 0, errs.slice(0, 2));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
