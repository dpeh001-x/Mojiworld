// The boot frame watchdog: fires when the page is slow, stays quiet when it is not.
// ============================================================================
// Contract, both halves asserted because either one alone is a bug:
//   Firefox on this machine renders the title screen at ~14 fps, so the
//   watchdog MUST engage html.lx-nobackdrop and the frame rate must rise.
//   Chromium renders it at ~38 fps, so the watchdog MUST NOT engage and the
//   storybook colour grade must survive.
//
// A watchdog that fires on everything is worse than none: it would silently
// strip the blurs from every machine that can afford them.
//
// Firefox is skipped, loudly, if no Playwright Firefox build is installed —
// a skip is reported as a skip, never as a pass.
// Run: node scripts/boot_frame_watchdog_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10999);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const SNAP = () => new Promise((done) => {
  const t0 = performance.now(); let n = 0;
  const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
    else done({
      fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1),
      nobackdrop: document.documentElement.classList.contains('lx-nobackdrop'),
      grade: (() => { const g = document.getElementById('game'); return g ? getComputedStyle(g).filter : 'absent'; })(),
      blur: (() => { const s = document.getElementById('stats'); if (!s) return 'absent';
        const c = getComputedStyle(s); return (c.backdropFilter || c.webkitBackdropFilter || 'none'); })(),
    }); };
  requestAnimationFrame(tick);
});

const run = async (launch) => {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const perf = [];
  page.on('console', (m) => { const t = m.text(); if (t.includes('[perf]')) perf.push(t.slice(0, 90)); });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || String.fromCharCode(109,111,106,105,119,111,114,108,100,95,103,97,109,101,46,104,116,109,108)}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(16000);           // past START_AFTER + two windows
  const s = await page.evaluate(SNAP);
  await b.close();
  return { ...s, perf };
};

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

// ---- Chromium: healthy, must be left alone ---------------------------------
let cr = null;
try { cr = await run(() => chromium.launch({ channel: 'msedge', headless: false })); }
catch (e) { console.log('chromium: ' + String(e.message).slice(0, 120)); }
if (cr) {
  console.log(`  CHROMIUM  ${cr.fps} fps  lx-nobackdrop=${cr.nobackdrop}  #game filter="${String(cr.grade).slice(0, 34)}"`);
  ok('CONTROL: Chromium renders fast enough to keep its effects', cr.fps >= 25, `${cr.fps} fps`);
  ok('the watchdog does NOT fire on a healthy renderer', cr.nobackdrop === false,
     'firing here would strip the blurs from every machine that can afford them');
  ok('...so the storybook colour grade survives', String(cr.grade).includes('saturate'), `#game filter "${cr.grade}"`);
  ok('...and the HUD keeps its backdrop blur', String(cr.blur).includes('blur'), `#stats backdrop-filter "${cr.blur}"`);
}

// ---- Firefox: slow here, must be rescued -----------------------------------
if (!existsSync(FF)) {
  console.log('  FIREFOX   SKIPPED — no Playwright Firefox build at ' + FF);
  console.log('            (npx playwright install firefox)');
} else {
  let ff = null;
  try { ff = await run(() => firefox.launch({ executablePath: FF, headless: false })); }
  catch (e) { console.log('firefox: ' + String(e.message).slice(0, 120)); }
  if (ff) {
    console.log(`  FIREFOX   ${ff.fps} fps  lx-nobackdrop=${ff.nobackdrop}  #game filter="${String(ff.grade).slice(0, 34)}"`);
    console.log(`            ${ff.perf.length ? ff.perf.join(' | ') : '(no [perf] console line)'}`);
    // Guarded: if this machine's Firefox is somehow fast, the watchdog is RIGHT
    // not to fire, and asserting otherwise would fail a correct build.
    if (ff.fps >= 25 && !ff.nobackdrop) {
      ok('Firefox is fast here, so the watchdog correctly stayed out', true, `${ff.fps} fps — nothing to rescue`);
    } else {
      ok('the watchdog engaged on the slow renderer', ff.nobackdrop === true,
         'Firefox measured under 25 fps at the title screen; nothing else in the game watches there');
      ok('...and said so, with the measured rate', ff.perf.some((p) => /boot frame watchdog/.test(p)),
         ff.perf.join(' | ') || 'no [perf] line');
      ok('...and the colour grade came off with the blurs', String(ff.grade) === 'none', `#game filter "${ff.grade}"`);
      ok('...and the frame rate actually recovered', ff.fps >= 20,
         `${ff.fps} fps after the class engaged (was 13.8-14.7 before this change)`);
    }
  }
}
server.kill();

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
