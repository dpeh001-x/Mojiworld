// THE BACKDROP-VIDEO GATE IS ASKED ONCE (v0.30.939 boss-fight lag). drawBackground calls _lxMapVideoFrame every
// frame, which calls _lxMapVideoAllowed, which parsed a media query and built a fresh MediaQueryList every time
// (10 ms of matchMedia plus 8 ms of its own in a 6 s sample of a Gravitos fight). One live list answers for the
// session, and because it is live it still reports a preference the player turns on mid-session.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/map_video_gate_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11329';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxMapVideoAllowed === 'function', null, { timeout: 180000 });
  // 1. a frame's worth of calls asks the browser once, not once per call
  const asked = await page.evaluate(() => {
    _lxMapVideoAllowed();                                  // whatever it caches, it caches before we count
    const real = window.matchMedia; let n = 0;
    window.matchMedia = function () { n++; return real.apply(this, arguments); };
    for (let i = 0; i < 120; i++) _lxMapVideoAllowed();    // two seconds of frames
    window.matchMedia = real;
    return { n };
  });
  check(asked.n === 0, 'two seconds of frames build no new media query', J(asked));
  // 2. and it still answers true here, where motion is not reduced
  check(await page.evaluate(() => _lxMapVideoAllowed() === true), 'a backdrop clip is allowed when motion is not reduced');
  // 3. the held list is live: a preference turned on mid-session is seen
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => _lxMapVideoAllowed());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const back = await page.evaluate(() => _lxMapVideoAllowed());
  check(reduced === false && back === true, 'reduced motion turned on mid-session still stops the clip', J({ reduced, back }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
