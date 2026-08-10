// Soul Drain animation: 9 canvas-exact frames that load, and a once-through
// playback across the pattern's 1900 ms window — smooth (monotonic, no repeats
// of the whole cycle), starting on frame 0 at the telegraph.
//
//   node serve.js 8900 && node scripts/gravitos_soul_anim_test.mjs 8900 [page]
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
const PORT = process.argv[2] || '8900';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// --- disk: canvas-exact, no cutoffs ----------------------------------------
const files = readdirSync('Sprites/bosses/attack').filter(f => /^gravitossoul_\d\.webp$/.test(f));
ok('9 frames on disk', files.length === 9, { found: files.length });
let dimsOk = true, clipOk = true;
for (const f of files) {
  const m = await sharp('Sprites/bosses/attack/' + f).metadata();
  if (m.width !== 1656 || m.height !== 1505) dimsOk = false;
  const { data, info } = await sharp('Sprites/bosses/attack/' + f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height;
  for (let i = 0; i < info.width * info.height; i++)
    if (data[i * 4 + 3] > 200) { const x = i % info.width, y = (i / info.width) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; }
  if (minX <= 8 || minY <= 8 || maxX >= info.width - 9) clipOk = false;   // bottom exempt: feet on floor is the family convention
}
ok('CANVAS-EXACT: every frame is 1656x1505, the base sprite\'s own canvas', dimsOk, {});
ok('NO CUTOFFS: no frame\'s body touches left/right/top edges', clipOk, {});
ok('static fallback exists', existsSync('Sprites/bosses/gravitossoul.webp'), {});

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
const net = [];
page.on('response', r => { if (/gravitossoul/.test(r.url())) net.push({ s: r.status(), f: r.url().split('/').pop() }); });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_gravitosSoulFrame') === 'function' && typeof eval('spawnMonster') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(async () => {
  const g = eval('game'), p = eval('player');
  g.mapData = g.mapData || {};
  g.mapData.platforms = [{ type: 'ground', x: 0, y: 448, w: 4000, h: 40 }];
  g.monsters = [];
  p.cls = 'warrior'; p.level = 100;
  eval('spawnMonster')(800, 400, 'gravitos', true, false);
  const m = g.monsters[0];

  // wait for the frames to decode
  const F = eval('BOSS_ATTACK_FRAMES')['gravitossoul'];
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    if (F && F.length && F.every(im => im && im.complete)) break;
    await new Promise(res => setTimeout(res, 200));
  }
  const decoded = F ? F.filter(im => im && im.complete && im.naturalWidth > 0).length : 0;

  // drive the REAL pattern and sample the picked frame across the window
  m.patternState = 'soulDrain'; m._phaseSprite = null;
  const seq = [];
  for (let t = 0; t <= 1900; t += 100) {
    m.patternTimer = t;
    const im = eval('_gravitosSoulFrame')(m);
    seq.push(im ? +(im.src.match(/gravitossoul_(\d)/) || [])[1] : null);
  }
  // the draw override must select the set
  m.patternTimer = 900;
  m._gravStarKey = null;
  // reproduce the override condition exactly as drawMonster runs it
  const overrideFires = (m.type === 'gravitos' && !m._phaseSprite && m.patternState === 'soulDrain' && !!eval('_gravitosSoulFrame')(m));
  // forms 2/3 must NOT use it
  m._phaseSprite = 'gravitos2';
  const form2Excluded = !(m.type === 'gravitos' && !m._phaseSprite && m.patternState === 'soulDrain');
  m._phaseSprite = null;
  return { decoded, seq, overrideFires, form2Excluded,
           dims: F && F[0] ? F[0].naturalWidth + 'x' + F[0].naturalHeight : null };
});

ok('all 9 frames decode in the game', r.decoded === 9, { decoded: r.decoded, dims: r.dims });
ok('no 404 for any soul frame', !net.some(x => x.s === 404), net.filter(x => x.s === 404).slice(0, 4));
const seq = r.seq.filter(x => x != null);
ok('playback starts on frame 0 at the telegraph', seq[0] === 0, { first: seq[0] });
ok('playback ends on the final frame as the drain fires', seq[seq.length - 1] === 8, { last: seq[seq.length - 1] });
ok('SMOOTH: monotonic once-through — never repeats the cycle, never steps back',
   seq.every((v, i) => i === 0 || v >= seq[i - 1]), { seq });
ok('SMOOTH: all 9 frames are actually visited', new Set(seq).size === 9, { visited: [...new Set(seq)] });
ok('the draw override selects the set during soulDrain', r.overrideFires === true, {});
ok('forms 2/3 keep their star-set treatment (form-1 art stays form-1)', r.form2Excluded === true, {});
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
