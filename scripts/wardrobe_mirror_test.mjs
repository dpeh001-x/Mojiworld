// Live test: the Wardrobe's mirror, glamorous (per user: "The mirror preview on the left can be more glamorous too").
// On the open wardrobe at 1920x1080 and 1280x720:
//   * the mirror is dressed - curtains, tie-backs, a STARRING marquee, a crown, turning light rays - and none of it
//     takes a click
//   * the preview canvas is portrait and the hero in it is drawn larger (was ~158 CSS px from hair to feet)
//   * the hero stands on a podium drawn under the feet
//   * the marquee carries the hero's name; the crown and marquee stay clear of the WARDROBE title; the panel still fits
//   * the preview still follows a pick (a different hairstyle changes the drawing)
//   node scripts/wardrobe_mirror_test.mjs [port]   (MOJI_GAME_FILE honored)
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
      const w = (ms) => new Promise((z) => setTimeout(z, ms));
      try { _lxBootGateDone = true; } catch (e) {} try { _lxBootHold.release('menu'); } catch (e) {}
      ['loading-overlay', 'lo-menu'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
      try { if (!player.cls) applyClass('warrior'); } catch (e) {}
      player.mojicoins = 99999; if (!player.look) player.look = {}; player.look.name = 'Zelda';
      loadMap('town'); await w(2000); _csGrantWardrobe(); openCharStudio(); await w(2500);
      const ov = document.getElementById('char-studio-overlay'), pv = ov.querySelector('.wardrobe-preview'), cv = document.getElementById('char-studio-canvas');
      const q = (s) => pv.querySelector(s), cs = (e) => e ? getComputedStyle(e) : null;
      const deco = ['.lx-mirror-glass', '.lx-mirror-drape.lx-l', '.lx-mirror-drape.lx-r', '.lx-mirror-tie.lx-l', '.lx-mirror-tie.lx-r', '.lx-mirror-marquee', '.lx-mirror-crest', '.lx-mirror-rays'];
      const missing = deco.filter((s) => !q(s)), clickable = deco.filter((s) => q(s) && cs(q(s)).pointerEvents !== 'none' && !q(s).closest('.lx-mirror-glass'));
      // the hero's height in CSS px: top-most inked row down to the feet line
      const hero = () => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let top = cv.height;
        for (let y = 0; y < cv.height && top === cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 40) { top = y; break; }
        return top; };
      const cr = cv.getBoundingClientRect(), top = hero(), feet = cv.height * CHAR_STUDIO_VECTOR_PREVIEW_FEET_Y;
      const px = (x, y) => [...cv.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data];
      const podium = px(cv.width / 2 + cv.width * 0.22, feet + 2);   // off-centre, clear of the feet: the podium's satin top
      const sig = () => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 53) h = (h * 31 + d[i]) >>> 0; return h; };
      const title = ov.querySelector('h2').getBoundingClientRect(), mq = q('.lx-mirror-marquee'), cr2 = q('.lx-mirror-crest');
      const hit = (a, bb) => a && bb && !(a.right <= bb.left || a.left >= bb.right || a.bottom <= bb.top || a.top >= bb.bottom);
      const pan = ov.querySelector('.char-studio-panel').getBoundingClientRect();
      const s0 = sig(); CHAR_STUDIO.hairId = CHAR_STUDIO.hairId === 'bob' ? 'spiky' : 'bob'; await w(300); const s1 = sig();
      return { block: !!document.getElementById('lx-wardrobe-mirror'), missing, clickable, rays: mq ? cs(q('.lx-mirror-rays')).animationName : '',
        canvas: [cv.width, cv.height, Math.round(cr.width), Math.round(cr.height)], heroCss: Math.round((feet - top) * cr.height / cv.height), podium,
        name: (document.getElementById('lx-mirror-name') || {}).textContent || '', clear: !hit(mq && mq.getBoundingClientRect(), title) && !hit(cr2 && cr2.getBoundingClientRect(), title),
        fits: pan.top >= -1 && pan.bottom <= innerHeight + 1, follows: s0 !== s1 };
    });
    const tag = `${vw}x${vh}`;
    ok(`${tag}: the mirror block is loaded and the mirror is dressed (curtains, ties, marquee, crown, rays)`, r.block && r.missing.length === 0 && r.rays === 'lxMirRays', { missing: r.missing, rays: r.rays });
    ok(`${tag}: none of the decoration takes a click`, r.clickable.length === 0, r.clickable);
    ok(`${tag}: the preview canvas is portrait (384x540 shown at 220x309)`, r.canvas[0] === 384 && r.canvas[1] === 540 && r.canvas[2] === 220 && Math.abs(r.canvas[3] - 309) <= 1, r.canvas);
    ok(`${tag}: the hero is drawn larger (hair to feet at least 185 CSS px, was ~158)`, r.heroCss >= 185, r.heroCss);
    ok(`${tag}: the hero stands on a podium (pink satin under the feet)`, r.podium[3] > 200 && r.podium[0] > 150 && r.podium[1] < 150, r.podium);
    ok(`${tag}: the STARRING marquee carries the hero's name`, r.name === 'Zelda', r.name);
    ok(`${tag}: the crown and the marquee stay clear of the WARDROBE title, and the panel fits`, r.clear && r.fits, { clear: r.clear, fits: r.fits });
    ok(`${tag}: the preview still follows a pick (a new hairstyle redraws it)`, r.follows, r.follows);
    ok(`${tag}: no page errors`, errs.length === 0, errs);
    await page.close();
  }
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== WARDROBE MIRROR ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
