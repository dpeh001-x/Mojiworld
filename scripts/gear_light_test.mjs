// GEAR LIGHT (per user: "for some weapons and armors that have flames/ glows they can be animated, but I want you to strictly keep
// the positions of the equipment throughout"). 51 pieces get a layer of light drawn right after the piece, in the same transform
// and rect, built from the piece's own art. One page, every piece worn by the hero:
//   [1] POSITIONS: for all 86 pieces the piece's own blit (source, dest rect, transform) is identical with the light on and off,
//       every light blit uses exactly that rect and transform, and every Gear Align number is the one data/gear_calibration.js holds
//   [2] CONTAINMENT: in every baked frame of every animated piece, the light's alpha never exceeds the drawn bake's own alpha
//       (nothing lands outside the silhouette), and it is zero on the dark outline
//   [3] it moves: two clock values differ, the same clock value repeats exactly
//   [4] it stays off under reduced motion, very-low FX, a tint, and window._lxNoGearLight; on otherwise
//   [5] every listed piece is real art and bakes; the heaviest bake step is short
//   [6] no page errors
// The fire pieces that have flame data (data/gear_flames.js) draw their flame-free body in the art's place - same source rect, dest
// rect and transform - and their flames over a part of that rect in the same transform; fire_motion_test checks them (their flames
// may reach past the painted silhouette, so [2] does not apply to them).
// The build before fails [1] (no light blits), [3] and [4].   node scripts/gear_light_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import vm from 'node:vm';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11897);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
const sb = { window: {} }; vm.runInNewContext(readFileSync(path.join(ROOT, 'data/gear_calibration.js'), 'utf8'), sb); const CALIB = sb.window.LX_EQ_ATTACH_DATA;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof LX_EQUIP_FILES === 'object' && typeof ITEM_POOL === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  const R = await page.evaluate(async (CALIB) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const ANIM = (typeof _LX_EQ_ANIM === 'object') ? _LX_EQ_ANIM : {};
    const all = [...LX_EQUIP_FILES.weapons.map((n) => 'wpn:' + n), ...LX_EQUIP_FILES.armors.map((n) => 'arm:' + n)];
    const defs = {}; for (const d of [...ITEM_POOL.weapons, ...ITEM_POOL.armors]) defs[_itemKey(d)] = d;
    const eff = (sid) => _lxEqErasedImg(sid) || _lxEquipSprite(sid.startsWith('wpn:') ? 'weapons' : 'armors', sid.slice(4));
    // every piece's art and its 256 bake in
    for (let i = 0; i < 600; i++) { let n = 0; for (const s of all) { const im = eff(s); if (im && im.complete && im.naturalWidth && _lxBakedDownscale(im, 256)) n++; } if (n === all.length) break; await sleep(100); }
    const HAS = typeof _lxEqAnimGet === 'function';
    // animated pieces bake a few at a time - the game keeps at most _LX_EQ_ANIM_KEEP pieces' frames (more would evict each other)
    const bake = async (list) => { if (!HAS) return; for (let i = 0; i < 600; i++) { let r = 0; for (const s of list) { _lxEqAnimGet(s, eff(s)); const A = _LX_EQ_ANIM_CACHE.get(s); if (A && A.ready) r++; } if (r === list.length) return; await sleep(50); } };
    // the hero wearing one piece, every drawImage recorded with its source, dest and transform
    const P = CanvasRenderingContext2D.prototype, di = P.drawImage;
    const wear = (sid, on) => { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 300; const c = cv.getContext('2d'); const rec = [];
      P.drawImage = function (src) { if (this === c) { const t = this.getTransform(); rec.push({ src, a: [...arguments].slice(1).map((v) => +(+v).toFixed(4)), t: [t.a, t.b, t.c, t.d, t.e, t.f].map((v) => +v.toFixed(4)) }); } return di.apply(this, arguments); };
      const keep = _LX_EQ_PREVIEW_OVERRIDE, d = defs[sid.slice(4)] || {}; window._lxNoGearLight = !on;
      _LX_EQ_PREVIEW_OVERRIDE = sid.startsWith('wpn:') ? { weapon: { spriteId: sid } } : { body_top: { spriteId: sid } };
      c.translate(150, 280); c.scale(1.6, 1.6);
      try { _drawVectorHero(-14, -44, c, { cls: d.cls && d.cls !== 'any' ? d.cls : 'warrior', animName: 'idle', animTime: 0, forcedFacing: 1 }); } finally { P.drawImage = di; _LX_EQ_PREVIEW_OVERRIDE = keep; window._lxNoGearLight = false; }
      return rec; };
    window._lxEqAnimClock = 12900;   // a moment where every effect shows (0.3 s into the sheen's sweep)
    const pos = [], lightless = [], bad = [];
    const eq = (p, q) => !!p && !!q && JSON.stringify(p.a) === JSON.stringify(q.a) && JSON.stringify(p.t) === JSON.stringify(q.t);
    const check = (sid) => { const bmp = _lxBakedDownscale(eff(sid), 256), A = HAS && _LX_EQ_ANIM_CACHE.get(sid);
      const off = wear(sid, false).filter((r) => r.src === bmp), on = wear(sid, true);
      const F = A && A.fl, body = (r) => r.src === bmp || (F && (r.src === F.small || r.src === F.full));
      const flameBlit = (r) => !!F && (F.frames.some((f) => f.cv === r.src) || (typeof _lxEmberSprite !== 'undefined' && r.src === _lxEmberSprite));
      const base = on.filter(body), light = A ? on.filter((r) => A.frames.includes(r.src) || flameBlit(r)) : [];
      const same = off.length >= 1 && off.length === base.length && off.every((r, i) => eq(r, base[i]));
      const sameT = (p, q) => JSON.stringify(p.t) === JSON.stringify(q.t);
      const lightOk = light.every((r) => base.some((b) => flameBlit(r) ? sameT(r, b) : eq(r, b)));   // flames: the piece's transform, over a part of its rect
      const att = _lxEqAttach(sid), cal = CALIB[sid], calOk = !!cal && Object.keys(cal).every((k) => att[k] === cal[k]);
      if (!same || !lightOk || !calOk) pos.push({ sid, off: off.length, base: base.length, same, lightOk, calOk });
      if (!ANIM[sid]) return; if (!light.length) lightless.push(sid);
      if (!A || !A.ready) { bad.push(sid + ' not baked'); return; }   // [2] containment + outline, every frame
      const b = document.createElement('canvas'); b.width = b.height = 256; const bc = b.getContext('2d', { willReadFrequently: true }); bc.drawImage(bmp, 0, 0); const bd = bc.getImageData(0, 0, 256, 256).data;
      let over = 0, ink = 0;
      for (const f of A.frames) { const fd = f.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, 256, 256).data;
        for (let i = 3; i < fd.length; i += 4) { if (fd[i] > bd[i]) over++; if (fd[i] && bd[i] > 230 && Math.max(bd[i - 3], bd[i - 2], bd[i - 1]) < 51) ink++; } }
      if (over || ink) bad.push(sid + ' over ' + over + ' ink ' + ink); };
    for (const sid of all.filter((s) => !ANIM[s])) check(sid);
    const anim = Object.keys(ANIM);
    for (let i = 0; i < anim.length; i += 6) { const batch = anim.slice(i, i + 6); await bake(batch); for (const sid of batch) check(sid); }
    out.pos = pos; out.lightless = lightless; out.n = all.length; out.animated = anim.length; out.contain = bad;
    // [3] moves, and repeats exactly: the light alone on a clear canvas
    const lightAt = (sid, t) => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); window._lxEqAnimClock = t;
      _lxEqAnimDraw(c, sid, eff(sid), 0, 0, 128, 128, null); return c.getImageData(0, 0, 128, 128).data; };
    const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
    const reps = ['fire', 'storm', 'wisp', 'orb', 'glow', 'twinkle', 'sheen'].map((fx) => anim.find((q) => ANIM[q] === fx)).filter(Boolean); await bake(reps);
    if (!HAS) return out;
    out.moves = {}; for (const fx of ['fire', 'storm', 'wisp', 'orb', 'glow', 'twinkle', 'sheen']) { const sid = Object.keys(ANIM).find((s) => ANIM[s] === fx); if (!sid) { out.moves[fx] = null; continue; }
      const t0 = fx === 'sheen' ? 12750 : 10000, a = lightAt(sid, t0), b = lightAt(sid, t0 + (fx === 'sheen' ? 300 : fx === 'storm' ? 230 : 700)), a2 = lightAt(sid, t0);
      out.moves[fx] = { sid, moved: +diff(a, b).toFixed(3), repeat: diff(a, a2) }; }
    // [4] off switches: blits issued by _lxEqAnimDraw alone
    const blits = (fn) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); let n = 0; P.drawImage = function () { if (this === c) n++; return di.apply(this, arguments); };
      try { fn(c); } finally { P.drawImage = di; } return n; };
    const sid = 'wpn:apocalypse_reaver'; window._lxEqAnimClock = 12900;
    const on = blits((c) => _lxEqAnimDraw(c, sid, eff(sid), 0, 0, 64, 64, null));
    game._reduceMotion = true; const rm = blits((c) => _lxEqAnimDraw(c, sid, eff(sid), 0, 0, 64, 64, null)); game._reduceMotion = false;
    LX_PERF.veryLowFx = true; game._lowFxCache = null; const vl = blits((c) => _lxEqAnimDraw(c, sid, eff(sid), 0, 0, 64, 64, null)); LX_PERF.veryLowFx = false; game._lowFxCache = null;
    const tint = blits((c) => _lxEqAnimDraw(c, sid, eff(sid), 0, 0, 64, 64, { tint: '#cc4444' }));
    window._lxNoGearLight = true; const sw = blits((c) => _lxEqAnimDraw(c, sid, eff(sid), 0, 0, 64, 64, null)); window._lxNoGearLight = false;
    out.sw = { on, reducedMotion: rm, veryLow: vl, tint, off: sw };
    // [5] the listed pieces are real, and the heaviest bake steps are short
    out.unknown = Object.keys(ANIM).filter((s) => !all.includes(s));
    const t0 = performance.now(), bc = document.createElement('canvas'); bc.width = bc.height = 256; const g2 = bc.getContext('2d', { willReadFrequently: true }); g2.drawImage(_lxBakedDownscale(eff('arm:worldbreaker_bulwark'), 256), 0, 0);
    const m = _lxEqAnimMask('fire', g2.getImageData(0, 0, 256, 256).data, 256); const t1 = performance.now(); _lxEqAnimFrame('fire', m, 256, 3, 7); const t2 = performance.now();
    out.ms = { mask: +(t1 - t0).toFixed(1), frame: +(t2 - t1).toFixed(1) };
    window._lxEqAnimClock = null;
    return out;
  }, CALIB).catch((e) => ({ err: String(e.message || e).slice(0, 300) }));
  if (R.err) throw new Error(R.err);
  ok(`[1] positions: all ${R.n} pieces blit identically with the light on and off, every light blit shares the piece's rect and transform, and every Gear Align number is the file's`,
    R.n === 86 && R.pos.length === 0 && R.lightless.length === 0 && R.animated === 51, { animated: R.animated, moved: R.pos.slice(0, 5), noLight: R.lightless.slice(0, 8) });
  ok('[2] containment: in every frame the light is never more opaque than the drawn bake, and never on the dark outline', R.contain.length === 0, R.contain.slice(0, 6));
  ok('[3] it moves (two clock values differ) and repeats exactly (the same clock value, the same pixels), for all seven effects',
    !!R.moves && Object.keys(R.moves).length === 7 && Object.values(R.moves).every((m) => m && m.moved > 0.05 && m.repeat === 0), R.moves || 'no light in this build');
  ok('[4] off under reduced motion, very-low FX, a tint and window._lxNoGearLight; on otherwise',
    !!R.sw && R.sw.on >= 1 && R.sw.reducedMotion === 0 && R.sw.veryLow === 0 && R.sw.tint === 0 && R.sw.off === 0, R.sw || 'no light in this build');
  ok('[5] every listed piece is real art, and a bake step stays short (the fire mask of the biggest piece, one frame)', !!R.unknown && R.unknown.length === 0 && !!R.ms && R.ms.mask < 120 && R.ms.frame < 120, { unknown: R.unknown, ms: R.ms });
  ok('[6] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
