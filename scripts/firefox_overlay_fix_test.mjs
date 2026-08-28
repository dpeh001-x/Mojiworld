// Does the overlay teardown actually buy anything, in the state it targets?
// ============================================================================
// The title / character-select measurements do NOT exercise fix 1 at all: the
// overlay only carries .fade once the player has left the title screen, and
// the harness could not drive that far. So the fps figures quoted for the
// Gecko animation gate say nothing about the overlay teardown, and claiming
// them for it would be dishonest.
//
// This tests it directly instead of by argument: put the overlay into the
// exact state the fix targets — add .fade, which is what the game does — and
// measure the frame rate on each build in the same browser, then read back
// whether the layer is genuinely hidden and its animations genuinely stopped.
//
// On the baseline the overlay stays visibility:visible with lo-kenburns still
// running; on the patched build it should read hidden with animation none.
// That state check is the real assertion — the fps delta is the consequence.
// Run: LX_HEADED=1 node scripts/firefox_overlay_fix_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10961);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const measure = () => new Promise((done) => {
  const t0 = performance.now(); let n = 0;
  const tick = () => { n++; if (performance.now() - t0 < 3500) requestAnimationFrame(tick);
    else done(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
});
const FADE = () => {
  const ov = document.getElementById('loading-overlay');
  if (ov) ov.classList.add('fade');
  return !!ov;
};
const READ = () => {
  const ov = document.getElementById('loading-overlay');
  const bg = document.querySelector('#loading-overlay .lo-bg');
  const em = document.querySelector('#loading-overlay .lo-embers');
  if (!ov) return { overlay: 'absent' };
  const c = getComputedStyle(ov);
  return {
    visibility: c.visibility, opacity: c.opacity, display: c.display,
    bgAnim: bg ? getComputedStyle(bg).animationName : 'absent',
    emberAnim: em ? getComputedStyle(em).animationName : 'absent',
  };
};

const one = async (launch, file) => {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://localhost:${PORT}/${file}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(15000);
  await page.evaluate(FADE);
  await page.waitForTimeout(1400);           // let the 0.6s fade + delay land
  const fps = await page.evaluate(measure);
  const st = await page.evaluate(READ);
  await b.close();
  return { fps, st };
};

for (const [nm, launch] of [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: !process.env.LX_HEADED })],
                            ['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: !process.env.LX_HEADED })]]) {
  if (process.env.LX_FFONLY && nm !== 'FIREFOX') continue;
  console.log(`\n### ${nm}   (overlay put into .fade — the state fix 1 targets)`);
  for (const [label, file] of [['baseline v0.30.270', '_ffbase.html'], ['patched  v0.30.271', '_ffpatch.html']]) {
    try {
      const r = await one(launch, file);
      console.log(`  ${label}   ${String(r.fps).padStart(6)} fps   visibility=${r.st.visibility} opacity=${r.st.opacity}`
        + `   lo-bg anim=${r.st.bgAnim}  embers anim=${r.st.emberAnim}`);
    } catch (e) { console.log(`  ${label}: ${String(e.message).slice(0, 120)}`); }
  }
}
server.kill();
