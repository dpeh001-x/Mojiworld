// U-panel (attributes) must FIT the screen and scroll internally.
//
// Tester: "Some of the item windows are truncated from the bottom. I tried to
// resize the screen but it is still truncated."
//
// Root cause: openLevelUpPanel set an INLINE maxHeight of '88vh'. The panel
// lives inside the transform-scaled .game-wrapper, where vh is a PRE-scale
// unit — at scale 1.5 the box rendered ~1003 device px on an 838 px viewport,
// clipped top AND bottom, and overflow-y:auto never engaged because the
// content (669 px) was under the 737 px cap. Resizing just rescales, which is
// exactly why the tester couldn't fix it. Same bug class the dev console fixed
// with `calc(94vh / var(--game-scale, 1))`.
//
// Asserts at two common viewports: the modal sits fully on screen, and the
// whole Items pane — last grid row AND the consumables strip — is reachable
// with the panel's own scrollbar.
//   node scripts/u_panel_fit_test.mjs [port]
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

const measure = async (w, h) => {
  const page = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  page.on('pageerror', e => allErrs.push(w + 'x' + h + ': ' + String(e).slice(0, 120)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof openLevelUpPanel === 'function' && typeof player === 'object', { timeout: 120000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    player.cls = 'archer'; game.paused = false;
    const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
    player.inventory = player.inventory || [];
    for (let i = 0; i < 60 && player.inventory.length < 40; i++) {
      try { const it = rollItemDrop(3, 30); if (it) player.inventory.push(it); } catch (e) {}
    }
    game._uTab = 'items';
    openLevelUpPanel();
    await new Promise(r2 => setTimeout(r2, 300));
    const modal = document.querySelector('#attributes-modal .modal');
    const grid = document.getElementById('u-inv-grid');
    const cons = document.getElementById('u-consumables');
    const mr = modal.getBoundingClientRect();
    const out = {
      slots: grid ? grid.children.length : 0,
      modalTop: Math.round(mr.top), modalBottom: Math.round(mr.bottom), vh: innerHeight,
      fits: mr.top >= -1 && mr.bottom <= innerHeight + 1,
      scrollable: modal.scrollHeight > modal.clientHeight + 1,
      inlineMaxH: modal.style.maxHeight,
    };
    modal.scrollTop = 1e9;
    await new Promise(r2 => setTimeout(r2, 100));
    out.scrolled = modal.scrollTop;
    out.gridBottomReachable = grid ? grid.getBoundingClientRect().bottom <= innerHeight + 1 : null;
    out.consumablesReachable = cons ? cons.getBoundingClientRect().bottom <= innerHeight + 1 : null;
    modal.scrollTop = 0;
    return out;
  });
  await page.close();
  return r;
};

const a = await measure(1600, 838);   // the tester's screenshot geometry
const c = await measure(1366, 728);   // common small laptop
await b.close(); try { srv.kill(); } catch (e) {}

console.log('1600x838:', JSON.stringify(a));
console.log('1366x728:', JSON.stringify(c));

ok('the panel grid rendered a full bag (test is testing something)', a.slots >= 30, { slots: a.slots });
ok('inline max-height is scale-aware, not raw vh', /var\(--game-scale/.test(a.inlineMaxH), { maxH: a.inlineMaxH });
ok('1600x838: the panel sits fully ON screen (was clipped both ends)', a.fits === true,
   { top: a.modalTop, bottom: a.modalBottom, viewport: a.vh });
ok('1600x838: the panel scrolls internally (content taller than the cap)', a.scrollable === true && a.scrolled > 0, a);
ok('1600x838: the LAST grid row is reachable by scrolling', a.gridBottomReachable === true, a);
ok('1600x838: the consumables strip below the grid is reachable too', a.consumablesReachable === true, a);
ok('1366x728: the panel sits fully on screen', c.fits === true, { top: c.modalTop, bottom: c.modalBottom, viewport: c.vh });
ok('1366x728: the last grid row is reachable', c.gridBottomReachable === true, c);
ok('1366x728: the consumables strip is reachable', c.consumablesReachable === true, c);
ok('no page errors', allErrs.length === 0, allErrs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
