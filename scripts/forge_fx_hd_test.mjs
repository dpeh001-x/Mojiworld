// Live test: the forge's anvil animation (per user: "Anvil Animation of enhancement
// very glitchy, can enlarge and upscale").
//   art   18 frames at 1024 px; nothing reaches the left/right/top edge (the fail set
//         had its hammer sliced flat on top and its smoke cut into walls); ONE anvil in
//         both sets that never moves (the sets used to disagree, so it jumped)
//   live  every tick of a success and a fail paints a non-empty frame (a background-
//         image swap could paint nothing while a frame decoded); the ANVIL sits on the
//         modal centre and draws at ~30% of the modal width (was ~23%); the art's top
//         stays inside the viewport
//   node scripts/forge_fx_hd_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// ---- art ---------------------------------------------------------------------
const rd = async (f) => { const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; };
// THE ANVIL HOLDS STILL - read as a silhouette against the bare anvil (scripts/seeds/forge_base_hd.png, the
// image both sets were animated from). Every frame must still cover that mask (the anvil did not slide), and a
// 14 px ring just outside it must stay mostly empty (it did not grow). Calibrated on real rolls: the shipped sets
// score coverage >= 0.99 with the ring <= 0.17 (the spark burst); the rolls where the model pushed the camera in
// scored 0.63-0.86 / 0.58-0.66. A bbox or run-length read could not tell a shower of embers from a zoom.
const seed = await rd('scripts/seeds/forge_base_hd.png');
const SN = seed.W * seed.H, MASK = new Uint8Array(SN), RING = new Uint8Array(SN);
for (let i = 0; i < SN; i++) MASK[i] = seed.data[i * 4 + 3] > 200 ? 1 : 0;
{ let y0 = seed.H; for (let i = 0; i < SN; i++) if (MASK[i]) { y0 = Math.floor(i / seed.W); break; }
  for (let y = y0; y < seed.H; y++) for (let x = 0; x < seed.W; x++) { if (MASK[y * seed.W + x]) continue;
    let near = 0; for (let dy = -14; dy <= 14 && !near; dy += 2) for (let dx = -14; dx <= 14; dx += 2) { const yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < seed.H && xx >= 0 && xx < seed.W && MASK[yy * seed.W + xx]) { near = 1; break; } }
    RING[y * seed.W + x] = near; } }
let maskN = 0, ringN = 0; for (let i = 0; i < SN; i++) { maskN += MASK[i]; ringN += RING[i]; }
const still = (r) => { let m = 0, q = 0; for (let i = 0; i < SN; i++) { const a = r.data[i * 4 + 3] > 200; if (MASK[i] && a) m++; if (RING[i] && a) q++; } return { cover: m / maskN, ring: q / ringN }; };
for (const k of ['success', 'fail']) {
  let worst = 0, where = '', dims = new Set(), cut = 0, cutAt = '', cover = 1, ring = 0;
  for (let i = 0; i < 9; i++) {
    const f = `Sprites/fx/anim/forge_${k}_${i}.webp`;
    if (!existsSync(f)) { ok(`${f} ships`, false); continue; }
    const r = await rd(f); dims.add(r.W + 'x' + r.H);
    for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) {
      if (!(x < 2 || x >= r.W - 2 || y < 2)) continue;
      const a = r.data[(y * r.W + x) * 4 + 3]; if (a > worst) { worst = a; where = `${i} @${x},${y}`; }
    }
    // An INTERIOR cut: ludo animates inside the input's content box + a margin and pastes it back, which
    // once sliced every frame flat along row 544 of 1024 - well inside the canvas, so the edge check above
    // passed it. A drawn edge is antialiased; a cut puts solid ink on the topmost ink row.
    // ...and the same at the sides: the chosen success roll's burst was clipped at columns 64 and 961.
    const A = (x, y) => r.data[(y * r.W + x) * 4 + 3];
    const line = (n, get) => { let ink = 0, solid = 0; for (let t = 0; t < n; t++) { const al = get(t); if (al > 24) ink++; if (al > 200) solid++; } return [ink, solid]; };
    const outer = (name, n, from, step, get) => { for (let v = from; v >= 0 && v < n; v += step) { const [ink, solid] = line(name === 'row' ? r.W : r.H, (t) => get(v, t)); if (ink) { if (solid > cut) { cut = solid; cutAt = `${i} ${name} ${v}`; } return; } } };
    outer('row', r.H, 0, 1, (y, x) => A(x, y));
    outer('col', r.W, 0, 1, (x, y) => A(x, y));
    outer('col', r.W, r.W - 1, -1, (x, y) => A(x, y));
    if (r.W === seed.W && r.H === seed.H) { const st = still(r); cover = Math.min(cover, st.cover); ring = Math.max(ring, st.ring); } else cover = 0;
  }
  ok(`${k}: nine 1024 px frames`, dims.size === 1 && dims.has('1024x1024'), [...dims]);
  ok(`${k}: nothing reaches the left/right/top edge`, worst <= 24, worst ? `frame ${where} alpha ${worst}` : '');
  ok(`${k}: nothing is sliced flat inside the frame (no solid clip line at the top or sides)`, cut <= 6, cut ? `frame ${cutAt}: ${cut} solid px` : '');
  ok(`${k}: the anvil holds still - the same anvil, same place, same size, every frame`, cover >= 0.95 && ring <= 0.30, { cover: +cover.toFixed(2), ring: +ring.toFixed(2) });
}

