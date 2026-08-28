// Baseline vs patched — with the order effect controlled out.
// ============================================================================
// The first verification ran both builds in one browser session and was
// worthless: whichever build ran SECOND measured ~2.5x faster, in BOTH engines
// and in BOTH orders (patched 68.4 vs baseline 25.2 when patched ran second;
// baseline 48.1 vs patched 19.1 when baseline ran second). Warm cache, warm
// JIT and already-decoded sprites dwarfed the change being tested.
//
// So: a FRESH BROWSER per measurement, nothing shared, and the two builds
// alternated across repetitions so any residual drift in machine load falls on
// both equally. Every sample is printed, not just the summary — if the spread
// is wide the reader can see that rather than trusting an average.
// Run: LX_HEADED=1 node scripts/firefox_verify_fix2.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10951);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const REPS = Number(process.env.LX_REPS || 2);

const measure = () => new Promise((done) => {
  const t0 = performance.now(); let n = 0;
  const tick = () => { n++; if (performance.now() - t0 < 3500) requestAnimationFrame(tick);
    else done(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
});
const STATE = () => {
  const rays = document.querySelector('.cs-rays');
  const ov = document.getElementById('loading-overlay');
  return { rays: rays ? getComputedStyle(rays).animationName : 'absent',
           vis: ov ? getComputedStyle(ov).visibility : 'absent',
           faded: ov ? ov.classList.contains('fade') : null };
};

const one = async (launch, file) => {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://localhost:${PORT}/${file}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(16000);
  const title = await page.evaluate(measure);
  await page.click('#menu-newgame', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1600);
  await page.keyboard.type('FoxTest').catch(() => {});
  await page.click('#auth-submit', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const charsel = await page.evaluate(measure);
  const st = await page.evaluate(STATE);
  await b.close();
  return { title, charsel, st };
};

const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[b.length >> 1] : +(((b[b.length / 2 - 1] + b[b.length / 2]) / 2)).toFixed(1); };

const drive = async (name, launch) => {
  const acc = { base: { title: [], charsel: [] }, patch: { title: [], charsel: [] } };
  let stB = null, stP = null;
  for (let r = 0; r < REPS; r++) {
    // Alternate which build goes first on each repetition.
    const order = r % 2 === 0 ? ['base', 'patch'] : ['patch', 'base'];
    for (const which of order) {
      const file = which === 'base' ? '_ffbase.html' : '_ffpatch.html';
      let res;
      try { res = await one(launch, file); } catch (e) { console.log(`  ${name} ${which} rep${r}: ${String(e.message).slice(0, 80)}`); continue; }
      acc[which].title.push(res.title);
      acc[which].charsel.push(res.charsel);
      if (which === 'base') stB = res.st; else stP = res.st;
    }
  }
  const pct = (a, b) => (!b ? 'n/a' : ((a / b - 1) * 100).toFixed(0) + '%');
  console.log(`\n### ${name}   (fresh browser per sample, order alternated, ${REPS} reps)`);
  for (const [label, key] of [['title screen', 'title'], ['character select', 'charsel']]) {
    const B = acc.base[key], P = acc.patch[key];
    if (!B.length || !P.length) { console.log(`  ${label}: insufficient samples`); continue; }
    console.log(`  ${label.padEnd(17)} baseline ${String(med(B)).padStart(6)} fps [${B.join(', ')}]`
      + `   patched ${String(med(P)).padStart(6)} fps [${P.join(', ')}]   ${pct(med(P), med(B))}`);
  }
  console.log(`  gate live?  baseline .cs-rays anim=${stB && stB.rays}    patched .cs-rays anim=${stP && stP.rays}`);
};

const list = [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: !process.env.LX_HEADED })]];
if (!process.env.LX_FFONLY) list.push(['CHROMIUM (control)', () => chromium.launch({ channel: 'msedge', headless: !process.env.LX_HEADED })]);
for (const [nm, launch] of list) await drive(nm, launch).catch((e) => console.log(`${nm}: ${String(e.message).slice(0, 160)}`));
server.kill();
