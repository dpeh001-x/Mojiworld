// ARMOUR GARMENTS (per user, 2026-10-01: "improve the aesthetic and shape of how the armour appears on screen on the character").
// Body armour is one flat image on the torso, and the Gear Align erases trimmed its sleeves, so every outfit stood on bare skin arms
// and legs. The hero's arms, legs and feet are now drawn in the armour's own dark cloth (read once per image from the art); the
// armour image itself is drawn exactly as before (a two-half sway was tried and dropped - it bent the Hurricane Mantle's lightning).
//   [1] with an armour on, the limbs are filled with its garment colours; with window._lxNoGarments they are not
//   [2] the armour art is drawn exactly as before: every drawImage of the armour (image, rect, transform) is identical with the
//       garments on and off
//   [3] every armour on disk gets a garment, and it is dark cloth (no channel above 150)
//   [4] the colour follows the art: Hurricane Mantle blue, Sorcerer's Robes purple, Dawnshard Aegis warm bronze
//   [5] no armour, or a tinted one, keeps the skin limbs
//   [6] the pick is cached: no getImageData across 20 more hero draws
//   [7] the preview / co-op override wins over the player's own armour (a peer is drawn in the peer's colours)
//   [8] no page errors
// The build before fails [1], [3], [4], [7].   node scripts/armour_garments_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const fs = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11896);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
const NAMES = fs.readdirSync(path.join(ROOT, 'Sprites/equipment/armors')).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const errs = [];
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  const rel = path.relative(ROOT, path.isAbsolute(PAGE) ? PAGE : path.join(ROOT, PAGE)).split(path.sep).join('/');
  await page.goto(`http://127.0.0.1:${PORT}/${rel}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof _lxEquipSprite === 'function' && typeof player !== 'undefined', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async (NAMES) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window._lxNoGearLight = true;   // the light layer reads pixels too; keep [6] about the garments
    const eff = (n) => _lxEqErasedImg('arm:' + n) || _lxEquipSprite('armors', n);
    for (const n of NAMES) { const im = _lxEquipSprite('armors', n); if (im && typeof _lxWantImg === 'function') _lxWantImg(im, true); }
    for (let i = 0; i < 300 && !NAMES.every((n) => { const im = eff(n); return im && im.complete && im.naturalWidth; }); i++) await sleep(100);
    await sleep(300);
    const G = (n) => (typeof _lxGarmentOf === 'function') ? _lxGarmentOf(eff(n)) : null;
    const P = CanvasRenderingContext2D.prototype, f0 = P.fill, f1 = P.fillRect, d0 = P.drawImage, g0 = P.getImageData;
    const ids = new WeakMap(); let nid = 0; const idOf = (o) => { if (!ids.has(o)) ids.set(o, ++nid); return ids.get(o); };
    const draw = (ov, anim = 'walk', at = 0.25) => {
      const fills = new Set(), imgs = []; let reads = 0;
      P.fill = function (...a) { if (typeof this.fillStyle === 'string') fills.add(this.fillStyle.toLowerCase()); return f0.apply(this, a); };
      P.fillRect = function (...a) { if (typeof this.fillStyle === 'string') fills.add(this.fillStyle.toLowerCase()); return f1.apply(this, a); };
      P.drawImage = function (im, ...a) { const t = this.getTransform(); imgs.push({ im, rec: idOf(im) + '|' + a.map((v) => Math.round(v * 100) / 100).join(',') + '|' + [t.a, t.b, t.c, t.d, t.e, t.f].map((v) => Math.round(v * 100) / 100).join(',') }); return d0.call(this, im, ...a); };
      P.getImageData = function (...a) { reads++; return g0.apply(this, a); };
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 240; const c = cv.getContext('2d'); c.translate(100, 220); c.scale(2, 2);
      const keep = _LX_EQ_PREVIEW_OVERRIDE; _LX_EQ_PREVIEW_OVERRIDE = ov;
      try { _drawVectorHero(-14, -44, c, { cls: 'warrior', animName: anim, animTime: at, forcedFacing: 1 }); }
      finally { _LX_EQ_PREVIEW_OVERRIDE = keep; P.fill = f0; P.fillRect = f1; P.drawImage = d0; P.getImageData = g0; }
      return { fills, imgs, reads }; };
    const has = (fills, g) => !!g && (fills.has(g.base) || fills.has(g.mid)) && fills.has(g.boot);
    const none = (fills, g) => !g || ![g.base, g.mid, g.deep, g.boot].some((h) => fills.has(h));
    const out = {};
    // [1] + [2]
    const T = ['hurricane_mantle', 'sorcerers_robes', 'dawnshard_aegis', 'leather_vest', 'warlord_cuirass'];
    out.one = T.map((n) => { const ov = { body_top: { spriteId: 'arm:' + n } }, g = G(n);
      window._lxNoGarments = false; const on = draw(ov); window._lxNoGarments = true; const off = draw(ov); window._lxNoGarments = false;
      const src = eff(n), baked = (typeof _lxBakedDownscale === 'function') ? _lxBakedDownscale(src, 256) : null;
      const mine = (r) => r.imgs.filter((x) => x.im === src || (baked && x.im === baked)).map((x) => x.rec);
      return { n, g: g && g.base, on: has(on.fills, g), offClean: none(off.fills, g), armOn: mine(on), armOff: mine(off) }; });
    // [3] + [4]
    out.all = NAMES.map((n) => { const g = G(n); if (!g) return { n, g: null };
      const v = [1, 3, 5].map((i) => parseInt(g.base.slice(i, i + 2), 16)); return { n, g: g.base, r: v[0], gg: v[1], b: v[2] }; });
    // [5]
    const gh = G('hurricane_mantle');
    out.bare = none(draw({}).fills, gh); out.tinted = none(draw({ body_top: { spriteId: 'arm:hurricane_mantle', tint: '#ff3030' } }).fills, gh);
    // [6]
    draw({ body_top: { spriteId: 'arm:sorcerers_robes' } }); let reads = 0;
    for (let i = 0; i < 20; i++) reads += draw({ body_top: { spriteId: 'arm:' + T[i % T.length] } }, 'walk', i / 20).reads;
    out.reads = reads;
    // [7]
    const eq0 = player.equipped; const gd = G('dawnshard_aegis');
    try { player.equipped = Object.assign({}, eq0 || {}, { body_top: { spriteId: 'arm:dawnshard_aegis', name: 'Dawnshard Aegis' } });
      const own = draw(null), peer = draw({ body_top: { spriteId: 'arm:hurricane_mantle' } });
      out.peer = { own: has(own.fills, gd), peerHur: has(peer.fills, gh), peerNoOwn: none(peer.fills, gd) };
    } finally { player.equipped = eq0; }
    return out; }, NAMES);
  ok('[1] with an armour on, the limbs are filled with its garment colours; with _lxNoGarments they are not',
    R.one.every((x) => x.on && x.offClean), R.one.map((x) => x.n + ':' + x.g + ' on=' + x.on + ' off-clean=' + x.offClean));
  ok('[2] the armour art is drawn exactly as before (every armour drawImage identical with the garments on and off)',
    R.one.every((x) => x.armOn.length >= 1 && JSON.stringify(x.armOn) === JSON.stringify(x.armOff)), R.one.map((x) => x.n + ' ' + x.armOn.length + '/' + x.armOff.length));
  const bad = R.all.filter((x) => !x.g || Math.max(x.r, x.gg, x.b) > 150);
  ok('[3] every armour on disk (' + R.all.length + ') gets a dark-cloth garment (no channel above 150)', R.all.length >= 40 && !bad.length, bad.length ? bad : R.all.length);
  const A = Object.fromEntries(R.all.map((x) => [x.n, x]));
  const hue = { hurricane_mantle: (c) => c.b > c.r && c.b > c.gg, sorcerers_robes: (c) => c.b > c.gg && c.r > c.gg, dawnshard_aegis: (c) => c.r > c.gg && c.gg > c.b };
  ok('[4] the colour follows the art: Hurricane blue, Sorcerer\'s purple, Dawnshard warm bronze',
    Object.entries(hue).every(([n, f]) => A[n] && A[n].g && f(A[n])), Object.keys(hue).map((n) => n + ':' + (A[n] && A[n].g)));
  ok('[5] no armour, or a tinted one, keeps the skin limbs', R.bare && R.tinted, { bare: R.bare, tinted: R.tinted });
  ok('[6] the pick is cached: no getImageData across 20 more hero draws', R.reads === 0, R.reads);
  ok('[7] the preview / co-op override wins over the player\'s own armour', R.peer.own && R.peer.peerHur && R.peer.peerNoOwn, R.peer);
  ok('[8] no page errors', !errs.length, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