// ---- live --------------------------------------------------------------------
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof openEnhancementModal === 'function' && typeof attemptEnhance === 'function'
    && typeof _forgeFxDraw === 'function', null, { timeout: 120000 });
  // Let the boot's image flood finish first (the title menu shows when it has): opened mid-boot, the forge's
  // frames queue behind 100+ sprites on localhost's six connections, which is not what a player sees.
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const out = {};
    player.mojicoins = 99999999;
    if (!Array.isArray(player.inventory)) player.inventory = [];
    const it = rollItemDrop(1, 40); it.slot = 'weapon'; it.stars = 2; it.name = 'HD Probe';
    player.inventory.push(it);
    openEnhancementModal(); renderEnhancementModal(it);
    const all = [..._preloadForgeFx('success'), ..._preloadForgeFx('fail')];
    const t0 = Date.now();
    while (Date.now() - t0 < 30000 && !all.every(im => im.complete && im.naturalWidth)) await new Promise(z => setTimeout(z, 100));
    out.decoded = all.filter(im => im.complete && im.naturalWidth === 1024).length;
    const orig = window._forgeFxDraw;
    const run = async (kind, roll) => {
      const ticks = [];
      window._forgeFxDraw = function (cv, frames, f) {
        const drew = orig(cv, frames, f);
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let ink = 0; for (let p = 3; p < d.length; p += 64) if (d[p] > 24) ink++;
        ticks.push({ f, drew, ink });
        return drew;
      };
      const real = Math.random; Math.random = () => roll;
      it.stars = 2; it._pity = 0;
      try { attemptEnhance(it); } finally { Math.random = real; }
      const fx = document.getElementById('enhance-forge-fx');
      const fr = fx.getBoundingClientRect(), mr = document.querySelector('#enhance-modal .modal').getBoundingClientRect();
      const D = fx._forgeD;
      const geo = { anvilCy: fr.top + (_FORGE_FX_ANVIL_CY - _FORGE_FX_TOP) * D, modalCy: mr.top + mr.height / 2,
        boxCx: fr.left + fr.width / 2, modalCx: mr.left + mr.width / 2, anvilW: D * _FORGE_FX_ANVIL_W, modalW: mr.width, artTop: fr.top };
      await new Promise(z => setTimeout(z, _FORGE_FX_MS + 400));
      window._forgeFxDraw = orig;
      const hide = document.getElementById('enhance-celebration'); if (hide) hide.classList.remove('go', 'fail');
      return { kind, ticks, geo, stoppedAfter: _forgeFxTimer == null };
    };
    out.success = await run('success', 0);
    out.fail = await run('fail', 0.9999);
    return out;
  });
  ok('all 18 frames decode at 1024 px when the forge opens', r.decoded === 18, r.decoded);
  for (const k of ['success', 'fail']) {
    const x = r[k];
    ok(`${k}: all 9 frames are painted`, x.ticks.length === 9 && new Set(x.ticks.map(t => t.f)).size === 9, x.ticks.map(t => t.f));
    ok(`${k}: no tick paints an empty frame`, x.ticks.every(t => t.drew && t.ink > 50), x.ticks);
    ok(`${k}: the ANVIL sits on the modal centre`, Math.abs(x.geo.anvilCy - x.geo.modalCy) <= 3 && Math.abs(x.geo.boxCx - x.geo.modalCx) <= 2, x.geo);
    ok(`${k}: the anvil draws at ~30% of the modal width (was ~23%)`, x.geo.anvilW / x.geo.modalW > 0.27, +(x.geo.anvilW / x.geo.modalW).toFixed(3));
    ok(`${k}: the art's top is inside the viewport`, x.geo.artTop >= 0, x.geo.artTop);
    ok(`${k}: the player stops when it is done`, x.stoppedAfter);
  }
  ok('no page errors', errs.length === 0, errs);
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== FORGE ANIMATION HD ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 400)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
