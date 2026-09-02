// Live test: THE QTE SHACKLE SIGIL IS REGENERATED, UNCUT, AND DRAWN BIGGER.
//
// Per user: "I think the sprite is qte lock can you generate another one for
// it ... generate and wire a bigger one ... ensure the edges are not cut off".
//
// What renders during a shackle QTE is the ANIMATED set (the burst passes
// frameGap), so the frames are the thing that must be clean — the 768 single
// is only the pre-decode fallback. Both are asserted here.
//   ART  — static + all nine frames: zero opaque pixels on any canvas edge,
//          >=8% clear margin every side, round bbox, consistent canvas
//   GAME  — the frames decode in-engine, and a live shackle QTE spawns the
//          sigil burst at the new bigger size (was 170)
//   node scripts/qte_sigil_art_test.mjs
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

const measure = async (p) => {
  const { data, info } = await sharp(readFileSync(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let top = -1, bot = -1, l = -1, r = -1, edge = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 16) {
      if (top < 0) top = y; bot = y;
      if (l < 0 || x < l) l = x; if (x > r) r = x;
      if (y === 0 || y === H - 1 || x === 0 || x === W - 1) edge++;
    }
  }
  const bw = r - l + 1, bh = bot - top + 1;
  return { W, H, edge, minPad: Math.min(l / W, (W - 1 - r) / W, top / H, (H - 1 - bot) / H), aspect: bw / bh };
};

const files = ['Sprites/fx/qte_chains.webp'].concat(
  Array.from({ length: 9 }, (_, i) => 'Sprites/fx/anim/qte_chains_' + i + '.webp'));
const ms = [];
for (const f of files) ms.push({ f, m: await measure(f) });
const anim = ms.slice(1);
ok('every QTE sigil frame exists (static + 9 animated)', ms.length === 10 && ms.every((x) => x.m.W > 0),
  { count: ms.length });
ok('NO CUTOFF: zero opaque pixels on any edge, in every frame',
  ms.every((x) => x.m.edge === 0), { offenders: ms.filter((x) => x.m.edge > 0).map((x) => x.f + ':' + x.m.edge) });
ok('every frame keeps >=8% clear margin on all four sides',
  ms.every((x) => x.m.minPad >= 0.08),
  { worst: +(Math.min(...ms.map((x) => x.m.minPad)) * 100).toFixed(1) + '%' });
ok('every frame is round (a one-sided clip reads as an oval)',
  ms.every((x) => x.m.aspect > 0.88 && x.m.aspect < 1.14),
  { worst: ms.map((x) => +x.m.aspect.toFixed(2)).sort()[0] });
ok('the animated frames all share one canvas (no mid-cycle rescale)',
  anim.every((x) => x.m.W === anim[0].m.W && x.m.H === anim[0].m.H),
  { canvas: anim[0].m.W + 'x' + anim[0].m.H });

const free = (p) => new Promise((res) => { const s = net.createServer();
  s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
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
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  player.hp = 99999; player._god = false;   // _god short-circuits the QTE by design

  // the animated frames decode in-engine
  try {
    const arr = _fxAnimFrames('qte_chains');
    for (let i = 0; i < 200; i++) {
      const n = arr.filter((im) => im && im.complete && im.naturalWidth > 0).length;
      if (n >= 9) break;
      await new Promise((r2) => setTimeout(r2, 50));
    }
    out.decoded = arr.filter((im) => im && im.complete && im.naturalWidth > 0).length;
    out.frameW = arr[0] && arr[0].naturalWidth;
  } catch (e) { out.animErr = String(e).slice(0, 120); }

  // a live shackle QTE spawns the sigil at the new size
  game.monsters = [];
  spawnMonster(Math.round(player.x + 120), Math.round(player.y), 'slime', false);
  const m = game.monsters[game.monsters.length - 1];
  m.hp = m.currentHp = 1e6; m.maxHp = 1e6; m.atk = 0;
  game.smoothFx = [];
  try { _qteShackleStart(m); } catch (e) { out.qteErr = String(e).slice(0, 120); }
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 6) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const burst = (game.smoothFx || []).find((f) => f && String(f.spriteKey || '').indexOf('qte_') === 0);
  out.sigilKey = burst ? burst.spriteKey : null;
  out.sigilSize = burst ? Math.round(burst.size) : null;
  out.frameGap = burst ? burst.frameGap : null;
  try { if (typeof _qteEnd === 'function') _qteEnd(false); } catch (e) {}
  try { _QTE.active = false; player.stunTimer = 0; const r2 = document.getElementById('lxq-root'); if (r2) r2.style.display = 'none'; } catch (e) {}
  game.monsters = []; game.smoothFx = [];
  return out;
});

ok('all nine animated frames decode in-engine at 952', g.decoded === 9 && g.frameW === 952,
  { decoded: g.decoded, frameW: g.frameW, animErr: g.animErr });
ok('a live shackle QTE spawns the sigil burst', g.sigilKey && String(g.sigilKey).indexOf('qte_') === 0,
  { key: g.sigilKey, qteErr: g.qteErr });
ok('...at the BIGGER size (was 170)', g.sigilSize >= 250, { size: g.sigilSize, previous: 170 });
ok('...still animated (frameGap set, so the 9-frame set plays)', g.frameGap > 0, { frameGap: g.frameGap });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 320));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
