// Live test: AETHERION'S ASTRAL JUDGEMENT DRAWS ITS OWN CAST.
//
// Per user: use the old animation for the generic attack (the new one varied too
// much), regenerate a SEPARATE set wired specifically to the special attack, and
// ensure nothing is cut off. Plus: every Aetherion frame must have four limbs,
// and the old two-limbed art must go.
//
// Two halves. The IMAGE half is measured in Node against the files on disk - no
// frame may touch the canvas edge, and the generic set may no longer contain the
// tiny two-limbed outliers. The ENGINE half runs in the page against a really
// spawned Aetherion, because the thing under test is which sprite the draw path
// picks and when.
//   node scripts/aetherion_astral_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// ---------- image half ----------
// A trimmed bounding box CANNOT answer "is it cut off". Faint particle motes
// drift below the body, so the bbox reported a healthy 53 px bottom margin on a
// set whose legs were sliced clean off inside it - the user saw it, this file
// did not. Two signals that actually work, both on STRONGLY opaque pixels
// (alpha > 128) so stray motes cannot vote:
//   edge   - opaque pixels sitting on the canvas border, i.e. art run out of room
//   flat   - opaque pixels still in the LAST row that has any, AND WHERE that
//            row is. Feet resting ON the canvas bottom is this project's anchor
//            convention - generic frame 5 puts 189 opaque px there and is fine.
//            A cut is a wide band ending in MID-CANVAS with empty rows below it,
//            which is exactly what the severed set did: 153 px stopping at row
//            1271 of 1325, in all nine frames.
const box = async (f) => {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const op = (x, y) => data[(y * W + x) * C + 3] > 128;
  let top = 0, bottom = 0, left = 0, right = 0;
  for (let x = 0; x < W; x++) { if (op(x, 0)) top++; if (op(x, H - 1)) bottom++; }
  for (let y = 0; y < H; y++) { if (op(0, y)) left++; if (op(W - 1, y)) right++; }
  const rows = [];
  for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (op(x, y)) n++; rows.push(n); }
  let last = -1; for (let y = H - 1; y >= 0; y--) if (rows[y] > 0) { last = y; break; }
  const { info: tr } = await sharp(f).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  return { w: tr.width, h: tr.height, edge: Math.max(top, left, right), bottomEdge: bottom,
    flat: last >= 0 ? rows[last] : 0, last, H };
};
const astral = [], generic = [];
for (let i = 0; i < 9; i++) {
  astral.push(await box(`Sprites/bosses/attack/aetherionastral_${i}.webp`));
  generic.push(await box(`Sprites/bosses/attack/aetherion_${i}.webp`));
}
const gw = generic.map(b => b.w), aw = astral.map(b => b.w);
// violet coverage per frame: the spell's actual intensity curve, so the test can
// assert the art and the engine's burst frame agree instead of trusting a comment.
const violet = [];
for (let i = 0; i < 9; i++) {
  const { data, info } = await sharp(`Sprites/bosses/attack/aetherionastral_${i}.webp`)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let j = 0; j < data.length; j += info.channels) {
    if (data[j + 3] < 40) continue;
    const g2 = data[j + 1], b2 = data[j + 2];
    if (b2 > g2 + 18 && b2 > 90) n++;
  }
  violet.push(n);
}
const violetPeak = violet.indexOf(Math.max(...violet));
const spread = (a) => Math.max(...a) / Math.min(...a);

// ---------- engine half ----------
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
await page.waitForFunction(() => typeof spawnMonster === 'function'
  && typeof _aetherionAstralFrame === 'function' && typeof BOSS_ATTACK_FRAMES !== 'undefined',
  null, { timeout: 120000 });
await page.waitForFunction(() => { try { const f = BOSS_ATTACK_FRAMES.aetherionastral;
  return !!(f && f.length && f.every(i => i && i.complete && i.naturalWidth > 0)); } catch (e) { return false; } },
  null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1200);

