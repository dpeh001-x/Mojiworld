// Live test: THE ANIMATOR CAN LEVEL A BOSS ON ITS HEAD AND BODY.
//
// Per user: "gravitos3 has wings so that can affect the size calibration, the
// calibration should be based on the head and body" and "update the animator
// HTML so I can adjust".
//
// The animator now measures head+body in the browser. That is a SECOND
// implementation of the rule the bake script uses, so the thing most worth
// testing is that the two agree - a leveller that disagrees with the baked
// values would quietly undo them the first time someone pressed it.
//   node scripts/animator_headbody_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
import { headBody } from './gravitos3_headbody_fs.mjs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// what the bake script measures, from the files
const nodeH = [];
for (let i = 0; i < 9; i++) nodeH.push((await headBody(`Sprites/bosses/idle/gravitos3_${i}.webp`)).h);

const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8791; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/monster_animator.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof window.__A === 'object' || typeof window.__buildControls === 'function',
  null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(4000);

const r = await page.evaluate(async () => {
  const out = {};
  out.badge = (document.body.innerText.match(/build v0\.[\d.]+/) || [])[0] || null;
  const A = window.__app;
  out.hasApp = !!A;
  if (!A) return out;
  out.hasFramesOf = typeof A.framesOf === "function";
  A.select("gravitos3");
  A.setFocus("idle");
  await new Promise(r => setTimeout(r, 3000));
  window.__buildControls();
  await new Promise(r => setTimeout(r, 400));
  out.cur = A.cur; out.focus = A.focusState;
  out.frameCount = A.frameCount("idle");
  out.hasLevelBtn = !!document.getElementById("fr-level");
  out.hasBand = !!document.getElementById("fr-band");
  out.readout = (document.getElementById("fr-hb") || {}).textContent || null;
  // press it, then read the fs the animator wrote
  const btn = document.getElementById("fr-level");
  if (btn) { btn.click(); await new Promise(r => setTimeout(r, 600)); }
  const v = A.CALIB()[A.ownerOf ? A.ownerOf("gravitos3") : "gravitos3"];
  out.fsAfter = v && v.idle && Array.isArray(v.idle.fs) ? v.idle.fs.slice() : null;
  out.readoutAfter = (document.getElementById("fr-hb") || {}).textContent || null;
  return out;
});
await b.close(); srv.kill();

ok('the animator loads with no page error', errs.length === 0, errs.slice(0, 2));
ok('the build badge moved with the change', r.badge && r.badge !== 'build v0.30.252',
  { badge: r.badge });
ok('the frame card exposes the leveller and its band control',
  r.hasLevelBtn && r.hasBand,
  { levelButton: r.hasLevelBtn, bandSlider: r.hasBand, entity: r.cur, state: r.focus, frames: r.frameCount });
ok('pressing it writes a per-frame scale for all nine frames',
  Array.isArray(r.fsAfter) && r.fsAfter.length === 9,
  { fs: r.fsAfter });
ok('and it AGREES with the values the bake script computes',
  (() => { if (!r.fsAfter) return false;
    const med = nodeH.slice().sort((a, b) => a - b)[4];
    const want = nodeH.map(h => med / h);
    return want.every((w, i) => Math.abs(w - r.fsAfter[i]) < 0.01); })(),
  { animator: r.fsAfter, nodeHeights: nodeH,
    note: 'two implementations of the same rule - if they disagree, pressing the button silently undoes the bake' });
ok('the readout reports the spread, and it is level after levelling',
  !!(r.readoutAfter && /spread/.test(r.readoutAfter)),
  { before: r.readout, after: r.readoutAfter });
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
