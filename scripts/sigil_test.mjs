// v0.30.x — The celestial sigil: the star portals and the Sanctum mark share one baked renderer.
//   node scripts/sigil_test.mjs [file.html] [port] [shot_prefix]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11315);
const SHOT = process.argv[4] || '';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Sigil');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

// count gold / violet / white pixels in a box of the game canvas (canvas-space)
const sample = async (bx, by, bw, bh) => page.evaluate(([bx, by, bw, bh]) => {
  const cv = document.getElementById('game');
  const c = cv.getContext('2d');
  const dpr = cv.width / (typeof W === 'number' ? W : 960);
  const d = c.getImageData(Math.round(bx * dpr), Math.round(by * dpr), Math.round(bw * dpr), Math.round(bh * dpr)).data;
  let gold = 0, violet = 0, white = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (r > 200 && g > 160 && b < 150 && r - b > 80) gold++;
    else if (b > 170 && r > 120 && b - g > 40) violet++;
    else if (r > 235 && g > 235 && b > 235) white++;
  }
  return { gold, violet, white, px: d.length / 4 };
}, [bx, by, bw, bh]);

const crop = async (file, bx, by, bw, bh) => { const url = await page.evaluate(([bx, by, bw, bh]) => { const cv = document.getElementById('game'); const dpr = cv.width / (typeof W === 'number' ? W : 960); const o = document.createElement('canvas'); o.width = bw * 3; o.height = bh * 3; const c = o.getContext('2d'); c.imageSmoothingEnabled = true; c.drawImage(cv, bx * dpr, by * dpr, bw * dpr, bh * dpr, 0, 0, o.width, o.height); return o.toDataURL('image/png'); }, [bx, by, bw, bh]); require('fs').writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); };
const r = await page.evaluate(async () => {
  const out = {};
  { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; } }
  out.helper = typeof _drawCelestialSigil === 'function' && typeof _lxSigilBake === 'function';
  // the star portal: the Void's ⭐ Everdawn Central sits at x 400, feet 480 -> centre ~420
  try { loadMap('void', 300); } catch (e) { out.loadErr = String(e.message); }
  game.paused = false;
  await new Promise((res) => setTimeout(res, 600));
  const po = (game.portals || []).find((p) => p.iconStar);
  out.portal = !!po;
  out.px = po ? po.x - game.camera.x : null; out.py = 420;
  out.bakes = (typeof _LX_SIGIL_BAKES !== 'undefined') ? Object.keys(_LX_SIGIL_BAKES).length : 0;
  return out;
});
const star = r.portal ? await sample(r.px - 60, r.py - 60, 120, 120) : null;
if (SHOT && r.portal) await crop(SHOT + '_star.png', r.px - 70, r.py - 70, 140, 140);
// the Sanctum mark: The Amnesiac in town at x 1757; the mark floats at screen y ~200
const a = await page.evaluate(async () => {
  const out = {};
  try { loadMap('town', 1757); } catch (e) { out.loadErr = String(e.message); }
  game.paused = false;
  await new Promise((res) => setTimeout(res, 600));
  const npc = (game.npcs || []).find((n) => n.role === 'amnesiac');
  out.npc = !!npc;
  out.cx = npc ? npc.x - game.camera.x : null; out.cy = 200;
  return out;
});
const tri = a.npc ? await sample(a.cx - 60, a.cy - 60, 120, 120) : null;
if (SHOT && a.npc) await crop(SHOT + '_tri.png', a.cx - 70, a.cy - 110, 140, 180);
console.log(JSON.stringify({ ...r, star, ...a, tri }));
const checks = [
  ['the shared sigil renderer exists', r.helper === true],
  ['the Void star portal is on screen', r.portal === true && r.px > 60 && r.px < 900, `px ${r.px}`],
  ['the star portal is drawn with gold detail (ring, ticks, inlay)', !!star && star.gold > 200, star && `gold ${star.gold}`],
  ['...and the violet glass body', !!star && star.violet > 40, star && `violet ${star.violet}`],
  ['the Amnesiac is on screen', a.npc === true, `cx ${a.cx}`],
  ['the Sanctum mark carries the gold ring', !!tri && tri.gold > 25, tri && `gold ${tri.gold}`],
  ['the layers were baked once (not path-drawn per frame)', r.bakes >= 4, `bakes ${r.bakes}`],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
