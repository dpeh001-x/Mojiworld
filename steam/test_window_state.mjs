// Plain-Node checks for window_state.js (final polish audit U1) and for how main.js wires it.
//   node steam/test_window_state.mjs
import { createRequire } from 'node:module'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = require('./window_state.js');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  [' + JSON.stringify(d) + ']' : '')); ok ? pass++ : fail++; };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-winstate-')); const file = path.join(dir, 'window-state.json');

check(JSON.stringify(ws.loadState(file)) === JSON.stringify({ width: 1280, height: 800, maximized: false, fullscreen: false }), 'no saved state: 1280x800 windowed');
fs.writeFileSync(file, '{ not json'); check(ws.loadState(file).width === 1280, 'a corrupt file falls back to the default, no throw');
fs.writeFileSync(file, JSON.stringify({ width: 300, height: 99999, x: 10.4, y: 20.6, maximized: 'yes', fullscreen: true }));
const s = ws.loadState(file);
check(s.width === 960 && s.height === 16384 && s.x === 10 && s.y === 21 && s.maximized === false && s.fullscreen === true, 'sizes are clamped, positions rounded, flags must be real booleans', s);

const fakeWin = { getNormalBounds: () => ({ x: 200, y: 120, width: 1600, height: 900 }), isMaximized: () => true, isFullScreen: () => false };
check(ws.saveState(file, ws.snapshot(fakeWin)) && !fs.existsSync(file + '.tmp'), 'saves through a temp file and leaves none behind');
const back = ws.loadState(file);
check(back.width === 1600 && back.height === 900 && back.x === 200 && back.y === 120 && back.maximized && !back.fullscreen, 'the saved state round-trips (normal bounds + maximized)', back);

const primary = [{ x: 0, y: 0, width: 1920, height: 1040 }];
check(ws.onScreen({ x: 200, y: 120 }, primary), 'a position on a display is kept');
check(!ws.onScreen({ x: 2500, y: 120 }, primary), 'a position on an unplugged second monitor is dropped');
check(ws.onScreen({ x: 2500, y: 120 }, primary.concat([{ x: 1920, y: 0, width: 1920, height: 1040 }])), '...and kept while that monitor is there');

const k = (o) => ws.isFullscreenKey(Object.assign({ type: 'keyDown' }, o));
check(k({ key: 'F11' }) && k({ key: 'Enter', alt: true }), 'F11 and Alt+Enter toggle fullscreen');
check(!k({ key: 'Enter' }) && !k({ key: 'Enter', alt: true, control: true }) && !k({ key: 'F11', isAutoRepeat: true }) && !ws.isFullscreenKey({ type: 'keyUp', key: 'F11' }), 'plain Enter, Ctrl+Alt+Enter, a held key and key-up do not');

const main = fs.readFileSync(path.join(HERE, 'main.js'), 'utf8');
check(/if \(app\.isPackaged\) \{ try \{ Menu\.setApplicationMenu\(null\)/.test(main), 'the packaged app has no application menu (Alt showed File/Edit/View; Ctrl+R reloaded, Ctrl+W closed the game)');
check(/before-input-event/.test(main) && /winState\.isFullscreenKey\(input\)/.test(main) && /win\.setFullScreen\(!win\.isFullScreen\(\)\)/.test(main), 'main.js toggles fullscreen on those keys');
check(/winState\.loadState\(/.test(main) && /win\.on\('close'/.test(main) && /winState\.saveState\(/.test(main), 'main.js restores the window state and saves it on close');
const pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
check(pkg.build && pkg.build.files.includes('window_state.js'), 'window_state.js ships in the packaged app');
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
