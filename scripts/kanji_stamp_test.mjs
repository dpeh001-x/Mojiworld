// Live test: KAGE RUSH KANJI STAMP v2 (per user: the seal glyph is 凶, and
// the stamp is "further stylised"). Drives spawnKanjiFlash + the real
// drawSmoothFx branch with ctx spied, across the effect's life.
//   node scripts/kanji_stamp_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const OUT = process.env.LX_SHOT_DIR || '.';

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnKanjiFlash === 'function' && typeof drawSmoothFx === 'function',
  null, { timeout: 120000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true;
  game.smoothFx = [];
  game.camera.x = 0;
  spawnKanjiFlash(400, 300, undefined, undefined, { size: 104, life: 28 });
  const fx = game.smoothFx[game.smoothFx.length - 1];
  out.glyph = fx.glyph;
  out.seeded = { bleed: (fx.bleed || []).length, drips: (fx.drips || []).length, spray: (fx.spray || []).length, rotSet: typeof fx.rot === 'number' };
  // spy one draw at a given remaining life
  const drawAt = (life) => {
    fx.life = life;
    const rec = { fill: [], stroke: 0, lines: 0, arcs: 0, scales: [], fonts: new Set(), comp: new Set() };
    const P = CanvasRenderingContext2D.prototype;
    const o = { fillText: P.fillText, strokeText: P.strokeText, lineTo: P.lineTo, arc: P.arc, scale: P.scale };
    P.fillText = function (t, x) { rec.fill.push({ t: String(t), x: Math.round(x), f: String(this.font), c: String(this.fillStyle), op: this.globalCompositeOperation }); rec.fonts.add(String(this.font)); return o.fillText.apply(this, arguments); };
    P.strokeText = function () { rec.stroke++; return o.strokeText.apply(this, arguments); };
    P.lineTo = function () { rec.lines++; return o.lineTo.apply(this, arguments); };
    P.arc = function () { rec.arcs++; return o.arc.apply(this, arguments); };
    P.scale = function (a) { rec.scales.push(+a.toFixed(3)); return o.scale.apply(this, arguments); };
    try { drawSmoothFx(false); } catch (e) { rec.threw = String(e).slice(0, 100); }
    Object.assign(P, o);
    const kanji = rec.fill.filter(f => f.t === fx.glyph);
    return { n: kanji.length, stroke: rec.stroke, lines: rec.lines, arcs: rec.arcs,
             scale: rec.scales.find(v => v !== 1) || 1, threw: rec.threw,
             font: kanji[0] ? kanji[0].f : '', offsets: [...new Set(kanji.map(k => k.x))].length,
             lighter: kanji.some(k => k.op === 'lighter') };
  };
  out.land = drawAt(28);      // t=0: the landing frame
  out.mid  = drawAt(16);      // t≈0.43: settled, drips running
  out.late = drawAt(5);       // t≈0.82: fading, core gone
  game.smoothFx = [];
  return out;
});

ok('the glyph is 凶', r.glyph === '\u51F6', { glyph: r.glyph });
ok('ink is seeded once at spawn (bleed offsets, drips, landing tilt)',
  r.seeded.bleed === 3 && r.seeded.drips >= 2 && r.seeded.rotSet, r.seeded);
ok('the draw does not throw', !r.land.threw && !r.mid.threw && !r.late.threw, [r.land.threw, r.mid.threw, r.late.threw]);
ok('a mincho / serif CJK face leads the font stack (brush contrast, not gothic)',
  /Mincho/.test(r.land.font) && r.land.font.indexOf('Mincho') < r.land.font.indexOf('Gothic'), { font: r.land.font });
ok('it LANDS with overshoot: the landing frame is scaled past 1.0',
  r.land.scale > 1.15 && r.mid.scale <= 1.02, { land: r.land.scale, mid: r.mid.scale });
ok('chromatic split on the landing frame: the glyph is painted at offsets that converge by mid-life',
  r.land.offsets >= 3 && r.mid.offsets < r.land.offsets, { landOffsets: r.land.offsets, midOffsets: r.mid.offsets });
ok('ink bleed + body + core: the glyph is painted several times per frame with a dark rim stroke',
  r.land.n >= 5 && r.land.stroke >= 1 && r.land.lighter, { paints: r.land.n, strokes: r.land.stroke });
ok('ink drips run from the lower edge by mid-life (lines + beads)',
  r.mid.lines >= 2 && r.mid.arcs >= 2, { lines: r.mid.lines, beads: r.mid.arcs });
ok('ink spray: nine dots flung out on the landing (arcs beyond the drip beads)',
  r.land.arcs >= 9 && r.seeded.spray === 9, { landArcs: r.land.arcs, spray: r.seeded.spray });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

// a rendered frame for the eye: mid-life, captured synchronously off the
// canvas (the live loop repaints before a page screenshot could land)
const dataUrl = await page.evaluate(() => {
  game.smoothFx = [];
  ctx.save(); ctx.fillStyle = '#2b1a3a'; ctx.fillRect(260, 170, 280, 260); ctx.restore();
  spawnKanjiFlash(400, 300, undefined, undefined, { size: 104, life: 28, rot: -0.06 });
  game.smoothFx[game.smoothFx.length - 1].life = 15;
  drawSmoothFx(false);
  const c = document.createElement('canvas'); c.width = 280; c.height = 260;
  c.getContext('2d').drawImage(ctx.canvas, 260, 170, 280, 260, 0, 0, 280, 260);
  game.smoothFx = [];
  return c.toDataURL('image/png');
});
(await import('node:fs')).writeFileSync(`${OUT}/kanji_after.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
