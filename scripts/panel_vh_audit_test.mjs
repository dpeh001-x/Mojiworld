// vh-cap audit: class-select / jukebox / backup. Follow-up to the U-panel
// truncation (v0.29.673) — "the other panels carry similar raw-vh caps".
//
// Measured before changing anything, and the audit split them:
//   class-select  ×1.5 INSIDE the scaled wrapper — its raw 94vh cap resolved
//                 to ~141% of the overlay: a LATENT U-panel bug, masked only
//                 because today's content stays under the overlay height.
//   jukebox       scale 1.0, OUTSIDE the wrapper — raw vh is CORRECT there;
//   backup        "dividing" these would have INTRODUCED truncation.
//
// So only class-select changes, and the guard here is a content-growth stress:
// inflate the panel and prove it caps on screen and scrolls, instead of
// silently growing past the frame the way the U-panel did.
//   node scripts/panel_vh_audit_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const allErrs = [];

const run = async (w, h) => {
  const page = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  page.on('pageerror', e => allErrs.push(w + 'x' + h + ': ' + String(e).slice(0, 120)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof openJukebox === 'function' && typeof openBackupModal === 'function', { timeout: 120000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const info = (el, scroller) => {
      if (!el) return null;
      const r2 = el.getBoundingClientRect();
      const sc = scroller || el;
      return { top: Math.round(r2.top), bottom: Math.round(r2.bottom),
        scale: Math.round((r2.height / (el.offsetHeight || 1)) * 100) / 100,
        maxHpx: parseFloat(getComputedStyle(el).maxHeight) || null,
        fits: r2.top >= -1 && r2.bottom <= innerHeight + 1,
        canScroll: sc.scrollHeight > sc.clientHeight + 1 };
    };
    const out = { vh: innerHeight };

    // --- class select: normal, then STRESSED with tall filler content ------
    const cs = document.getElementById('class-select-modal');
    const ep = document.querySelector('#class-select-modal .cs-epic');
    cs.style.display = 'flex';
    await new Promise(r2 => setTimeout(r2, 150));
    out.classSelect = info(ep);
    const filler = document.createElement('div');
    filler.id = '_vh_stress'; filler.style.cssText = 'height:900px;flex:0 0 auto;';
    ep.appendChild(filler);
    await new Promise(r2 => setTimeout(r2, 100));
    const stressed = info(ep);
    ep.scrollTop = 1e9;
    await new Promise(r2 => setTimeout(r2, 50));
    stressed.scrolled = ep.scrollTop;
    stressed.fillerReachable = filler.getBoundingClientRect().bottom <= innerHeight + 2;
    filler.remove(); ep.scrollTop = 0;
    out.classStress = stressed;
    cs.style.display = 'none';

    // --- jukebox (unscaled; must stay healthy exactly as it is) ------------
    player.cls = 'warrior'; game.paused = false;
    try { openJukebox(); } catch (e) { out.jukeErr = String(e).slice(0, 80); }
    await new Promise(r2 => setTimeout(r2, 150));
    const jm = document.getElementById('jukebox-modal');
    const jScroller = jm ? [...jm.querySelectorAll('*')].find(n => { const s2 = getComputedStyle(n); return /auto|scroll/.test(s2.overflowY) && n.scrollHeight > 40; }) : null;
    out.jukebox = info(jm, jScroller);
    try { closeJukebox(); } catch (e) {}

    // --- backup -------------------------------------------------------------
    try { openBackupModal(); } catch (e) { out.backupErr = String(e).slice(0, 80); }
    await new Promise(r2 => setTimeout(r2, 150));
    out.backup = info(document.getElementById('backup-modal'));
    try { const bg = document.getElementById('backup-modal-bg'); if (bg) bg.classList.remove('on'); } catch (e) {}
    return out;
  });
  await page.close();
  return r;
};

const a = await run(1600, 838);
const c = await run(1366, 728);
await b.close(); try { srv.kill(); } catch (e) {}

for (const [tag, r] of [['1600x838', a], ['1366x728', c]]) {
  console.log(`--- ${tag} ---`);
  console.log('classSelect:', JSON.stringify(r.classSelect));
  console.log('classStress:', JSON.stringify(r.classStress));
  console.log('jukebox    :', JSON.stringify(r.jukebox));
  console.log('backup     :', JSON.stringify(r.backup));

  ok(tag + ': class select really is inside the scaled wrapper (test tests the right thing)',
     r.classSelect.scale >= 1.1, { scale: r.classSelect.scale });
  ok(tag + ': class-select cap now fits its overlay (was 141% of it)',
     r.classSelect.maxHpx !== null && r.classSelect.maxHpx * r.classSelect.scale <= r.vh + 6,
     { capCss: r.classSelect.maxHpx, scale: r.classSelect.scale, vh: r.vh });
  ok(tag + ': class select sits fully on screen', r.classSelect.fits === true, r.classSelect);
  ok(tag + ': STRESSED class select still fits on screen (the latent U-panel failure)',
     r.classStress.fits === true, r.classStress);
  ok(tag + ': ...and scrolls to the injected bottom instead of clipping it',
     r.classStress.canScroll === true && r.classStress.scrolled > 0 && r.classStress.fillerReachable === true, r.classStress);

  ok(tag + ': jukebox is UNSCALED — its raw vh cap is correct, left alone',
     r.jukebox.scale === 1 && r.jukebox.fits === true, r.jukebox);
  ok(tag + ': jukebox track list still scrolls', r.jukebox.canScroll === true, r.jukebox);
  ok(tag + ': backup is unscaled, fits, left alone', r.backup.scale === 1 && r.backup.fits === true, r.backup);
}
ok('no page errors', allErrs.length === 0, allErrs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
