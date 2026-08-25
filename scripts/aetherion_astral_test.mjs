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
const box = async (f) => {
  const im = sharp(f); const m = await im.metadata();
  const { info } = await im.trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  const left = -info.trimOffsetLeft, top = -info.trimOffsetTop;
  // 'Cut off' means the art runs out of canvas - LEFT, TOP or RIGHT. The BOTTOM
  // is flush by design on every one of these sprites, original art included: the
  // draw path anchors the lowest opaque pixel to the foot line, so a standing
  // character's feet sit exactly on the canvas edge. Counting that as clipping
  // failed all nine untouched frames and said nothing about the real question.
  return { w: info.width, h: info.height, bottom: m.height - (top + info.height),
    margin: Math.min(left, top, m.width - (left + info.width)) };
};
const astral = [], generic = [];
for (let i = 0; i < 9; i++) {
  astral.push(await box(`Sprites/bosses/attack/aetherionastral_${i}.webp`));
  generic.push(await box(`Sprites/bosses/attack/aetherion_${i}.webp`));
}
const gw = generic.map(b => b.w), aw = astral.map(b => b.w);
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
ok('nothing in the astral set is cut off - every frame clears the canvas edge',
  astral.every(f => f.margin > 5),
  { smallestMargin: Math.min(...astral.map(f => f.margin)) + 'px', widths: aw });
ok('the cast opens on frame 0 and the BURST lands exactly on the resolve',
  r.atStart === 0 && r.atResolve === 6,
  { atStart: r.atStart, atResolve1500ms: r.atResolve, timeline: T.map(x => x.pt + 'ms->f' + x.f).join(' ') });
ok('...and the aftermath plays out after the hit rather than before it',
  T.filter(x => x.pt < 1500).every(x => x.f <= 6) && r.atEnd === 8,
  { beforeHit: T.filter(x => x.pt < 1500).map(x => x.f), atEnd: r.atEnd });
ok('the frames advance through the cast instead of sticking',
  new Set(T.map(x => x.f)).size >= 6, { distinctFrames: new Set(T.map(x => x.f)).size, seen: T.map(x => x.f) });

ok('the generic attack set no longer carries the tiny two-limbed outliers',
  Math.min(...gw) > 800,
  { widths: gw, wasSmallest: 381, nowSmallest: Math.min(...gw) });
ok('...so its frame-to-frame variation is tight, not a 2.5x jump',
  spread(gw) < 1.2,
  { spreadNow: spread(gw).toFixed(2) + 'x', spreadBefore: (958 / 381).toFixed(2) + 'x' });
ok('the generic set is not cut off either', generic.every(f => f.margin > 5),
  { smallestMargin: Math.min(...generic.map(f => f.margin)) + 'px' });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
