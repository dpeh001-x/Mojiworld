// GRAVITOS'S RIFT HAS NO WHITE LINE (per user: "There is a white linear line in the centre of the void, remove it"). His teleport
// telegraph (_lxGravRiftDraw) opens a void rift over his body and at his landing spot; _lxGravRiftAt used to paint a 3 px #ffe6ff
// "white-hot seam" down the middle of it, additive and near-opaque as the jump landed - a white line splitting the screen.
// One page, the real draw functions on the game's own canvas, every tall hairline recorded:
//   [1] a rift at full warning (seam = 1, additive) draws no bar <= 6 px wide and >= 100 px tall, and no #ffe6ff fill at all;
//   [2] so does the whole warning pass - Gravitos mid-blink-warning, both passes (behind and in front of the monsters), and the
//       rift "pops" as it snaps shut and open - while the rift art itself still draws;
//   [3] no page errors.
// The build before fails [1] and [2].   node scripts/grav_rift_seam_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11887);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxGravRiftAt === 'function' && typeof _lxGravRiftDraw === 'function' && typeof ctx !== 'undefined', null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // the rift art decoded (so [2] also proves the art still draws)
    // ...and form 1's own rift, which the pass below draws since each form has its own (rift-forms; an older build ignores the form)
    for (let i = 0; i < 100 && !(_lxGravRiftImg() && _lxGravRiftImg(1)); i++) { try { if (typeof _fxAnimFrames === 'function') { _fxAnimFrames('gravitos_voidrift'); _fxAnimFrames('gravitos1_voidrift'); } } catch (e) {} await sleep(100); }
    const P = CanvasRenderingContext2D.prototype, fr = P.fillRect, di = P.drawImage, log = { bars: [], pink: 0, art: 0 };
    const hook = () => {
      P.fillRect = function (x, y, w, h) { if (Math.abs(w) <= 6 && Math.abs(h) >= 100) log.bars.push({ w, h: Math.round(h), style: String(this.fillStyle) });
        if (String(this.fillStyle).toLowerCase() === '#ffe6ff') log.pink++; return fr.apply(this, arguments); };
      P.drawImage = function () { log.art++; return di.apply(this, arguments); };
    };
    const unhook = () => { P.fillRect = fr; P.drawImage = di; };
    const out = {};
    // [1] one rift, full warning
    hook(); ctx.save(); _lxGravRiftAt(_lxGravRiftImg(), 480, 280, 420, 1, 1, true); _lxGravRiftAt(null, 480, 280, 420, 1, 1, false); ctx.restore(); unhook();
    out.one = { bars: log.bars.length, pink: log.pink, art: log.art }; log.bars = []; log.pink = 0; log.art = 0;
    // [2] the whole pass: a stand-in Gravitos mid-warning (p ~ 0.9, destination set), both passes, plus two pops
    const g = { type: 'gravitos', x: 300, y: 120, w: 340, h: 380, currentHp: 1, patternState: 'idle', _tpWarn: { kind: 'blink', el: 900, ms: 1000, at: 0, x: 700, y: 300 } };
    const had = game.monsters.slice(); game.monsters.length = 0; game.monsters.push(g);
    _lxGravRiftPop(400, 300, 360); _lxGravRiftPop(700, 300, 360);
    hook(); ctx.save(); _lxGravRiftDraw(false); _lxGravRiftDraw(true); ctx.restore(); unhook();
    game.monsters.length = 0; for (const m of had) game.monsters.push(m);
    out.pass = { bars: log.bars.slice(0, 4), n: log.bars.length, pink: log.pink, art: log.art };
    return out;
  });
  ok('[1] a rift at full warning draws no white hairline down its middle (no bar <= 6 px wide, no #ffe6ff fill)', R.one.bars === 0 && R.one.pink === 0 && R.one.art > 0, R.one);
  ok('[2] the whole warning pass (behind + in front, destination, pops) draws none either, and the rift art still draws', R.pass.n === 0 && R.pass.pink === 0 && R.pass.art > 0, R.pass);
  ok('[3] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
