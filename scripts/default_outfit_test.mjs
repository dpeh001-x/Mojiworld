// DEFAULT OUTFIT (per user, 2026-10-01: "When character does not wear any armor can we have the character wear a generic blackshirt
// with the word (Moji) and a denim black pants", then "The moji can be chest level, the pants can be shorter"). With no body armour
// the hero wears a black tee (short sleeves, "Moji" across the chest), cropped black denim jeans and dark sneakers with white soles.
//   [1] no armour: the jeans (denim), the sneakers (shoe + sole) and the sleeves (the tee's black on the arms) are drawn, and the
//       chest print is drawn once
//   [2] the print reads left to right whichever way the hero faces (its on-screen x axis points right in both facings)
//   [3] the print sits at chest level, in the torso's upper half, and the jeans end above the shoe (the shin shows)
//   [4] any body armour replaces it: no outfit colours, no print (the limbs take the armour's garments instead)
//   [5] window._lxNoOutfit (the A/B switch) turns it off
//   [6] no page errors
// The build before fails [1]-[3].   node scripts/default_outfit_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const fs = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11898);
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
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof _lxEquipSprite === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); window._lxNoGearLight = true;
    try { await document.fonts.load('600 24px Fredoka'); } catch (e) {}
    const arm = _lxEqErasedImg('arm:plate_armor') || _lxEquipSprite('armors', 'plate_armor');
    for (let i = 0; i < 150 && !(arm && arm.complete && arm.naturalWidth); i++) await sleep(100);
    const O = (typeof _LX_OUTFIT === 'object') ? _LX_OUTFIT : null;
    const P = CanvasRenderingContext2D.prototype, f0 = P.fill, f1 = P.fillRect, d0 = P.drawImage;
    const draw = (ov, face, off) => { const fills = new Set(), prints = [];
      const rec = function () { if (typeof this.fillStyle === 'string') fills.add(this.fillStyle.toLowerCase()); };
      P.fill = function (...a) { rec.call(this); return f0.apply(this, a); }; P.fillRect = function (...a) { rec.call(this); return f1.apply(this, a); };
      P.drawImage = function (im, ...a) { if (im && im.width === 256 && im.height === 112 && im.tagName === 'CANVAS') { const t = this.getTransform(); prints.push({ a: t.a, d: t.d, y: t.f + t.d * (a[1] + a[3] / 2), x: t.e + t.a * (a[0] + a[2] / 2) }); } return d0.call(this, im, ...a); };
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 240; const c = cv.getContext('2d'); c.translate(100, 225); c.scale(2, 2);
      const keep = _LX_EQ_PREVIEW_OVERRIDE; _LX_EQ_PREVIEW_OVERRIDE = ov; window._lxNoOutfit = !!off;
      try { _drawVectorHero(-14, -44, c, { cls: 'warrior', animName: 'idle', animTime: 0, forcedFacing: face }); }
      finally { _LX_EQ_PREVIEW_OVERRIDE = keep; window._lxNoOutfit = false; P.fill = f0; P.fillRect = f1; P.drawImage = d0; }
      return { fills, prints }; };
    const has = (r) => !!O && [O.denim, O.denimShd, O.shoe, O.sole].every((h) => r.fills.has(h));
    const none = (r) => !O || ![O.denim, O.denimShd, O.shoe, O.sole].some((h) => r.fills.has(h));
    const S = typeof HERO_VEC_DRAW_SCALE === 'number' ? HERO_VEC_DRAW_SCALE : 1, SP = HERO_VEC_RIG.spine;
    const bare = draw({}, 1), left = draw({}, -1), armd = draw({ body_top: { spriteId: 'arm:plate_armor' } }, 1), offd = draw({}, 1, true);
    // the torso spans the spine bone's 29 units above the hip line: chest level = its upper half
    const hipY = 225 + 2 * S * SP.y, topY = hipY - 2 * S * 29;
    return { O: !!O, tee: bare.fills.has('#28282e'), bare: has(bare), prints: bare.prints, left: { has: has(left), prints: left.prints },
      chest: bare.prints.length ? { y: Math.round(bare.prints[0].y), top: Math.round(topY), mid: Math.round((topY + hipY) / 2), hip: Math.round(hipY) } : null,
      crop: O ? O.crop : null, armd: { none: none(armd), prints: armd.prints.length }, off: { none: none(offd), prints: offd.prints.length } }; });
  ok('[1] no armour: jeans, sneakers (shoe + sole) and the tee are drawn, and the chest print once', R.O && R.bare && R.tee && R.prints.length === 1, { O: R.O, outfit: R.bare, prints: R.prints.length });
  ok('[2] the print reads left to right in both facings', R.prints.length === 1 && R.left.prints.length === 1 && R.prints[0].a > 0 && R.left.prints[0].a > 0, { right: R.prints, left: R.left.prints });
  ok('[3] the print sits at chest level (upper half of the torso) and the jeans end above the shoe', !!R.chest && R.chest.y > R.chest.top && R.chest.y < R.chest.mid && R.crop > 4 && R.crop < 9, { chest: R.chest, crop: R.crop });
  ok('[4] body armour replaces it: no outfit colours, no print', R.armd.none && R.armd.prints === 0, R.armd);
  ok('[5] window._lxNoOutfit turns it off', R.off.none && R.off.prints === 0, R.off);
  ok('[6] no page errors', !errs.length, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
