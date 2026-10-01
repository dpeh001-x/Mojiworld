// BOW STRINGS (per user: "the string portion of the bow is really inconsistent with the designs and the arrows obstruct the
// character (which should be removed)"). Seven bows' on-character art (their data/gear_erase.js entries) is arrow-free and
// string-free, and the game draws one string for each: straight behind the limbs at rest, pulled back to the hand while the
// archer draws. The icons (Sprites/equipment/weapons/<bow>.webp) are untouched, so they are the "before" here:
//   [1] the painted string is gone: along the old string's middle 70%, at most 20% of its pixels survive unchanged (100% before)
//   [2] the arrows are gone: the arrowhead's disk is transparent (it was solid)
//   [3] at rest each bow draws one straight string from nock to nock, BEFORE the bow's own blit (behind the limbs), the nocks
//       being the table's art pixels mapped into the very rect the bow is blitted in
//   [4] at full draw the straight string is not drawn; the pulled one runs from both nocks to the hand, well off the straight line
//   [5] placement: every bow's Gear Align numbers are the file's, and the bow's blit is the same with the string code stubbed
//   [6] no page errors
// The build before fails [1]-[4].   node scripts/bow_string_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import vm from 'node:vm';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11898);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) + ']' : '')); };
const sb = { window: {} }; vm.runInNewContext(readFileSync(path.join(ROOT, 'data/gear_calibration.js'), 'utf8'), sb); const CALIB = sb.window.LX_EQ_ATTACH_DATA;
// the old painted strings (art pixels, 768 canvas) and the old arrowheads, measured on the icon files
const OLD = {
  hunters_shortbow: { s: [[507, 178], [250, 582]], head: [535, 440] },
  falcon_recurve: { s: [[390, 222], [209, 480], [219, 611]] },
  marksmans_compound: { s: [[491, 170], [372, 367], [312, 470], [256, 612]] },
  thunderbow: { s: [[466, 157], [380, 290], [372, 345], [351, 405], [320, 525], [301, 600]], head: [185, 328] },
  tempest_longbow: { s: [[463, 160], [497, 280], [510, 320], [532, 400], [545, 450]], head: [174, 341] },
  hurricane_bow: { s: [[465, 142], [251, 318], [313, 614]], head: [195, 288] },
  apex_predator: { s: [[541, 153], [300, 375], [284, 600]], head: [186, 349] },
};
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof LX_EQUIP_FILES === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  const R = await page.evaluate(async ({ OLD, CALIB }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = { art: {}, rest: {}, drawn: {}, place: [] }, N = 768;
    const bows = Object.keys(OLD), file = (n) => _lxEquipSprite('weapons', n), eff = (n) => _lxEqErasedImg('wpn:' + n) || file(n);
    for (let i = 0; i < 200; i++) { if (bows.every((n) => { const f = file(n), e = eff(n); return f.complete && f.naturalWidth && e && e.complete && e.naturalWidth && _lxBakedDownscale(e, 256); })) break; await sleep(100); }
    await sleep(300);
    const px = (img) => { const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return g.getImageData(0, 0, N, N).data; };
    for (const n of bows) { const o = px(file(n)), q = px(eff(n)), P = OLD[n].s;
      let acc = 0; const L = []; for (let i = 0; i + 1 < P.length; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); L.push(l); acc += l; }
      let s = 0, tot = 0, kept = 0;
      for (let i = 0; i + 1 < P.length; i++) { for (let u = 0; u < L[i]; u += 3) { const f = (s + u) / acc; if (f < 0.15 || f > 0.85) continue;
          const x = Math.round(P[i][0] + (P[i + 1][0] - P[i][0]) * u / L[i]), y = Math.round(P[i][1] + (P[i + 1][1] - P[i][1]) * u / L[i]);
          for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) { const j = ((y + oy) * N + x + ox) * 4; if (o[j + 3] <= 128) continue; tot++;
            if (q[j + 3] > 128 && Math.abs(o[j] - q[j]) <= 12 && Math.abs(o[j + 1] - q[j + 1]) <= 12 && Math.abs(o[j + 2] - q[j + 2]) <= 12) kept++; } }
        s += L[i]; }
      const disk = (d, c) => { let k = 0, a = 0; for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) { if (x * x + y * y > 100) continue; k++; a += d[((c[1] + y) * N + c[0] + x) * 4 + 3]; } return +(a / k / 255).toFixed(2); };
      out.art[n] = { erase: !!_lxEqErasedImg('wpn:' + n), size: eff(n).naturalWidth + 'x' + eff(n).naturalHeight, kept: +(kept / Math.max(1, tot)).toFixed(3), head: OLD[n].head ? [disk(o, OLD[n].head), disk(q, OLD[n].head)] : null }; }
    // the hero holding each bow; the string calls (_lxBowStrokes, if this build has it) and the bow's blit, in order
    const P2 = CanvasRenderingContext2D.prototype, di = P2.drawImage;
    const hold = (n, anim, at, stubString) => { const cv = document.createElement('canvas'); cv.width = cv.height = 300; const c = cv.getContext('2d'), ev = [];
      const bake = _lxBakedDownscale(eff(n), 256), keepS = window._lxBowStrokes, keepD = window._lxBowStringDraw;
      if (typeof keepS === 'function') window._lxBowStrokes = function (cc, S, k, pts) { ev.push({ t: 'string', pts: pts.slice() }); return keepS.apply(this, arguments); };
      if (stubString && typeof keepD === 'function') window._lxBowStringDraw = function () {};
      P2.drawImage = function (src) { if (this === c && src === bake) { const m = this.getTransform(); ev.push({ t: 'blit', a: [...arguments].slice(1).map((v) => +(+v).toFixed(4)), m: [m.a, m.b, m.c, m.d, m.e, m.f].map((v) => +v.toFixed(4)) }); } return di.apply(this, arguments); };
      const keep = _LX_EQ_PREVIEW_OVERRIDE; _LX_EQ_PREVIEW_OVERRIDE = { weapon: { spriteId: 'wpn:' + n } }; window._lxNoGearLight = true;
      c.translate(150, 280); c.scale(1.6, 1.6);
      try { _drawVectorHero(-14, -44, c, { cls: 'archer', animName: anim, animTime: at, forcedFacing: 1 }); }
      finally { P2.drawImage = di; window._lxBowStrokes = keepS; window._lxBowStringDraw = keepD; _LX_EQ_PREVIEW_OVERRIDE = keep; window._lxNoGearLight = false; }
      let pulled = null; try { pulled = _hvBowPulled; } catch (e) {}
      const X = (typeof _lxBowXf !== 'undefined') ? _lxBowXf : null;
      return { ev, pulled, X: X ? { ax: X.ax, ay: X.ay, bx: X.bx, by: X.by } : null }; };
    const table = (typeof _LX_BOW_STRING === 'object') ? _LX_BOW_STRING : {};
    for (const n of bows) { const S = table['wpn:' + n];
      const r = hold(n, 'idle', 0, false), strings = r.ev.filter((e) => e.t === 'string'), blit = r.ev.find((e) => e.t === 'blit');
      const iS = r.ev.findIndex((e) => e.t === 'string'), iB = r.ev.findIndex((e) => e.t === 'blit');
      let nockOk = false;
      if (S && blit && r.X) { const [bx, by, bw, bh] = blit.a; const ex = [bx + S.a[0] * bw / 768, by + S.a[1] * bh / 768, bx + S.b[0] * bw / 768, by + S.b[1] * bh / 768];
        nockOk = Math.abs(ex[0] - r.X.ax) < 1e-3 && Math.abs(ex[1] - r.X.ay) < 1e-3 && Math.abs(ex[2] - r.X.bx) < 1e-3 && Math.abs(ex[3] - r.X.by) < 1e-3
          && strings.length === 1 && strings[0].pts.length === 4 && Math.abs(strings[0].pts[0] - ex[0]) < 1e-3 && Math.abs(strings[0].pts[3] - ex[3]) < 1e-3; }
      out.rest[n] = { strings: strings.length, behind: iS >= 0 && iB >= 0 && iS < iB, nockOk };
      const d = hold(n, 'attack_archer', 0.22, false), ds = d.ev.filter((e) => e.t === 'string');
      let off = 0; if (ds.length === 1 && ds[0].pts.length === 6) { const p = ds[0].pts, vx = p[4] - p[0], vy = p[5] - p[1]; off = Math.abs((p[2] - p[0]) * vy - (p[3] - p[1]) * vx) / Math.hypot(vx, vy); }
      out.drawn[n] = { pulled: d.pulled, strings: ds.length, pts: ds[0] ? ds[0].pts.length : 0, offPx: +off.toFixed(1) };
      const st = hold(n, 'idle', 0, true), b1 = blit, b2 = st.ev.find((e) => e.t === 'blit');
      const att = _lxEqAttach('wpn:' + n), cal = CALIB['wpn:' + n], calOk = !!cal && Object.keys(cal).every((k) => att[k] === cal[k]);
      if (!calOk || !b1 || !b2 || JSON.stringify(b1.a) !== JSON.stringify(b2.a) || JSON.stringify(b1.m) !== JSON.stringify(b2.m)) out.place.push(n); }
    return out;
  }, { OLD, CALIB });
  const A = R.art, bows = Object.keys(OLD);
  ok('[1] the painted string is gone: along its middle 70%, at most 20% of the old string pixels survive unchanged (all of them before)',
    bows.every((n) => A[n].erase && A[n].size === '768x768' && A[n].kept <= 0.2), Object.fromEntries(bows.map((n) => [n, A[n].kept + (A[n].erase ? '' : ' (no erase entry)')])));
  ok('[2] the arrows are gone: each arrowhead disk is transparent (it was solid)',
    bows.filter((n) => OLD[n].head).every((n) => A[n].head[0] > 0.5 && A[n].head[1] < 0.1), Object.fromEntries(bows.filter((n) => OLD[n].head).map((n) => [n, A[n].head])));
  ok('[3] at rest: one straight string from nock to nock, behind the limbs, the nocks mapped into the rect the bow is blitted in',
    bows.every((n) => R.rest[n].strings === 1 && R.rest[n].behind && R.rest[n].nockOk), R.rest);
  ok('[4] at full draw: no straight string; the pulled one runs nock - hand - nock, well off the straight line',
    bows.every((n) => R.drawn[n].pulled === true && R.drawn[n].strings === 1 && R.drawn[n].pts === 6 && R.drawn[n].offPx > 3), R.drawn);
  ok('[5] placement: Gear Align numbers are the file\'s, and each bow blits the same with the string code stubbed', R.place.length === 0, R.place);
  ok('[6] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
