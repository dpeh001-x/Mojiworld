// Live test: THE JUDGEMENT SEAL IS A LOCKDOWN, ON A BIGGER CANVAS, AND UNCUT.
//
// Per user: "regenerate qte_holy sprite and the subsequent animations, make sure that there are
// no cut offs (ensure it is linked to boss causing the judgement lock) the sprite should be more
// appropriate as it technically is not 'holy' based, it is essentially a lockdown on the
// character", then "for qte_holy can be much bigger using a bigger canvas".
//
// The three claims this pins:
//   LOOK  - the art is a circular binding seal in the theme's gold, not the winged sunburst that
//           shipped. The wings are measurable: they made the old ink box 1.28 wide-to-tall where
//           every other theme's sigil is a circle. The flush check catches the other failure the
//           border check cannot see - a ring drawn with a flat sliced edge inside the picture.
//   SIZE  - 1024 canvas (was 768 still / 952 frames) and drawn at 360 in game (was 250), and the
//           other five themes are NOT resized with it.
//   LINK  - _qteThemeFor routes the judges to this theme, so the sigil the Arbiter locks you with
//           is this art and a slime's is not.
//   node scripts/qte_lockdown_art_test.mjs      (MOJI_GAME_FILE serves a staged build)
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const px = async (f) => { const { data, info } = await sharp(readFileSync(f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
const box = (p) => { let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1, edge = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3] > 16) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (y === 0 || y === p.h - 1 || x === 0 || x === p.w - 1) edge++; }
  return { x0, y0, x1, y1, edge, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
// How much of each side of the ink box is NEAR-OPAQUE ink. This is the check that catches the
// cut-off the border check cannot see: the art stops short of the canvas, but a ring inside it
// has been chopped flat. A drawn shape touches its own bounding box at a few points; a sliced one
// runs along it. Measured at alpha > 180 rather than "any ink" because a soft full-frame glow
// lights up the whole perimeter faintly and is not a slice. Calibrated on three known sets: the
// dash_mage frames the user called cut off measure 13 / 16 / 22%, a clean dash_rogue loop 5%, a
// clean dash_warrior loop 0%. The limit sits at 10%, between them.
const EDGE_OPAQUE = 180, FLUSH_LIMIT = 10;
const flush = (p) => { const b = box(p), A = (x, y) => p.d[(y * p.w + x) * 4 + 3];
  let L = 0, R = 0, T = 0, B = 0;
  for (let y = b.y0; y <= b.y1; y++) { if (A(b.x0, y) > EDGE_OPAQUE) L++; if (A(b.x1, y) > EDGE_OPAQUE) R++; }
  for (let x = b.x0; x <= b.x1; x++) { if (A(x, b.y0) > EDGE_OPAQUE) T++; if (A(x, b.y1) > EDGE_OPAQUE) B++; }
  return Math.max(100 * L / b.h, 100 * R / b.h, 100 * T / b.w, 100 * B / b.w); };
const medHue = (p) => { const hs = [];
  for (let i = 0; i < p.d.length; i += 4) { if (p.d[i + 3] < 120) continue;
    const r = p.d[i] / 255, g = p.d[i + 1] / 255, b = p.d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (mx < 0.15 || d / mx < 0.35) continue;
    let h; if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4);
    hs.push(h < 0 ? h + 360 : h); }
  hs.sort((a, b) => a - b); return hs.length ? hs[hs.length >> 1] : null; };
const step = (a, b) => { let d = 0, n = 0; for (let o = 0; o < a.d.length; o += 16) { d += Math.abs(a.d[o + 3] - b.d[o + 3]) + Math.abs(a.d[o] - b.d[o]); n++; } return d / n / 255 * 100; };
const lumOf = (p) => { let s = 0, n = 0; for (let i = 0; i < p.d.length; i += 4) { const a = p.d[i + 3] / 255; if (a < 0.05) continue; s += a * (0.299 * p.d[i] + 0.587 * p.d[i + 1] + 0.114 * p.d[i + 2]); n++; } return n ? s / n : 0; };

const files = ['Sprites/fx/qte_holy.webp'].concat(Array.from({ length: 9 }, (_, i) => 'Sprites/fx/anim/qte_holy_' + i + '.webp'));
const ps = []; for (const f of files) ps.push({ f, p: await px(f), b: null });
for (const e of ps) { e.b = box(e.p); e.flush = flush(e.p); e.aspect = e.b.w / e.b.h; e.hue = medHue(e.p);
  e.pad = Math.min(e.b.x0, e.p.w - 1 - e.b.x1, e.b.y0, e.p.h - 1 - e.b.y1); }
const anim = ps.slice(1);
ok('the seal exists as a still plus nine frames', ps.length === 10 && ps.every((e) => e.p.w > 0), { count: ps.length });
ok('BIGGER CANVAS: every file is 1024 (was 768 still / 952 frames)', ps.every((e) => e.p.w === 1024 && e.p.h === 1024),
  { sizes: [...new Set(ps.map((e) => e.p.w + 'x' + e.p.h))].join(', ') });
ok('NO CUTOFF: zero opaque pixels on any canvas edge', ps.every((e) => e.b.edge === 0),
  { offenders: ps.filter((e) => e.b.edge > 0).map((e) => e.f + ':' + e.b.edge) });
ok('every file keeps >=40px of clear gutter on all four sides (old frames had 11px)',
  ps.every((e) => e.pad >= 40), { worst: Math.min(...ps.map((e) => e.pad)) + 'px', previous: '11px' });
ok('NO SLICED EDGE INSIDE THE ART: no side of the ink box runs more than 10% near-opaque',
  ps.every((e) => e.flush <= FLUSH_LIMIT), { worst: +Math.max(...ps.map((e) => e.flush)).toFixed(1) + '%',
    offenders: ps.filter((e) => e.flush > FLUSH_LIMIT).map((e) => e.f + ' ' + e.flush.toFixed(0) + '%') });
// The failure this gate exists for is WINGS, which make the box WIDE - the old sigil measured
// 1.28 where every other theme's is a circle. So the upper bound is the one that discriminates
// and it is asserted on every file. The lower bound is only asserted on the still: a frame mid-
// snap throws sparks above and below the seal (frame 2 measures 0.79) and that is the loop
// working, not a clip.
ok('the seal is CIRCULAR, not the winged sunburst (old ink box was 1.28 wide-to-tall)',
  ps[0].aspect >= 0.85 && ps[0].aspect <= 1.18, { still: +ps[0].aspect.toFixed(2), previous: 1.28 });
ok('no frame ever widens into wings either', ps.every((e) => e.aspect <= 1.18),
  { widest: Math.max(...ps.map((e) => +e.aspect.toFixed(2))) });
ok('it keeps the theme palette: saturated colour is gold (25-60 deg)',
  ps.every((e) => e.hue != null && e.hue >= 25 && e.hue <= 60),
  { hues: [...new Set(ps.map((e) => Math.round(e.hue)))].join(', ') + ' deg' });
ok('the nine frames share one canvas (no mid-cycle rescale)',
  anim.every((e) => e.p.w === anim[0].p.w && e.p.h === anim[0].p.h), { canvas: anim[0].p.w });
const steps = []; for (let i = 1; i < anim.length; i++) steps.push(+step(anim[i - 1].p, anim[i].p).toFixed(2));
ok('the loop never stalls (every step moves at least 0.35%)', steps.every((s) => s >= 0.35), { steps: steps.join(' / ') + ' %' });
const lums = anim.map((e) => lumOf(e.p)); const flash = Math.max(...lums) / Math.max(1, Math.min(...lums));
ok('the lock SNAPS: the brightest frame is at least 1.30x the dimmest', flash >= 1.30, { ratio: flash.toFixed(2) + 'x' });

// ---- in game ---------------------------------------------------------------
const free = (p) => new Promise((res) => { const s = net.createServer();
  s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _qteShackleStart === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1500);

const g = await page.evaluate(async () => {
  const out = {};
  const frames = (n) => new Promise((res) => { let i = 0; const t = () => { game.paused = false; if (++i >= n) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  try { loadMap('forest'); } catch (e) {}
  await frames(60);
  player.hp = 99999; player._god = false;          // _god short-circuits the QTE by design
  // LINK: the judges route to this theme, an ordinary mob does not
  out.arbiter = _qteThemeFor({ type: 'towerArbiter' }).fx;
  out.sovereign = _qteThemeFor({ type: 'towerSovereign' }).fx;
  out.aetherion = _qteThemeFor({ type: 'aetherion2' }).fx;
  out.zodiac = _qteThemeFor({ type: 'zodiacLeo', zodiacSign: 'leo' }).fx;
  out.slime = _qteThemeFor({ type: 'slime' }).fx;
  out.holySize = _QTE_THEMES.holy.fxSize; out.holyTele = _QTE_THEMES.holy.fxTele;
  out.otherSizes = ['chains', 'gravity', 'molten', 'tidal', 'spore'].map((k) => _QTE_THEMES[k].fxSize);
  try {
    const arr = _fxAnimFrames('qte_holy');
    for (let i = 0; i < 200; i++) { if (arr.filter((im) => im && im.complete && im.naturalWidth > 0).length >= 9) break; await new Promise((r2) => setTimeout(r2, 50)); }
    out.decoded = arr.filter((im) => im && im.complete && im.naturalWidth > 0).length;
    out.frameW = arr[0] && arr[0].naturalWidth;
  } catch (e) { out.animErr = String(e).slice(0, 120); }
  // a judge's lock spawns the seal at the bigger size; a slime's lock does not
  const run = async (type, extra) => {
    game.monsters = []; game.smoothFx = [];
    spawnMonster(Math.round(player.x + 120), Math.round(player.y), type, false);
    const m = game.monsters[game.monsters.length - 1];
    if (!m) return { err: 'no ' + type };
    m.hp = m.currentHp = 1e6; m.maxHp = 1e6; m.atk = 0; Object.assign(m, extra || {});
    try { _qteShackleStart(m); } catch (e) { return { err: String(e).slice(0, 120) }; }
    await frames(6);
    const burst = (game.smoothFx || []).find((f) => f && String(f.spriteKey || '').indexOf('qte_') === 0);
    const r = burst ? { key: burst.spriteKey, size: Math.round(burst.size), gap: burst.frameGap } : { err: 'no burst' };
    try { if (typeof _qteEnd === 'function') _qteEnd(false); } catch (e) {}
    try { _QTE.active = false; player.stunTimer = 0; const el = document.getElementById('lxq-root'); if (el) el.style.display = 'none'; } catch (e) {}
    game.monsters = []; game.smoothFx = [];
    return r;
  };
  out.judge = await run('towerArbiter');
  await frames(20);
  out.mob = await run('slime');
  return out;
});
ok('the judges all route to the judgement seal', g.arbiter === 'qte_holy' && g.sovereign === 'qte_holy' && g.aetherion === 'qte_holy' && g.zodiac === 'qte_holy',
  { arbiter: g.arbiter, sovereign: g.sovereign, aetherion: g.aetherion, zodiac: g.zodiac });
ok('an ordinary mob still gets the chain sigil', g.slime === 'qte_chains', { slime: g.slime });
ok('all nine frames decode in-engine at 1024', g.decoded === 9 && g.frameW === 1024, { decoded: g.decoded, frameW: g.frameW, animErr: g.animErr });
ok('a live judgement lock spawns the seal', g.judge && g.judge.key === 'qte_holy', g.judge);
ok('...MUCH BIGGER: 360 in game, up from 250', g.judge && g.judge.size === 360, { size: g.judge && g.judge.size, previous: 250 });
ok('...still animated (frameGap set, so the nine frames play)', g.judge && g.judge.gap > 0, { frameGap: g.judge && g.judge.gap });
ok('the bump is theme-scoped: a slime lock is unchanged at 250', g.mob && g.mob.size === 250, g.mob);
ok('no other theme was given a size override', Array.isArray(g.otherSizes) && g.otherSizes.every((s) => s === undefined), { sizes: JSON.stringify(g.otherSizes) });
ok('the telegraph is bumped too (170, was 120)', g.holyTele === 170, { fxTele: g.holyTele });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) { if (t.pass) pass++; console.log((t.pass ? 'PASS  ' : 'FAIL  ') + t.n + (t.x ? '  ' + JSON.stringify(t.x) : '')); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exitCode = pass === results.length ? 0 : 1;
