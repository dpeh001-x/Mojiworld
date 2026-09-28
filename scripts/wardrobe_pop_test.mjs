// Live test: the Fashionista's wardrobe restyle (per user: "Fashionista wardrobe UI can be way way more POP and slightly
// grandiose and elegant"). Checked on the open wardrobe at 1920x1080 and 1280x720:
//   * the pop block is loaded, the panel wears Nunito, a gold double frame and a berry slab
//   * the title is the marquee (butter letters, ink outline, on a ribbon)
//   * the mirror fills its column (it used to stop at half height) and carries a ring of lamps that is NOT blurred
//     (the old pseudo was a blurred 160px orb - the leak this pass had to reset)
//   * slots are sticker tiles; the open one is marked differently from the rest
//   * nothing overflows the viewport and every slot still clicks
//   node scripts/wardrobe_pop_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  for (const [vw, vh] of [[1920, 1080], [1280, 720]]) {
    const page = await (await b.newContext({ viewport: { width: vw, height: vh }, serviceWorkers: 'block' })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof openCharStudio === 'function' && typeof loadMap === 'function', null, { timeout: 120000 });
    await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((z) => setTimeout(z, ms));
      try { _lxBootGateDone = true; } catch (e) {} try { _lxBootHold.release('menu'); } catch (e) {}
      ['loading-overlay', 'lo-menu'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
      try { if (!player.cls) applyClass('warrior'); } catch (e) {}
      player.mojicoins = 99999; loadMap('town'); await wait(2000);
      _csGrantWardrobe(); openCharStudio(); await wait(2500);
      document.documentElement.classList.remove('lx-nobackdrop');   // headless trips low-fx, which strips box-shadows
      await wait(400);   // ...and bringing them back runs the tiles' 0.14 s shadow transition from none: read after it
      const ov = document.getElementById('char-studio-overlay'), panel = ov.querySelector('.char-studio-panel');
      const cs = (el, pseudo) => getComputedStyle(el, pseudo || null);
      const pv = ov.querySelector('.wardrobe-preview'), grid = ov.querySelector('#wardrobe-grid'), h2 = panel.querySelector('h2');
      const pr = pv.getBoundingClientRect(), gr = grid.getBoundingClientRect(), lay = ov.querySelector('.wardrobe-layout').getBoundingClientRect(), pan = panel.getBoundingClientRect();
      const slots = [...ov.querySelectorAll('.wardrobe-slot')];
      const act = slots.find((s) => s.classList.contains('active')), idle = slots.find((s) => !s.classList.contains('active'));
      // read the tiles BEFORE clicking: a click rebuilds the grid, leaving these elements stale. The game's perf governor
      // can re-toggle lx-nobackdrop, restarting the 0.14 s shadow transition from none: switch it off on the two we read.
      for (const t of [act, idle]) if (t) t.style.transition = 'none';
      document.documentElement.classList.remove('lx-nobackdrop'); void panel.offsetWidth;
      const tiles = { slotBorder: idle ? cs(idle).borderTopWidth + ' ' + cs(idle).borderTopColor : null, slotBg: idle ? cs(idle).backgroundImage.slice(0, 40) : null,
        activeShadow: act ? cs(act).boxShadow : null, idleShadow: idle ? cs(idle).boxShadow : null };
      // click every slot: each must open its picker without an error
      let clicked = 0; for (const s of slots) { try { s.click(); clicked++; } catch (e) {} await wait(40); }
      return {
        block: !!document.getElementById('lx-wardrobe-pop'), font: cs(panel).fontFamily.split(',')[0].replace(/"/g, ''),
        frame: cs(panel).boxShadow, h2color: cs(h2).color, h2filter: cs(h2).filter, ribbon: cs(h2, '::before').backgroundImage,
        mirrorH: Math.round(pr.height), layH: Math.round(lay.height), gridH: Math.round(gr.height),
        lamps: { style: cs(pv, '::before').borderTopStyle, w: cs(pv, '::before').borderTopWidth, filter: cs(pv, '::before').filter, width: cs(pv, '::before').width },
        ...tiles,
        apply: cs(document.getElementById('char-studio-apply')).backgroundImage.slice(0, 30),
        inView: pan.top >= -1 && pan.left >= -1 && pan.bottom <= innerHeight + 1 && pan.right <= innerWidth + 1, pan: [Math.round(pan.top), Math.round(pan.bottom), innerHeight],
        slots: slots.length, clicked,
      };
    });
    const tag = `${vw}x${vh}`;
    ok(`${tag}: the pop block is loaded and the panel wears Nunito`, r.block && r.font === 'Nunito', r.font);
    ok(`${tag}: a gold double frame with a berry slab`, /245, 201, 90/.test(r.frame) && /217, 70, 127/.test(r.frame), r.frame.slice(0, 160));
    ok(`${tag}: the marquee title - butter letters, an ink outline, on a ribbon`, /255, 224, 122/.test(r.h2color) && (r.h2filter.match(/drop-shadow/g) || []).length >= 5 && /gradient/.test(r.ribbon), r);
    ok(`${tag}: the mirror fills its column (it stopped at half height)`, r.mirrorH >= r.layH - 4, { mirror: r.mirrorH, layout: r.layH });
    ok(`${tag}: a ring of lamps round the mirror, sharp (the old blurred orb is reset)`, r.lamps.style === 'dotted' && parseFloat(r.lamps.w) >= 4 && !/blur/.test(r.lamps.filter) && r.lamps.width !== '160px', r.lamps);
    ok(`${tag}: slots are sticker tiles (ink edge, blush gradient)`, parseFloat(r.slotBorder) >= 2 &&   /* Chrome snaps 2.5px to whole device px */ /13, 10, 20/.test(r.slotBorder) && /gradient/.test(r.slotBg), r.slotBorder);
    ok(`${tag}: the open slot is lit differently from the rest`, r.activeShadow && r.activeShadow !== r.idleShadow && /255, 47, 134/.test(r.activeShadow), r.activeShadow);
    ok(`${tag}: Use in game is a gold ticket`, /gradient/.test(r.apply), r.apply);
    ok(`${tag}: the wardrobe fits the window`, r.inView, r.pan);
    ok(`${tag}: every slot still clicks`, r.slots >= 10 && r.clicked === r.slots && errs.length === 0, { slots: r.slots, clicked: r.clicked, errs });
    await page.close();
  }
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== WARDROBE POP ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
