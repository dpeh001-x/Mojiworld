// TALENT ART IN POP PUNK (v0.30.x talent-pop). Per user: "make Sprites/talents more pop punk style as well" (icons and the
// card backdrops). The 78 icons were redrawn with a thick black ink outline and flat glossy cel colour, each subject in its
// own colours; the 27 card plates as pop-punk comic landscapes of the same scenes. The white sticker rim is
// talent_rim_test.mjs's job (run it too).
//   node scripts/talent_pop_test.mjs            (PORT / MOJI_GAME_FILE; TALENT_ART_DIR=<dir> to check staged art)
//   icons   - all 78 present at 256, each with an INK BAND: >= 80% of the art within 5 px of its edge is near-black
//             (the old painted icons: median 38%, none above 79%)
//   plates  - all 27 present at 512 x 384 and opaque; as a set, crisp comic edges (median strong-edge share >= 0.13;
//             the old painterly plates: 0.09)
//   in game - the job and master pickers draw the new icons and plates
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const { analyse } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'normalize_talent_rims.mjs')).href);
const DIR = process.env.TALENT_ART_DIR ? path.resolve(process.env.TALENT_ART_DIR) : path.join(ROOT, 'Sprites', 'talents');
const PORT = process.env.PORT || '11491';
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info).slice(0, 400)}`); if (!ok) bad++; };
const table = (file, name) => { const s = fs.readFileSync(path.join(ROOT, 'scripts', file), 'utf8'); const a = s.indexOf(`const ${name} = {`), b = s.indexOf('\n};', a); return new Function('return ' + s.slice(a + `const ${name} = `.length, b + 2))(); };
const ICONS = Object.keys(table('generate_talent_icons.mjs', 'TALENT')), PLATES = Object.keys(table('generate_talent_backgrounds.mjs', 'BG'));
async function inkShare(buf) {   // share of near-black pixels among art pixels within 5 px of the art's edge (inside the rim)
  const { data, W, H, core } = await analyse(buf); const N = W * H, band = new Uint8Array(N); let frontier = [];
  for (let i = 0; i < N; i++) if (core[i]) { const x = i % W, y = (i / W) | 0; if (!x || !y || x === W - 1 || y === H - 1 || !core[i - 1] || !core[i + 1] || !core[i - W] || !core[i + W]) { band[i] = 1; frontier.push(i); } }
  for (let d = 1; d < 5; d++) { const nf = []; for (const i of frontier) for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && core[j] && !band[j]) { band[j] = 1; nf.push(j); } frontier = nf; }
  let n = 0, dark = 0; for (let i = 0; i < N; i++) if (band[i]) { n++; const o = i * 4; if (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2] < 60) dark++; }
  return n ? dark / n : 0;
}
async function crisp(buf) {   // share of pixels with a strong Sobel edge at 256 x 192
  const { data, info } = await sharp(buf).removeAlpha().resize(256, 192, { fit: 'cover' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const p = (dx, dy) => data[(y + dy) * W + x + dx];
    const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1), gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
    if (Math.hypot(gx, gy) > 120) n++; }
  return n / ((W - 2) * (H - 2));
}
// icons
const ink = [], sizeBad = [], missing = [];
for (const id of ICONS) {
  const f = path.join(DIR, id + '.webp'); if (!fs.existsSync(f)) { missing.push(id); continue; }
  const buf = fs.readFileSync(f), m = await sharp(buf).metadata(); if (m.width !== 256 || m.height !== 256) sizeBad.push(id);
  ink.push([id, await inkShare(await sharp(buf).png().toBuffer())]);
}
check(ICONS.length === 78 && !missing.length && !sizeBad.length, `all ${ICONS.length} talent icons are present at 256 x 256`, { missing, sizeBad });
const weak = ink.filter(([, s]) => s < 0.8).map(([id, s]) => id + ' ' + s.toFixed(2));
check(!weak.length, `every icon has the pop-punk ink band (>= 80% near-black at its edge; min ${Math.min(...ink.map((x) => x[1])).toFixed(2)})`, weak.slice(0, 8));
// plates
const pmiss = [], pbad = [], cr = [];
for (const id of PLATES) {
  const f = path.join(DIR, 'bg', id + '.webp'); if (!fs.existsSync(f)) { pmiss.push(id); continue; }
  const { data, info } = await sharp(fs.readFileSync(f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let holes = 0; for (let i = 3; i < data.length; i += 4) if (data[i] < 250) holes++;
  if (info.width !== 512 || info.height !== 384 || holes) pbad.push(`${id} ${info.width}x${info.height} holes ${holes}`);
  cr.push(await crisp(fs.readFileSync(f)));
}
cr.sort((a, b) => a - b); const med = cr.length ? cr[Math.floor(cr.length / 2)] : 0;
check(PLATES.length === 27 && !pmiss.length && !pbad.length, `all ${PLATES.length} card plates are present, 512 x 384 and opaque`, { pmiss, pbad });
check(med >= 0.13, `the plates are crisp comic art, not soft painting (median strong-edge share ${med.toFixed(3)} >= 0.13)`);
// in game
if (!process.env.TALENT_ART_DIR) {
  const { chromium } = require('playwright-core');
  const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
  const errs = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })).newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction(() => typeof openTalentPick === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
    for (const tier of ['berserker', 'warlord']) {
      const r = await page.evaluate(async (tier) => {
        for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'story-beat-overlay']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.remove('on'); } }
        window._lxBootGateDone = true; try { closeAllModals(); } catch (e) {} openTalentPick(tier); await new Promise((s) => setTimeout(s, 1500));
        const imgs = [...document.querySelectorAll('img[src*="Sprites/talents/"]')].filter((i) => i.offsetParent);
        const bgs = [...document.querySelectorAll('*')].map((e) => e.style && e.style.backgroundImage).filter((b) => b && b.includes('Sprites/talents/bg/'));
        const plate = (b) => new Promise((res) => { const u = b.match(/Sprites\/talents\/bg\/[a-z_]+\.webp/)[0]; const im = new Image(); im.onload = () => res(im.naturalWidth); im.onerror = () => res(0); im.src = u; });
        return { icons: imgs.map((i) => [i.getAttribute('src'), i.complete ? i.naturalWidth : -1]), plates: await Promise.all(bgs.map(plate)) };
      }, tier);
      check(r.icons.length === 3 && r.icons.every((x) => x[1] === 256) && r.plates.length >= 3 && r.plates.every((w) => w === 512), `${tier} picker: three new icons and their plates load`, r);
    }
  } finally { await browser.close(); srv.kill(); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
}
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
