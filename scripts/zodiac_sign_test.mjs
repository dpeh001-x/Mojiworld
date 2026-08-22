// Live test: the ZODIAC SANCTUM marker — a small baked plaque sitting ABOVE a
// sigil whose centre is the Sanctum's triangle.
//   node scripts/zodiac_sign_test.mjs [port]   (MOJI_GAME_FILE honored)
//
// Three things are asserted, matching the three things asked for:
//   · the plaque is SMALLER than the old fixed 232x40, and sized from its own
//     text — a hardcoded width has to be re-guessed whenever the face or the
//     letter-spacing moves, and guessing low clips the title
//   · it is drawn ABOVE the sigil, not hanging under it
//   · the sigil is more than a bare triangle — ring, ray burst and vertex pips
//
// The pixel probes are expressed as fractions of the plaque's live width and
// height rather than as the literal coordinates the old version used, so a
// future resize does not silently start sampling background.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const src = readFileSync(GAME, 'utf8');
ok('the old stroked box is gone from the star draw path',
  !src.includes("ctx.strokeRect(cx - tw/2, cy + 22, tw, 14);") && src.includes('const _zs = _zodiacSignSprite();'), '');
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _zodiacSignSprite === 'function', null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const a = _zodiacSignSprite(), b2 = _zodiacSignSprite();
  const W = a.width, H = a.height;
  const c = a.getContext('2d');
  const px = (x, y) => Array.from(c.getImageData(Math.round(x), Math.round(y), 1, 1).data);

  // Ornament star: scan the left ornament block for any gold pixel.
  let gold = [0, 0, 0, 0];
  for (let y = H * 0.30; y <= H * 0.70 && !(gold[0] > 220); y++)
    for (let x = W * 0.04; x <= W * 0.26; x++) {
      // Thresholds are for a 4px star, not the old 5px one on a 40px plaque:
      // at this size the arms antialias against the violet body and peak at
      // about (211,176,98) rather than the full #ffd86a. Still unambiguously
      // gold - R well above B - but "> 220" was measuring full intensity, which
      // a 4px glyph never reaches.
      const q = px(x, y); if (q[0] > 195 && q[1] > 150 && q[2] < 150 && q[0] - q[2] > 80) { gold = q; break; }
    }
  const border = px(W * 0.03, H / 2);      // outer border, left edge (violet end)
  const body   = px(W / 2, H * 0.22);      // inside the body, above the text
  // Title band: count bright warm pixels across the middle row of the centre.
  let warm = 0;
  for (let x = W * 0.28; x < W * 0.72; x++) { const p = px(x, H / 2); if (p[0] > 200 && p[1] > 170 && p[3] > 200) warm++; }

  // How wide is the title itself? The plaque must be wider than its text or the
  // letters are being clipped by the very shrink this change made.
  const m = document.createElement('canvas').getContext('2d');
  m.font = 'bold 10px Georgia, "Times New Roman", serif';
  let tw = 0; for (const ch of 'ZODIAC SANCTUM') tw += m.measureText(ch).width + 1.6; tw -= 1.6;

  return { same: a === b2, w: W, h: H, gold, border, body, warm, textW: +tw.toFixed(1) };
});

// Drive the REAL draw to find where the plaque lands relative to the sigil.
// The halo blits at (cx-45, cy-45), so it gives us the sigil's centre; the sign
// canvas identifies itself. Reading the source expression instead would pass on
// a build where the draw never runs.
const pos = await page.evaluate(() => {
  loadMap('town');
  const npc = (game.npcs || []).find(n => n.role === 'amnesiac');
  if (!npc) return { err: 'no amnesiac NPC in town' };
  player.x = npc.x - 10; player.y = 400; game.camera.x = Math.max(0, npc.x - 400);
  const sign = _zodiacSignSprite(), halo = _getAmnesiacHaloCanvas();
  let signY = null, signH = 0, haloY = null;
  const orig = ctx.drawImage;
  ctx.drawImage = function (img, ...a) {
    if (img === sign) { signY = a[1]; signH = img.height; }
    else if (img === halo) { haloY = a[1]; }
    return orig.apply(this, [img, ...a]);
  };
  try { drawNPCs(); } catch (e) { return { err: String(e).slice(0, 140) }; }
  finally { ctx.drawImage = orig; }
  return { signY, signH, haloY, sigilCy: haloY == null ? null : haloY + 45 };
});

// The sigil itself: count what the mark is actually made of.
const sig = await page.evaluate(() => {
  loadMap('town');
  const npc = (game.npcs || []).find(n => n.role === 'amnesiac');
  if (!npc) return { err: 'no amnesiac NPC' };
  player.x = npc.x - 10; player.y = 400; game.camera.x = Math.max(0, npc.x - 400);
  let arcs = 0, strokes = 0, fills = 0, grads = 0;
  const oA = ctx.arc, oS = ctx.stroke, oF = ctx.fill, oG = ctx.createLinearGradient;
  ctx.arc = function (...a) { arcs++; return oA.apply(this, a); };
  ctx.stroke = function (...a) { strokes++; return oS.apply(this, a); };
  ctx.fill = function (...a) { fills++; return oF.apply(this, a); };
  ctx.createLinearGradient = function (...a) { grads++; return oG.apply(this, a); };
  try { drawNPCs(); } catch (e) { return { err: String(e).slice(0, 140) }; }
  finally { ctx.arc = oA; ctx.stroke = oS; ctx.fill = oF; ctx.createLinearGradient = oG; }
  return { arcs, strokes, fills, grads };
});

ok('the plaque bakes once (cached canvas)', r.same, { same: r.same });
ok('it is SMALLER than the old 232x40', r.w < 232 && r.h < 40, { w: r.w, h: r.h });
ok('and still wider than its own title — no clipped letters', r.w > r.textW + 20, { w: r.w, textW: r.textW });
ok('a gold star sits at the left ornament', r.gold[0] > 195 && r.gold[0] - r.gold[2] > 80, r.gold);
ok('the border edge is violet-tinted', r.border[2] > r.border[1] && r.border[3] > 120, r.border);
ok('the body is a dark violet, not black', r.body[2] > r.body[0] && r.body[2] > 30 && r.body[0] < 90, r.body);
ok('the title band carries cream/gold text pixels', r.warm > 20, r.warm);

ok('the plaque actually drew during drawNPCs', !pos.err && pos.signY != null, pos.err || pos);
ok('the sigil actually drew (halo found)', pos.haloY != null, pos);
ok('the plaque sits ABOVE the sigil',
  pos.signY != null && pos.sigilCy != null && (pos.signY + pos.signH) <= pos.sigilCy,
  { signBottom: pos.signY != null ? pos.signY + pos.signH : null, sigilCentre: pos.sigilCy });

// The arc and gradient counters were tried here first and DROPPED: they count
// the whole drawNPCs pass, so the rest of the town scene already supplies 14
// arcs and a gradient on the old build. They passed either way, which makes
// them decoration rather than checks. The stroke count does separate the two
// (3 before, 17 after), and the degenerate loop is asserted from source.
// Needle is the emblem's OWN radius line. The obvious choice - the
// `(i % 2 === 0) ? rOuter : rInner` alternation - also appears in an unrelated
// star draw elsewhere in the file, so it matched on both builds and reported a
// failure that was purely the test picking the wrong string.
ok('the old degenerate 3-vertex "8-point star" loop is gone',
  !src.includes('const rOuter = 16 * pulse;'), '');
ok('the sigil draws many stroked passes (rim, inlay, ring, ray burst)',
  !sig.err && sig.strokes >= 12, sig.err || sig);

ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
