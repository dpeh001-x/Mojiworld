// The Pincer (monster type 'scorpion') grows no antennas (v0.30.x pincer-antennas).
//   node scripts/pincer_antenna_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "the monster "pincer" is growing antennas out of nowhere, ensure he does not grow antennas".
// Reads the frames on disk (what the game serves) and then loads them through the game's own loader.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10395';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const rel = (st, i) => `Sprites/monsters/${st}/scorpion_${i}.webp`;
const rawOf = async (buf) => { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; };
// the space above the head where the antennas grew (source pixels)
const ZONE = { x0: 440, x1: 575, y0: 180, y1: 261 };
const zoneInk = ({ data, W }) => { let n = 0; for (let y = ZONE.y0; y <= ZONE.y1; y++) for (let x = ZONE.x0; x <= ZONE.x1; x++) if (data[(y * W + x) * 4 + 3] > 40) n++; return n; };

// ---------- the art on disk ----------
const inked = [];
for (const st of ['idle', 'walk', 'attack']) for (let i = 0; i < 9; i++) {
  if (st === 'attack' && i >= 5 && i <= 7) continue;   // the sting swings over the head here, with its gold slash - tail, not antennas
  const n = zoneInk(await rawOf(readFileSync(path.join(ROOT, rel(st, i)))));
  if (n) inked.push(`${st} ${i}: ${n} px`);
}
console.log(`ink above the head: ${inked.length ? inked.join(', ') : 'none'}`);
check(inked.length === 0, 'no Pincer frame has anything growing above its head (24 frames; attack 5-7 swing the sting through that space)', inked);

const bboxOf = ({ data, W, H }) => {   // exactly scripts/gen_sprite_bbox.mjs
  const A = (x, y) => data[(y * W + x) * 4 + 3];
  let bot = H - 1; outer: for (let y = H - 1; y >= 0; y--) { let run = 0; for (let x = 0; x < W; x++) { if (A(x, y) > 64) { if (++run >= 2) { bot = y; break outer; } } else run = 0; } }
  let top = 0; outer2: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 12) { top = y; break outer2; }
  return [top, bot, W, H].join(',');
};
const bboxTable = readFileSync(path.join(ROOT, 'data', 'sprite_bbox.js'), 'utf8');
const edgesTable = readFileSync(path.join(ROOT, 'data', 'sprite_edges.js'), 'utf8');
let before = null;
try { before = { 5: execFileSync('git', ['show', 'origin/main:' + rel('idle', 5)], { cwd: ROOT, maxBuffer: 1 << 24 }), 6: execFileSync('git', ['show', 'origin/main:' + rel('idle', 6)], { cwd: ROOT, maxBuffer: 1 << 24 }) }; } catch (e) {}
for (const i of [5, 6]) {
  const now = await rawOf(readFileSync(path.join(ROOT, rel('idle', i))));
  const key = `monsters/idle/scorpion_${i}.webp`;
  const row = (bboxTable.match(new RegExp(`"${key.replace(/[./]/g, (c) => '\\' + c)}":"([^"]*)"`)) || [])[1];
  check(row === bboxOf(now), `idle ${i}: its bounds are still the ones data/sprite_bbox.js records (${row}) - nothing to regenerate`, { table: row, now: bboxOf(now) });
  const edge = (edgesTable.match(new RegExp(`"${key.replace(/[./]/g, (c) => '\\' + c)}":"([^"]*)"`)) || [])[1];
  let border = 0; for (let x = 0; x < now.W; x++) for (const y of [0, now.H - 1]) if (now.data[(y * now.W + x) * 4 + 3] > 8) border++;
  for (let y = 0; y < now.H; y++) for (const x of [0, now.W - 1]) if (now.data[(y * now.W + x) * 4 + 3] > 8) border++;
  check(edge === '' && border === 0, `idle ${i}: no edge is cut, as data/sprite_edges.js records`, { edge, border });
  // the cut stayed where the antennas were: everywhere else is the original frame within re-encode noise
  if (before) {
    const was = await rawOf(before[i]); let n = 0, sum = 0; const ds = [];
    for (let y = 0; y < now.H; y++) for (let x = 0; x < now.W; x++) {
      if (x >= 425 && x <= 600 && y >= 190 && y <= 320) continue;
      const o = (y * now.W + x) * 4; if (!was.data[o + 3] && !now.data[o + 3]) continue;
      let d = 0; for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(was.data[o + k] - now.data[o + k])); ds.push(d); sum += d; n++;
    }
    ds.sort((p, q) => p - q); const mean = sum / Math.max(1, n), p999 = ds[Math.floor(n * 0.999)] || 0;
    check(mean < 2.5 && p999 <= 20, `idle ${i}: outside the antennas the frame is the original (mean ${mean.toFixed(2)}/255, 99.9th pct ${p999} - re-encode noise; the squint, tail and legs as painted)`, { mean, p999 });
  }
}
const sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/^const CACHE = 'mojiworld-assets-v\d+';[^\n]*Pincer/m.test(sw), 'sw.js moved its cache generation for the replaced frames, so a returning browser drops the antennas', (sw.match(/^const CACHE[^\n]*/m) || [])[0]);

// ---------- in the game ----------
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const TBL = path.join(process.env.TEMP || '', 'gs_tables');
  if (existsSync(TBL)) await page.route((u) => /data[/]sprite_(bbox|edges|frame_index)[.]js/.test(u.pathname), (r) => { try { r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(path.join(TBL, r.request().url().split('/').pop().split('?')[0])) }); } catch (e) { r.continue(); } });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _monsterFramesFor === 'function', null, { timeout: 120000 });
  const g = await page.evaluate(async (Z) => {
    const set = _monsterFramesFor('scorpion');
    const t0 = performance.now();
    while (performance.now() - t0 < 20000 && !(set.idle && set.idle.length >= 9 && [5, 6].every((i) => set.idle[i] && (set.idle[i].naturalWidth > 0 || set.idle[i].width > 0)))) await new Promise((r) => setTimeout(r, 100));
    const out = { n: set.idle ? set.idle.length : 0, frames: {} };
    for (const i of [5, 6]) {
      // the ORIGINAL decoded image the loader fetched (a shrunk bake keeps the same picture, smaller)
      const src = set.idle[i] && set.idle[i].src ? set.idle[i].src : 'Sprites/monsters/idle/scorpion_' + i + '.webp';
      const img = new Image(); img.src = src; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
      const d = c.getImageData(Z.x0, Z.y0, Z.x1 - Z.x0 + 1, Z.y1 - Z.y0 + 1).data; let ink = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 40) ink++;
      out.frames[i] = { w: img.naturalWidth, h: img.naturalHeight, ink, src: String(src).split('/').slice(-3).join('/') };
    }
    return out;
  }, ZONE);
  console.log(`\nin the game: idle frames ${g.n}  ${JSON.stringify(g.frames)}`);
  check(g.n === 9 && [5, 6].every((i) => g.frames[i].w === 768 && g.frames[i].h === 534), 'the game loads all nine idle frames, 5 and 6 at their authored 768x534', g);
  check([5, 6].every((i) => g.frames[i].ink === 0), 'the frames the game draws for idle 5 and 6 have nothing above the head', g.frames);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
