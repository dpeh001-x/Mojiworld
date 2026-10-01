// ARMOUR SHOULDERS + DAWNSHARD PADS (per user, 2026-10-01: "only 1 arm is covered the other arm is not", "shoulderpad should be
// infront of the shoulder", "the 2 sides the shoulder pads are oddly shaped"). Body armour art carries both pauldrons, but the front
// arm is drawn over the armour, so it hid the near one; the armour is now drawn once more where the front arm's root (and its
// outline) overlaps it, so that arm comes out from under its own pad - and the cover slides back into the shoulder as the arm lifts.
// The Dawnshard Aegis's worn art had kept a chunk of its sunburst halo (a ring and one big ray) on each pad; both are cut back to
// the pad's rim and outlined.
//   [1] with armour on, idle and the whole walk draw the armour twice (the torso, then the front shoulder); one with the cover off
//   [2] the cover slides off a lifted arm: the mage's cast and the archer's draw (arm lifted ~1.4 / ~1.9 rad) draw the armour once
//   [3] the torso's own armour draw is identical with the cover on and off (placement untouched), and no armour draws nothing
//   [4] the cover changes the front arm's top (armour over the sleeve there), and only there: the hand below it is the same
//   [5] Dawnshard pads: both old ray tips are clear, an outline sits above both rims, both pads' insides are kept
//   [6] no page errors
// The build before fails [1], [4], [5].   node scripts/armour_shoulder_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const fs = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11897);
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
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof _lxEquipSprite === 'function' && window.LX_EQ_ERASE_DATA, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); window._lxNoGearLight = true;
    const NAMES = ['plate_armor', 'dawnshard_aegis', 'sorcerers_robes'];
    const eff = (n) => _lxEqErasedImg('arm:' + n) || _lxEquipSprite('armors', n);
    for (const n of NAMES) { const im = _lxEquipSprite('armors', n); if (im && typeof _lxWantImg === 'function') _lxWantImg(im, true); }
    for (let i = 0; i < 300 && !NAMES.every((n) => eff(n) && eff(n).complete && eff(n).naturalWidth && _lxBakedDownscale(eff(n), 256)); i++) await sleep(100);
    await sleep(400);
    const P = CanvasRenderingContext2D.prototype, d0 = P.drawImage;
    const draw = (ov, anim, at, cls, off) => { const recs = [];
      P.drawImage = function (im, ...a) { const t = this.getTransform(); recs.push({ im, k: a.map((v) => Math.round(v * 100) / 100).join(',') + '|' + [t.a, t.b, t.c, t.d, t.e, t.f].map((v) => Math.round(v * 100) / 100).join(',') }); return d0.call(this, im, ...a); };
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 240; const c = cv.getContext('2d'); c.translate(100, 225); c.scale(2, 2);
      const keep = _LX_EQ_PREVIEW_OVERRIDE; _LX_EQ_PREVIEW_OVERRIDE = ov; window._lxNoShoulderCap = !!off;
      try { _drawVectorHero(-14, -44, c, { cls: cls || 'warrior', animName: anim, animTime: at, forcedFacing: 1 }); }
      finally { _LX_EQ_PREVIEW_OVERRIDE = keep; window._lxNoShoulderCap = false; P.drawImage = d0; }
      return { recs, cv }; };
    const mine = (n, r) => { const src = eff(n), b = _lxBakedDownscale(src, 256); return r.recs.filter((x) => x.im === src || (b && x.im === b)); };
    const out = {};
    const ov = (n) => ({ body_top: { spriteId: 'arm:' + n } });
    for (const n of NAMES) draw(ov(n), 'idle', 0);   // warm-up: the first draw of a piece also reads its garment colour (one 40x40 drawImage)
    out.rest = NAMES.map((n) => ({ n, idle: mine(n, draw(ov(n), 'idle', 0)).length, walk: [0, 0.25, 0.5, 0.75].map((t) => mine(n, draw(ov(n), 'walk', t)).length), off: mine(n, draw(ov(n), 'idle', 0, null, true)).length }));
    out.lifted = NAMES.map((n) => ({ n, mage: mine(n, draw(ov(n), 'attack_mage', 0.5, 'mage')).length, archer: mine(n, draw(ov(n), 'attack_archer', 0.4, 'archer')).length }));
    out.same = NAMES.map((n) => { const a = mine(n, draw(ov(n), 'idle', 0)), b = mine(n, draw(ov(n), 'idle', 0, null, true)); return a.length >= 1 && b.length === 1 && a[0].k === b[0].k; });
    out.bare = draw({}, 'idle', 0).recs.filter((x) => NAMES.some((n) => x.im === eff(n))).length;
    // [4] pixels: the front arm's top (shoulder joint, rig-space) vs the hand at its tip, cover on and off
    const S = typeof HERO_VEC_DRAW_SCALE === 'number' ? HERO_VEC_DRAW_SCALE : 1, J = HERO_VEC_RIG.armL, SP = HERO_VEC_RIG.spine;
    const at = (x, y) => [Math.round(100 + 2 * S * x), Math.round(225 + 2 * S * y)];
    const avg = (cv, p) => { const d = cv.getContext('2d').getImageData(p[0] - 1, p[1] - 1, 3, 3).data; const s = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += d[i + k] / 9; return s.map(Math.round); };
    const top = at(SP.x + J.x, SP.y + J.y + 1.5), hand = at(SP.x + J.x - 2, SP.y + J.y + 12);
    const on = draw(ov('plate_armor'), 'idle', 0).cv, off = draw(ov('plate_armor'), 'idle', 0, null, true).cv;
    const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    out.px = { top: [avg(on, top), avg(off, top)], hand: [avg(on, hand), avg(off, hand)] };
    out.px.dTop = diff(out.px.top[0], out.px.top[1]); out.px.dHand = diff(out.px.hand[0], out.px.hand[1]);
    // [5] the Dawnshard worn art itself
    const im = new Image(); im.src = window.LX_EQ_ERASE_DATA['arm:dawnshard_aegis']; await im.decode();
    const cv = document.createElement('canvas'); cv.width = cv.height = 768; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, 768, 768);
    const px = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return { a: d[3], mx: Math.max(d[0], d[1], d[2]) }; };
    out.dawn = { w: im.naturalWidth, tips: [[166, 161], [603, 161]].map((p) => px(...p)),
      outline: [[245, 223], [276, 203], [230, 236], [300, 206], [540, 222], [560, 236], [585, 258]].map((p) => px(...p)),
      pads: [[262, 262], [290, 250], [548, 262], [575, 290]].map((p) => px(...p)) };
    return out; });
  ok('[1] with armour on, idle and the whole walk draw the armour twice (torso, then the front shoulder); once with the cover off',
    R.rest.every((x) => x.idle === 2 && x.walk.every((v) => v === 2) && x.off === 1), R.rest);
  ok('[2] the cover slides off a lifted arm: the mage cast and the archer draw draw the armour once', R.lifted.every((x) => x.mage === 1 && x.archer === 1), R.lifted);
  ok('[3] the torso armour draw is identical with the cover on and off, and no armour draws nothing', R.same.every(Boolean) && R.bare === 0, { same: R.same, bare: R.bare });
  ok('[4] the cover changes the front arm`s top (armour over the sleeve) and leaves the hand at its tip alone'.split('`').join("'"), R.px.dTop > 40 && R.px.dHand < 12, R.px);
  const D = R.dawn;
  ok('[5] Dawnshard pads: both old ray tips clear, an outline above both rims, both pads kept',
    D.w === 768 && D.tips.every((p) => p.a < 20) && D.outline.every((p) => p.a > 200 && p.mx < 70) && D.pads.every((p) => p.a > 200 && p.mx > 110), D);
  ok('[6] no page errors', !errs.length, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
