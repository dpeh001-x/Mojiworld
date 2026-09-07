// Headless test: THE ANIMATOR'S TIMING STRIP - for regular monsters and bosses.
//
// Per user: "extend it to normal monsters sprites as well ... make it even
// easier to use". Drives the real page:
//   - select a regular monster, focus walk: the strip shows one ms field per
//     frame; typing into one writes CALIB ft[] and _ftFor('walk') returns it
//   - presets: 'hold last' triples the last frame; 'even' restores defaults
//   - a boss: strip on attack; on walk the strip is NOT offered (the game does
//     not re-time boss walk) - the tool must not pretend
//   - the badge names this build; no page errors
//   node scripts/animator_frame_timing_ui_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const PORT = Number(process.env.PORT || 9977);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/monster_animator.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!(window.__app && window.__app.CALIB), null, { timeout: 30000 });
await page.waitForTimeout(2000);

const R = await page.evaluate(async () => {
  const A = window.__app, out = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rebuild = async () => { if (typeof window.__buildControls === 'function') window.__buildControls(); await wait(300); };
  const mob = Object.keys(A.MAN).find((k) => A.MAN[k].group !== 'boss' && A.frameCount && true);
  const boss = Object.keys(A.MAN).find((k) => A.MAN[k].group === 'boss');
  out.mob = mob; out.boss = boss;
  A.select(mob); await wait(900); A.setFocus('walk'); await rebuild();
  const n = A.frameCount('walk'); out.walkFrames = n;
  const fields = document.querySelectorAll('#ft-strip input.ftms');
  out.stripFields = fields.length;
  out.thumbs = document.querySelectorAll('#ft-strip canvas[data-thumb]').length;
  if (fields.length >= 2) {
    const f = fields[1]; f.value = '333'; f.dispatchEvent(new Event('input', { bubbles: true })); await wait(150);
    const v = A.CALIB()[A.ownerOf(mob)].walk;
    out.ftAfterType = Array.isArray(v.ft) ? v.ft.slice() : null;
    out.ftForWalk = (window.__core._ftFor('walk') || []).slice();
    out.totalText = (document.getElementById('ft-total') || {}).textContent;
  }
  const hold = document.querySelector('button[data-ftp="holdlast"]'); if (hold) { hold.click(); await wait(300); }
  out.ftAfterHold = (A.CALIB()[A.ownerOf(mob)].walk.ft || []).slice();
  const even = document.querySelector('button[data-ftp="even"]'); if (even) { even.click(); await wait(300); }
  out.ftAfterEven = (A.CALIB()[A.ownerOf(mob)].walk.ft || []).slice();
  const clr = document.getElementById('fr-ft-clear'); if (clr) { clr.click(); await wait(300); }
  out.ftAfterClear = A.CALIB()[A.ownerOf(mob)].walk.ft;
  out.walkBase = window.__core.GAME_FRAME_MS.walk;
  // boss: attack offered, walk not
  A.select(boss); await wait(900); A.setFocus('attack'); await rebuild();
  out.bossAttackFields = document.querySelectorAll('#ft-strip input.ftms').length;
  A.setFocus('walk'); await rebuild();
  out.bossWalkFields = document.querySelectorAll('#ft-strip input.ftms').length;
  out.bossWalkNote = /keeps the engine clock/.test((document.getElementById('fr-card') || {}).textContent || '');
  out.badge = (document.getElementById('lx-build-badge') || {}).textContent;
  return out;
});
ok('a regular monster gets the timing strip on walk: one ms field + thumbnail per frame', R.stripFields > 1 && R.stripFields === R.walkFrames && R.thumbs === R.walkFrames, { mob: R.mob, fields: R.stripFields, frames: R.walkFrames, thumbs: R.thumbs });
ok('typing a value writes CALIB ft[] and the live preview clock (_ftFor) reads it', R.ftAfterType && R.ftAfterType[1] === 333 && R.ftForWalk[1] === 333, { ft: R.ftAfterType, ftFor: R.ftForWalk, total: R.totalText });
ok('preset "hold last" triples the last frame at the game default', R.ftAfterHold.length > 0 && R.ftAfterHold[R.ftAfterHold.length - 1] === Math.round(R.walkBase * 3), { last: R.ftAfterHold[R.ftAfterHold.length - 1], base: R.walkBase });
ok('preset "even" restores every frame to the game default; "clear" removes ft', R.ftAfterEven.every((x) => x === R.walkBase) && R.ftAfterClear === undefined, { even: R.ftAfterEven.slice(0, 4), cleared: R.ftAfterClear });
ok('a boss gets the strip on attack but NOT on walk (the game does not re-time boss walk)', R.bossAttackFields > 1 && R.bossWalkFields === 0 && R.bossWalkNote === true, { boss: R.boss, attack: R.bossAttackFields, walk: R.bossWalkFields, note: R.bossWalkNote });
ok('the build badge names this build', /build v0\.30\.\d+/.test(R.badge || ''), { badge: R.badge });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });
await browser.close(); server.kill();
let pass = 0; for (const t of results) { console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n); if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 360)); if (t.pass) pass++; }
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
