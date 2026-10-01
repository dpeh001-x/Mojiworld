// GEAR RETWEAKS (per user, after the gear audit: "Take 2, daggers ok"). Spectre Fangs and Oblivion Whisper were rogue daggers as
// long as greatswords; they are drawn at 80% now, shrunk about the hand so the grip stays where the hand holds it. The Whittled
// Stick read as a log; its on-character art is a slender whittled stick on the same angle, held at the same spot.
//   [1] both daggers: 80% of their old Gear Align scale, angle and flips unchanged
//   [2] ...and the hand sits on the same art pixel as before (within 1 px of the 768 canvas): the grip did not move
//   [3] the Whittled Stick's worn art is a stick, not a log: under 60% of the old log's solid area, still 768 x 768, the hand's
//       grip covered, wood-coloured (no green cast)
//   [4] no page errors
// The build before fails [1] and [3].   node scripts/gear_retweak_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11894);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
// the Gear Align numbers before the retweak (what the user calibrated)
const OLD = { spectre_fangs: { scale: 1.41, dx: 3, dy: 42, rot: -2.443460952792061, flipX: true, flipY: false },
  oblivion_whisper: { scale: 1.54, dx: -29, dy: 44, rot: 3.141592653589793, flipX: false, flipY: false } };
const LOG_SOLID = 174621;   // the old log's solid texels (alpha > 128, 768 canvas) - scratch audit, 2026-10-01
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _heroVecRestPos === 'function' && typeof _lxEqAttach === 'function' && typeof _lxEqErasedImg === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async (OLD) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), p = _heroVecRestPos('handL'), D = _LX_EQ_DEST, out = {};
    const handPx = (a) => { const w = D.w * a.scale * (a.scaleX != null ? a.scaleX : 1), h = D.h * a.scale * (a.scaleY != null ? a.scaleY : 1);
      const dx = D.x + (D.w - w) / 2 + a.dx - p.x, dy = D.y + (D.h - h) / 2 + a.dy - p.y; let u = -dx / w * 768, v = -dy / h * 768; if (a.flipX) u = 768 - u; if (a.flipY) v = 768 - v; return [u, v]; };
    for (const n of Object.keys(OLD)) { const a = _lxEqAttach('wpn:' + n), o = OLD[n], h0 = handPx(o), h1 = handPx(a);
      out[n] = { ratio: +(a.scale / o.scale).toFixed(4), sameAngle: a.rot === o.rot && !!a.flipX === !!o.flipX && !!a.flipY === !!o.flipY, gripMovedPx: +Math.hypot(h1[0] - h0[0], h1[1] - h0[1]).toFixed(2) }; }
    // the stick: its worn art
    let im = null; for (let i = 0; i < 100; i++) { im = _lxEqErasedImg('wpn:whittled_stick'); if (im && im.complete && im.naturalWidth) break; await sleep(100); }
    if (im) { const c = document.createElement('canvas'); c.width = c.height = 768; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 768, 768);
      const d = g.getImageData(0, 0, 768, 768).data; let solid = 0, R = 0, G = 0, B = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { solid++; R += d[i]; G += d[i + 1]; B += d[i + 2]; }
      const hp = handPx(_lxEqAttach('wpn:whittled_stick')).map(Math.round); let cov = 0, tot = 0;
      for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) { if (x * x + y * y > 36) continue; tot++; if (d[((hp[1] + y) * 768 + hp[0] + x) * 4 + 3] > 128) cov++; }
      out.stick = { size: im.naturalWidth + 'x' + im.naturalHeight, solid, rgb: [R, G, B].map((v) => Math.round(v / Math.max(1, solid))), grip: +(cov / tot).toFixed(2) }; }
    return out; }, OLD);
  const S = R.spectre_fangs, O = R.oblivion_whisper, K = R.stick || {};
  ok('[1] Spectre Fangs and Oblivion Whisper are drawn at 80% of their old size, angle and flips unchanged',
    Math.abs(S.ratio - 0.8) < 0.002 && Math.abs(O.ratio - 0.8) < 0.002 && S.sameAngle && O.sameAngle, { spectre: S, oblivion: O });
  ok('[2] ...and the hand sits on the same art pixel as before (the grip did not move)', S.gripMovedPx < 1 && O.gripMovedPx < 1, { spectre: S.gripMovedPx, oblivion: O.gripMovedPx });
  ok('[3] the Whittled Stick is a stick: under 60% of the old log\'s solid area, 768 x 768, the grip covered, wood-coloured',
    K.size === '768x768' && K.solid < LOG_SOLID * 0.6 && K.solid > 30000 && K.grip >= 0.9 && K.rgb && !(K.rgb[1] > K.rgb[0] + 10), K);
  ok('[4] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
