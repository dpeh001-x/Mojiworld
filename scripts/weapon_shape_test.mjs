// WEAPON SHAPE + OUTLINES (per user, 2026-10-02: "some of the weapons appear to be diagonally stretched such as hammer", "make the outline
// of the weapons slightly thinner"). Weapon art is square and
// drawn on its upper-right diagonal, but it was drawn into the hero's 60x80 box - stretched a third along the art's y axis, a shear on a
// diagonal weapon (a hammer's square head became a slanted parallelogram). The weapon frame is now square about the grip.
//   [1] every weapon's art is drawn square - its x and y axes the same length, at right angles - at rest and mid-swing
//   [2] each weapon keeps its reach and its angle: both art diagonals as long as before and the handle diagonal pointing the same way
//       (window._lxNoWeaponUnskew = true is the old draw)
//   [3] the grip stays in the hand: the art point at the hand bone is the same point with and without the fix
//   [4] only the weapon slot changes: a body armour draws exactly as before
//   [5] the heavy outlines are thinner: the bake each weapon is drawn from has a narrower outline than a plain downscale of its art
//   [6] the art inside the outline is untouched (bright opaque texels match the plain downscale)
//   [7] window._lxThickInk keeps the outline (no thinning)
//   [8] no page errors
// The build before fails [1], [5] and [7].   node scripts/weapon_shape_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const fs = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11902);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
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
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof _drawEquipmentLayer === 'function' && typeof LX_EQUIP_FILES === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); window._lxNoGearLight = true;
    const NAMES = LX_EQUIP_FILES.weapons.slice(), eff = (n) => _lxEqErasedImg('wpn:' + n) || _lxEquipSprite('weapons', n);
    for (const n of NAMES) eff(n);
    for (let i = 0; i < 400 && !NAMES.every((n) => eff(n) && eff(n).complete && eff(n).naturalWidth && _lxBakedDownscale(eff(n), 256)); i++) await sleep(50);
    const P2 = CanvasRenderingContext2D.prototype, d0 = P2.drawImage, L0 = _drawEquipmentLayer;
    // one hero draw: the weapon art's drawn frame (transform + rect) and the hand bone origin (the frame _drawEquipmentLayer('weapon') starts in)
    const shot = (n, a, t, off) => { let rec = null, hand = null; const src = eff(n), bake = _lxBakedDownscale(src, 256);
      P2.drawImage = function (im, ...q) { if (!rec && (im === src || im === bake) && q.length === 4) rec = { M: this.getTransform(), q }; return d0.call(this, im, ...q); };
      _drawEquipmentLayer = function (layer, c, opts) { if (layer === 'weapon' && !hand) hand = (c || ctx).getTransform().transformPoint(new DOMPoint(0, 0)); return L0.apply(this, arguments); };
      const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400; const c = cv.getContext('2d'); c.translate(200, 360); c.scale(4, 4);
      const keep = _LX_EQ_PREVIEW_OVERRIDE; _LX_EQ_PREVIEW_OVERRIDE = { weapon: { spriteId: 'wpn:' + n } }; window._lxNoWeaponUnskew = !!off;
      try { _drawVectorHero(-14, -44, c, { cls: 'warrior', animName: a, animTime: t, forcedFacing: 1 }); }
      finally { P2.drawImage = d0; _drawEquipmentLayer = L0; _LX_EQ_PREVIEW_OVERRIDE = keep; window._lxNoWeaponUnskew = false; }
      if (!rec || !hand) return null; const [dx, dy, w, h] = rec.q, M = rec.M, ax = [M.a * w, M.b * w], ay = [M.c * h, M.d * h];
      const inv = M.inverse(), p = inv.transformPoint(hand), grip = [(p.x - dx) / w * 768, (p.y - dy) / h * 768];
      const d1 = [ax[0] - ay[0], ax[1] - ay[1]], d2 = [ax[0] + ay[0], ax[1] + ay[1]], la = Math.hypot(...ax), lb = Math.hypot(...ay);
      return { la, lb, ang: Math.acos((ax[0] * ay[0] + ax[1] * ay[1]) / (la * lb)) * 180 / Math.PI, d1: Math.hypot(...d1), d2: Math.hypot(...d2), dir: Math.atan2(d1[1], d1[0]) * 180 / Math.PI, grip }; };
    const out = { notSquare: [], reach: [], grip: [], missing: [] };
    for (const n of NAMES) for (const [a, t] of [['idle', 0], ['attack_warrior', 0.3]]) {
      const on = shot(n, a, t, false), off = shot(n, a, t, true); if (!on || !off) { out.missing.push(n + '@' + a); continue; }
      if (Math.abs(on.la - on.lb) / Math.max(on.la, on.lb) > 0.01 || Math.abs(on.ang - 90) > 0.5) out.notSquare.push(n + '@' + a + ' ' + (on.la / 4).toFixed(1) + 'x' + (on.lb / 4).toFixed(1));
      let dd = Math.abs(on.dir - off.dir); if (dd > 180) dd = 360 - dd;
      if (Math.abs(on.d1 - off.d1) / off.d1 > 0.005 || Math.abs(on.d2 - off.d2) / off.d2 > 0.005 || dd > 0.3) out.reach.push(n + '@' + a + ' dir ' + dd.toFixed(2));
      if (Math.hypot(on.grip[0] - off.grip[0], on.grip[1] - off.grip[1]) > 0.5) out.grip.push(n + '@' + a);
    }
    // [4] a body armour's draw, fix on vs off
    { const src = _lxEqErasedImg('arm:plate_armor') || _lxEquipSprite('armors', 'plate_armor'); for (let i = 0; i < 200 && !(src.complete && src.naturalWidth); i++) await sleep(50);
      const arm = (off) => { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 300; const c = cv.getContext('2d'); c.translate(150, 280); c.scale(3, 3);
        const keep = _LX_EQ_PREVIEW_OVERRIDE; _LX_EQ_PREVIEW_OVERRIDE = { body_top: { spriteId: 'arm:plate_armor' } }; window._lxNoWeaponUnskew = !!off;
        try { _drawVectorHero(-14, -44, c, { cls: 'warrior', animName: 'idle', animTime: 0, forcedFacing: 1 }); } finally { _LX_EQ_PREVIEW_OVERRIDE = keep; window._lxNoWeaponUnskew = false; }
        return cv.toDataURL(); };
      arm(false); await sleep(400); out.armourSame = arm(false) === arm(true); }
    // [5]-[7] the outlines: the bake a weapon is drawn from vs a plain downscale of its art
    const ow = (d, N) => { const dark = (i) => d[i * 4 + 3] >= 128 && Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) < 70, runs = [];
      for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const i = y * N + x; if (!dark(i)) continue; let ex = null;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + ay) * N + x + ax; if (d[j * 4 + 3] < 40) { ex = [ax, ay]; break; } } if (!ex) continue;
        let r = 0, xx = x, yy = y; while (r < 40 && xx >= 0 && yy >= 0 && xx < N && yy < N && dark(yy * N + xx)) { r++; xx -= ex[0]; yy -= ex[1]; } runs.push(r); }
      runs.sort((a, b) => a - b); return runs.length ? runs[runs.length >> 1] : 0; };
    out.ink = []; out.inside = [];
    for (const n of ['wooden_sword', 'apocalypse_reaver', 'assassins_edge', 'crusader_mace']) { const img = eff(n), bake = _lxBakedDownscale(img, 256);
      const p = document.createElement('canvas'); p.width = p.height = 256; const pc = p.getContext('2d', { willReadFrequently: true }); pc.imageSmoothingQuality = 'high'; pc.drawImage(img, 0, 0, 256, 256);
      const b = document.createElement('canvas'); b.width = b.height = 256; const bc = b.getContext('2d', { willReadFrequently: true }); bc.drawImage(bake, 0, 0);
      const pd = pc.getImageData(0, 0, 256, 256).data, bd = bc.getImageData(0, 0, 256, 256).data; let n2 = 0, same = 0;
      for (let i = 0; i < pd.length; i += 4) { if (pd[i + 3] < 250 || bd[i + 3] < 250 || Math.max(pd[i], pd[i + 1], pd[i + 2]) < 110) continue; n2++;
        if (Math.abs(pd[i] - bd[i]) + Math.abs(pd[i + 1] - bd[i + 1]) + Math.abs(pd[i + 2] - bd[i + 2]) <= 24) same++; }
      out.ink.push({ n, plain: ow(pd, 256), drawn: ow(bd, 256) }); out.inside.push({ n, share: +(same / Math.max(1, n2)).toFixed(3) }); }
    if (typeof _lxThinInk === 'function') { window._lxThickInk = true; out.offSwitch = _lxThinInk(_lxBakedDownscale(eff('wooden_sword'), 256), 256) === null; window._lxThickInk = false; } else out.offSwitch = false;
    out.n = NAMES.length; return out; });
  ok('[1] every weapon`s art is drawn square, at rest and mid-swing'.split('`').join("'"), R.n === 43 && !R.notSquare.length && !R.missing.length, { n: R.n, notSquare: R.notSquare.slice(0, 6), missing: R.missing.slice(0, 6) });
  ok('[2] each weapon keeps its reach and its angle (both diagonals, the handle direction)', !R.reach.length && !R.missing.length, R.reach.slice(0, 6));
  ok('[3] the grip stays in the hand', !R.grip.length && !R.missing.length, R.grip.slice(0, 6));
  ok('[4] only the weapon slot changes: a body armour draws exactly as before', R.armourSame === true, R.armourSame);
  ok('[5] the heavy outlines are thinner (the drawn bake vs a plain downscale)', R.ink.length === 4 && R.ink.every((v) => v.drawn < v.plain && v.drawn >= 2), R.ink);
  ok('[6] the art inside the outline is untouched', R.inside.length === 4 && R.inside.every((v) => v.share >= 0.97), R.inside);
  ok('[7] window._lxThickInk keeps the outline', R.offSwitch === true, R.offSwitch);
  ok('[8] no page errors', !errs.length, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