const r = await page.evaluate(() => {
  const out = {};
  const set = BOSS_ATTACK_FRAMES.aetherionastral;
  out.loaded = !!(set && set.length);
  out.count = set ? set.length : 0;
  out.decoded = !!(set && set.length && set.every(i => i && i.complete && i.naturalWidth > 0));
  game.monsters = [];
  spawnMonster(600, 380, 'aetherion', true);
  const m = game.monsters[0];
  if (!m) { out.spawnFailed = true; return out; }
  out.key = _aetherionAstralKey(m);
  // Which frame is shown at each moment of the cast. The damage resolves at
  // patternTimer 1500, so that is the sample that matters most.
  const at = (pt) => { m.patternState = 'astral'; m.patternTimer = pt;
    const im = _aetherionAstralFrame(m);
    return im ? +(im.src.match(/aetherionastral_(\d)\.webp/) || [])[1] : null; };
  out.timeline = [0, 250, 500, 750, 1000, 1250, 1500, 1700, 1920].map(pt => ({ pt, f: at(pt) }));
  out.atResolve = at(1500);
  out.atStart = at(0);
  out.atEnd = at(2400);
  // The engine's own burst index, read rather than assumed — see the assertion.
  out.burstConst = (typeof _AE_ASTRAL_BURST === 'number') ? _AE_ASTRAL_BURST : null;
  // and it must not claim the sprite for any OTHER pattern
  m.patternState = 'volley'; m.patternTimer = 400;
  out.volleyUsesAstral = !!(m.patternState === 'astral');
  const other = _aetherionAstralFrame(m);   // picker itself is state-agnostic
  out.pickerIsStateAgnostic = !!other;      // the GATE lives in the draw path
  game.monsters = [];
  return out;
});

const T = r.timeline || [];
ok('the astral set loads and decodes as its own 9-frame sprite',
  r.loaded && r.count === 9 && r.decoded, { frames: r.count, decoded: r.decoded, key: r.key });
ok('nothing in the astral set is cut off - nothing clipped, nothing sliced mid-canvas',
  astral.every(f => f.edge === 0 && (f.last === f.H - 1 || f.flat <= 30)),
  { clippedSides: Math.max(...astral.map(f => f.edge)),
    lastOpaqueRow: astral.map(f => f.last + '/' + (f.H - 1)).join(' '),
    note: 'feet ON the bottom row = the anchor convention; the severed set stopped at 1271/1325 with 153 px',
    widths: aw });
ok('the generated set varies without blowing up the silhouette',
  spread(aw) < 1.60,
  { spread: spread(aw).toFixed(3) + 'x', genericSetOfTheSameBoss: spread(gw).toFixed(3) + 'x',
    note: 'stillness was traded for animation on user instruction; this only catches the 2.51x class' });
ok('the VIOLET actually animates, and peaks on the frame the engine detonates',
  violetPeak === r.atResolve && violet[violetPeak] > 50000 && violet[8] < violet[violetPeak] / 10,
  { perFrameVioletPx: violet, peakFrame: violetPeak, engineBurstFrame: r.atResolve,
    note: 'a set that peaked at 4 while the engine burst at 6 would die two frames before the hit' });
// The 4 that used to be hard-coded here contradicted the assertion above, which
// ties the art's violet peak to whatever the engine's burst index actually is.
// When the set was regenerated and peaked a frame later, _AE_ASTRAL_BURST moved
// to 5 with it — exactly as the constant's own comment instructs — and this line
// would then have failed a correct build. Read the constant instead: the thing
// worth asserting is that the frame shown at the resolve IS the burst frame, not
// that the burst frame is any particular number.
ok('the cast opens on frame 0 and the BURST lands exactly on the resolve',
  r.atStart === 0 && r.burstConst !== null && r.atResolve === r.burstConst,
  { atStart: r.atStart, atResolve1500ms: r.atResolve, engineBurstConst: r.burstConst,
    timeline: T.map(x => x.pt + 'ms->f' + x.f).join(' ') });
ok('...and the aftermath plays out after the hit rather than before it',
  T.filter(x => x.pt < 1500).every(x => x.f <= 4) && r.atEnd === 8,
  { beforeHit: T.filter(x => x.pt < 1500).map(x => x.f), atEnd: r.atEnd });
ok('the frames advance through the cast instead of sticking',
  new Set(T.map(x => x.f)).size >= 6, { distinctFrames: new Set(T.map(x => x.f)).size, seen: T.map(x => x.f) });

ok('the generic attack set no longer carries the tiny two-limbed outliers',
  Math.min(...gw) > 800,
  { widths: gw, wasSmallest: 381, nowSmallest: Math.min(...gw) });
ok('...so its frame-to-frame variation is tight, not a 2.5x jump',
  spread(gw) < 1.2,
  { spreadNow: spread(gw).toFixed(2) + 'x', spreadBefore: (958 / 381).toFixed(2) + 'x' });
ok('the generic set has no art running off the left, top or right',
  generic.every(f => f.edge === 0),
  { worstEdgePixels: Math.max(...generic.map(f => f.edge)),
    note: 'the BOTTOM is flush by design on this set - feet anchored to the foot line' });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
