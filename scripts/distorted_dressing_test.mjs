// Distorted Portal dressing (per user: "for the other distorted portal maps beautify them as well", after the Usurpers' Court). The
// Threshold, the Fractured Reflection and the Confused Vigil hang the court's crimson banners and lantern strings under their fixed
// ledges. In the running game, for every piece hung on those maps (anchor 'hang'):
//   - its art loads; its content box hangs from its own ledge (top on the ledge's top, width inside the ledge's span)
//   - clear of every other ledge, the floor and the door sprites
//   - a lit string glows BELOW its ledge (the glow sits down from a hung piece's top, not up from its feet)
// and the Vigil keeps its floor clear between its two end lanterns, and has the chain's rift sparks.
// Backdrops (per user: "You can generate unique backgrounds as well"): each map loads and draws a scene of its own (bg_v4_*: the
// mirror gate, the shattered world, the sentinel's maze), and the Vigil's authored platTint is its new plate's measured dominant.
//   node scripts/distorted_dressing_test.mjs          (PORT / MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10251); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const MAPS3 = ['distortedThreshold', 'fracturedReflection', 'confusedVigil'];
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
try {
  const page = await browser.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAP_PROPS === 'object' && typeof LX_OBJECTS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const R = await page.evaluate(async (MAPS3) => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    window._lxBootGateDone = true; window._prologueActive = false; player._god = true; player.invulnerable = 9e9; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), ready = (im) => new Promise((res) => { if (im && im.complete && im.naturalWidth) return res(true); if (!im) return res(false); im.addEventListener('load', () => res(true)); im.addEventListener('error', () => res(false)); setTimeout(() => res(false), 20000); });
    const out = { maps: {} };
    for (const id of MAPS3) {
      loadMap(id, 200); await sleep(600);
      const md = game.mapData, pl = md.platforms, rows = [];
      for (const p of (MAP_PROPS[id] || [])) {
        if (p.anchor !== 'hang') continue;
        const im = LX_OBJECTS[p.key], loaded = await ready(im); if (!loaded) { rows.push({ key: p.key, x: p.x, why: ['not loaded'] }); continue; }
        const f = Math.max(0.7, Math.min(1.4, Math.max(im.naturalWidth, im.naturalHeight) / 512)), h = 80 * (p.scale || 1) * f, w = h * im.naturalWidth / im.naturalHeight;
        const top = _detectSpriteBboxTop(im), bot = _detectSpriteBboxBottom(im), vis = h * (bot - top + 1) / im.naturalHeight;
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data; let L = c.width, Rr = 0; for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < L) L = x; if (x > Rr) Rr = x; }
        const x0 = p.x - w / 2 + w * L / c.width, x1 = p.x - w / 2 + w * (Rr + 1) / c.width, y0 = p.y, y1 = p.y + vis, why = [];
        const own = pl.find((q) => q.type !== 'ground' && Math.abs(q.y - p.y) <= 1 && x0 >= q.x - 2 && x1 <= q.x + q.w + 2); if (!own) why.push('not under one ledge');
        for (const q of pl) { if (q === own) continue; if (q.x < x1 && q.x + q.w > x0 && q.y < y1 && q.y + (q.h || 12) > y0 + 14) why.push((q.type === 'ground' ? 'floor ' : 'ledge ') + q.x + ',' + q.y); }
        for (const dd of md.portals) if (dd.x - 34 < x1 && dd.x + 34 > x0 && dd.y - 110 < y1 && dd.y > y0) why.push('door ' + dd.dest);
        rows.push({ key: p.key, x: p.x, glow: !!p.glow, y: p.y, vis, why });
      }
      // the lit strings: render the map with the camera on each and find their glow gradient
      const lit = [];
      for (const r of rows.filter((q) => q.glow)) {
        player.x = r.x - 200; player.vx = 0; await sleep(300); game.monsters = []; game.camera.x = Math.max(0, Math.min(md.worldWidth - W, r.x - W / 2)); game._lowFxCache = null;
        // headless trips the frame watchdog within a few map loads, and low FX skips every glow: render as a smooth machine would
        Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 });
        const P = CanvasRenderingContext2D.prototype, o1 = P.createRadialGradient, got = [];
        P.createRadialGradient = function (...a) { got.push({ x: a[0], y: a[1] }); return o1.apply(this, a); };
        game.paused = true; _lxRenderOnly = true; const dp = (typeof _LX_DPR !== 'undefined') ? _LX_DPR : 1;
        try { ctx.setTransform(dp, 0, 0, dp, 0, 0); _lxDrawFrame(performance.now()); } finally { _lxRenderOnly = false; P.createRadialGradient = o1; game.paused = false; }
        const mine = got.filter((g) => Math.abs(g.x - (r.x - game.camera.x)) < 6);
        lit.push({ x: r.x, ledge: r.y, gy: mine.length ? mine[0].y + (game.camera.y || 0) : null, bottom: r.y + r.vis });
      }
      out.maps[id] = { rows, lit, floor: (MAP_PROPS[id] || []).filter((p) => p.anchor !== 'hang').map((p) => p.x) };
    }
    // each map's own backdrop: registered under its new name, decoded at the plates' size, and drawn once the map is entered -
    // on ANY canvas, from the load on (a plate reaches the screen through an offscreen cache built when the map loads)
    { const P2 = CanvasRenderingContext2D.prototype, o2 = P2.drawImage, seen = new Set(); try { _lxBootHold.release('menu'); } catch (e) {}
      P2.drawImage = function (im) { try { const s = String((im && im.src) || ''); if (/backgrounds\//.test(s)) seen.add(s.replace(/^.*backgrounds\//, '')); } catch (e) {} return o2.apply(this, arguments); };
      try {
        for (const id of MAPS3) {
          seen.clear(); loadMap(id, 200); const md = game.mapData, bg = BG_IMAGES[md.bg || id], want = 'bg_v4_' + id + '.webp';
          try { _lxWantImg(bg, true); } catch (e) {}
          for (let i = 0; i < 60 && !(bg && bg._loaded && seen.has(want)); i++) await sleep(150);
          const dom = (bg && bg._loaded && typeof _lxDominantColor === 'function') ? (delete bg._lxDom, _lxDominantColor(bg, md.sky)) : null;
          out.maps[id].bg = { src: String((bg && bg.src) || '').replace(/^.*backgrounds\//, ''), w: bg && bg.naturalWidth, h: bg && bg.naturalHeight, drawn: [...seen], dom, tint: md.platTint || null };
        }
      } finally { P2.drawImage = o2; } }
    let k = 0; const r0 = Math.random; game._forcePhase = 18; _LX_DAYPH.t = 0; loadMap('confusedVigil', 200); await sleep(200); game.ambient = [];
    Math.random = () => 0.001; try { for (let i = 0; i < 10; i++) updateAmbient(); } finally { Math.random = r0; game._forcePhase = null; _LX_DAYPH.t = 0; }
    out.vigilAir = [...new Set(game.ambient.map((q) => q.type + ' ' + q.color))];
    out.vigilW = MAPS.confusedVigil.worldWidth;
    return out;
  }, MAPS3);
  for (const id of MAPS3) {
    const m = R.maps[id], bad = m.rows.filter((r) => r.why.length);
    ok(`${id}: ${m.rows.length} hung pieces load, each hangs from its own ledge, clear of every other ledge, the floor and the doors`, m.rows.length >= 3 && !bad.length, JSON.stringify(bad).slice(0, 300));
    ok(`${id}: each lit string glows below its ledge, inside its own height`, m.lit.length >= 1 && m.lit.every((l) => l.gy != null && l.gy > l.ledge && l.gy < l.bottom), JSON.stringify(m.lit));
  }
  for (const id of MAPS3) {
    const b = R.maps[id].bg || {};
    ok(`${id}: its own backdrop, bg_v4_${id}.webp, decodes at 2912x1632 and is what the frame draws`, b.src === `bg_v4_${id}.webp` && b.w === 2912 && b.h === 1632 && b.drawn.includes(`bg_v4_${id}.webp`), JSON.stringify(b));
  }
  { const b = R.maps.confusedVigil.bg || {}, hx = (s) => [1, 3, 5].map((i) => parseInt(String(s).slice(i, i + 2), 16)), d = (b.dom && b.tint) ? Math.hypot(...hx(b.dom).map((x, i) => x - hx(b.tint)[i])) : 999;
    ok('the Confused Vigil: its authored platTint is its new plate\'s measured dominant (slabs right on frame one)', d <= 6, JSON.stringify({ dom: b.dom, tint: b.tint, d: Math.round(d) })); }
  const v = R.maps.confusedVigil;
  ok('the Confused Vigil: its floor pieces stand only at its two ends (the fight keeps the floor)', v.floor.length === 2 && v.floor.every((x) => x < 150 || x > R.vigilW - 150), v.floor.join(','));
  ok('the Confused Vigil: the chain\'s crimson rift sparks', R.vigilAir.length === 1 && /^ember #ff5f7a/.test(R.vigilAir[0]), R.vigilAir.join(' | '));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
