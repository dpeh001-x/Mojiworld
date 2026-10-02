// FLAMES THAT BURN (per user, 2026-10-02: "some of the weapons and armors have flames, improve the animations of the flames", then "Can
// add more realistic flame animations", "The outlines should not be of the flames"). The 12 fire pieces draw their body still and their flames moving (data/gear_flames.js: which
// pixels of the art are flame, and the body ludo repainted where the flames covered its edge).
//   [1] the data: the gear light's 12 fire pieces, each a 768 flame mask; every piece bakes
//   [2] body + flames is the art: the baked body with the art's flame pixels over it rebuilds the art (768 grid)
//   [3] the flames move, the body does not: at two clock values the body's blit is identical and the flame blits change; the same clock
//       repeats exactly (the body's lava seams keep the gear light's shimmer - light over it, not motion)
//   [4] the body takes the art's place - same source, dest rect and transform - and a hinged armour's torso is baked from that body
//   [5] off under reduced motion, very-low FX, a tint and window._lxNoGearLight: no body swap, no flame blits
//   [6] the bake steps stay short (the biggest flames: the fields, one frame)
//   [7] the flames carry no outline: in every baked flame frame almost no opaque texel is near-black
//   [8] no page errors
// The build before fails [1]-[7].   node scripts/fire_motion_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const fs = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11903);
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
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof _LX_EQ_ANIM === 'object' && window.LX_EQ_ERASE_DATA, null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}; window._lxNoGearLight = false;
    const FIRE = Object.keys(_LX_EQ_ANIM).filter((s) => _LX_EQ_ANIM[s] === 'fire').sort(), FD = window.LX_EQ_FLAMES || {};
    const eff = (sid) => _lxEqErasedImg(sid) || _lxEquipSprite(sid.startsWith('wpn:') ? 'weapons' : 'armors', sid.slice(4));
    out.data = { fire: FIRE.length, withData: FIRE.filter((s) => FD[s]).length, extra: Object.keys(FD).filter((s) => !FIRE.includes(s)) };
    out.masks = []; for (const s of FIRE) { if (!FD[s]) continue; const m = new Image(); m.src = FD[s].m; try { await m.decode(); } catch (e) {} if (m.naturalWidth !== 768) out.masks.push(s); }
    for (const s of FIRE) eff(s);
    for (let i = 0; i < 400 && !FIRE.every((s) => eff(s) && eff(s).complete && eff(s).naturalWidth && _lxBakedDownscale(eff(s), 256)); i++) await sleep(50);
    const has = typeof _lxFlameGet === 'function', ready = (s) => { const A = _LX_EQ_ANIM_CACHE.get(s); return !!(A && A.fl && A.fl.ready); };
    const bake = async (list) => { for (let i = 0; i < 600; i++) { let r = 0; for (const s of list) { if (has) _lxEqAnimGet(s, eff(s)); if (ready(s)) r++; } if (r === list.length) return true; await sleep(50); } return false; };
    out.unbaked = []; out.rebuild = [];
    for (let i = 0; i < FIRE.length; i += 6) { const b = FIRE.slice(i, i + 6); await bake(b);
      for (const s of b) { if (!ready(s)) { out.unbaked.push(s); continue; }
        // [2] body + the art's flame pixels = the art
        const F = _LX_EQ_ANIM_CACHE.get(s).fl, m = new Image(); m.src = FD[s].m; await m.decode();
        const cv = document.createElement('canvas'); cv.width = cv.height = 768; const c = cv.getContext('2d', { willReadFrequently: true });
        c.drawImage(eff(s), 0, 0, 768, 768); c.globalCompositeOperation = 'destination-in'; c.drawImage(m, 0, 0); c.globalCompositeOperation = 'destination-over'; c.drawImage(F.full, 0, 0);
        const a = c.getImageData(0, 0, 768, 768).data, o = document.createElement('canvas'); o.width = o.height = 768; const oc = o.getContext('2d', { willReadFrequently: true }); oc.drawImage(eff(s), 0, 0, 768, 768);
        const b2 = oc.getImageData(0, 0, 768, 768).data; let bad = 0;
        for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k + 3] - b2[k + 3]) > 6 || (b2[k + 3] > 200 && Math.abs(a[k] - b2[k]) + Math.abs(a[k + 1] - b2[k + 1]) + Math.abs(a[k + 2] - b2[k + 2]) > 30)) bad++;
        if (bad > 768 * 768 * 0.002) out.rebuild.push(s + ' ' + bad); } }
    // [3] [4] one weapon and one hinged armour on the hero
    const P2 = CanvasRenderingContext2D.prototype, d0 = P2.drawImage;
    const wear = (sid, clock, opts) => { opts = opts || {}; const rec = []; const cv = document.createElement('canvas'); cv.width = 360; cv.height = 360; const c = cv.getContext('2d', { willReadFrequently: true });
      P2.drawImage = function (src) { if (this === c) { const t = this.getTransform(); rec.push({ src, a: [...arguments].slice(1).map((v) => +(+v).toFixed(4)), t: [t.a, t.b, t.c, t.d, t.e, t.f].map((v) => +v.toFixed(4)) }); } return d0.apply(this, arguments); };
      const keep = _LX_EQ_PREVIEW_OVERRIDE; window._lxEqAnimClock = clock; window._lxNoGearLight = !!opts.off;
      _LX_EQ_PREVIEW_OVERRIDE = sid.startsWith('wpn:') ? { weapon: { spriteId: sid, tint: opts.tint } } : { body_top: { spriteId: sid, tint: opts.tint } }; c.translate(180, 340); c.scale(4, 4);
      try { _drawVectorHero(-14, -44, c, { cls: 'warrior', animName: 'idle', animTime: 0, forcedFacing: 1 }); } finally { P2.drawImage = d0; _LX_EQ_PREVIEW_OVERRIDE = keep; window._lxNoGearLight = false; }
      return { rec, px: c.getImageData(0, 0, 360, 360).data }; };
    const box = (r) => { const [dx, dy, w, h] = r.a.length >= 4 ? r.a.slice(-4) : [0, 0, 0, 0], M = new DOMMatrix(r.t); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [x, y] of [[dx, dy], [dx + w, dy], [dx, dy + h], [dx + w, dy + h]]) { const p = M.transformPoint(new DOMPoint(x, y)); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      return [Math.floor(x0) - 2, Math.floor(y0) - 2, Math.ceil(x1) + 2, Math.ceil(y1) + 2]; };
    out.still = {}; out.place = {};
    for (const sid of ['wpn:ragnarok_cleaver', 'arm:worldbreaker_bulwark']) { if (!ready(sid)) { out.still[sid] = 'not baked'; continue; }
      const F = _LX_EQ_ANIM_CACHE.get(sid).fl, isFl = (r) => F.frames.some((f) => f.cv === r.src) || r.src === _lxEmberSprite;
      const A1 = wear(sid, 10000), A2 = wear(sid, 10500), A3 = wear(sid, 10000);
      const isBody = (r) => r.src === F.small || r.src === F.full, sig = (rs) => JSON.stringify(rs.filter(isBody).map((r) => [r.a, r.t]));
      let moved = 0, rep = 0; for (let i = 0; i < A1.px.length; i += 4) { if (A1.px[i] !== A2.px[i] || A1.px[i + 3] !== A2.px[i + 3]) moved++; if (A1.px[i + 3] !== A3.px[i + 3] || A1.px[i] !== A3.px[i]) rep++; }
      const fl1 = A1.rec.filter(isFl), fl2 = A2.rec.filter(isFl), flChanged = fl1.length !== fl2.length || fl1.some((r, k) => r.src !== fl2[k].src || JSON.stringify(r.a) !== JSON.stringify(fl2[k].a));
      out.still[sid] = { moved, bodySame: A1.rec.filter(isBody).length >= 1 && sig(A1.rec) === sig(A2.rec), flChanged, repeat: rep, flameBlits: fl1.length, glow: _LX_EQ_ANIM_CACHE.get(sid).frames.length };
      const off = wear(sid, 10000, { off: true }).rec, bmp = _lxBakedDownscale(eff(sid), 256);
      const artB = off.filter((r) => r.src === bmp || r.src === eff(sid)), bodyB = A1.rec.filter((r) => r.src === F.small || r.src === F.full);
      const same = artB.length >= 1 && artB.length === bodyB.length && artB.every((r, k) => JSON.stringify(r.a) === JSON.stringify(bodyB[k].a) && JSON.stringify(r.t) === JSON.stringify(bodyB[k].t));
      out.place[sid] = { art: artB.length, body: bodyB.length, same, torsoFromBody: sid.startsWith('arm:') ? !!(_LX_PAD_TORSO.get(F.full)) : null }; }
    // [5] the off switches: no swap, no flame blits
    { const sid = 'wpn:ragnarok_cleaver', F = ready(sid) && _LX_EQ_ANIM_CACHE.get(sid).fl, count = (o) => { const w = wear(sid, 10000, o); return F ? w.rec.filter((r) => r.src === F.small || r.src === F.full || F.frames.some((f) => f.cv === r.src)).length : -1; };
      const on = count({}); game._reduceMotion = true; const rm = count({}); game._reduceMotion = false;
      LX_PERF.veryLowFx = true; game._lowFxCache = null; const vl = count({}); LX_PERF.veryLowFx = false; game._lowFxCache = null;
      const tint = count({ tint: '#cc4444' }), sw = count({ off: true });
      out.sw = { on, reducedMotion: rm, veryLow: vl, tint, off: sw }; }
    // [6] the heaviest steps, warm
    if (has) { const sid = 'arm:worldbreaker_bulwark', K = _LX_FLAME_K, N = K.N, m = new Image(); m.src = FD[sid].m; await m.decode();
      const run = () => { const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(eff(sid), 0, 0, N, N); g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0, N, N);
        const FL = g.getImageData(0, 0, N, N).data, bodyA = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) bodyA[i] = FL[i * 4 + 3] > 200 ? 255 : 0;
        const t0 = performance.now(), Pp = _lxFlamePrep(FL, bodyA, N, K), t1 = performance.now(); _lxFlameFrame(FL, N, Pp, K, 5, 7); return [t1 - t0, performance.now() - t1]; };
      run(); const r2 = run(); out.ms = { prep: +r2[0].toFixed(1), frame: +r2[1].toFixed(1) }; }
    // [7] no ink in the flames
    out.ink = []; for (const s of FIRE) { if (!ready(s)) continue; const F = _LX_EQ_ANIM_CACHE.get(s).fl; let op = 0, blk = 0;
      for (const f of F.frames) { const d = f.cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, f.cv.width, f.cv.height).data;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; op++; if (Math.max(d[i], d[i + 1], d[i + 2]) < 60) blk++; } }
      if (!op || blk / op > 0.01) out.ink.push(s + ' ' + (op ? (100 * blk / op).toFixed(1) + '%' : 'empty')); }
    window._lxEqAnimClock = null; return out; });
  ok('[1] the data: all 12 fire pieces carry a 768 flame mask, and every one bakes', R.data.fire === 12 && R.data.withData === 12 && !R.data.extra.length && !R.masks.length && !R.unbaked.length, { data: R.data, masks: R.masks, unbaked: R.unbaked });
  ok('[2] body + flames is the art (each piece, on the 768 grid)', !R.unbaked.length && !R.rebuild.length, R.rebuild);
  const st = Object.values(R.still);
  ok('[3] the flames move and the body does not: the body blit is identical at two clock values, the flame blits change, the same clock repeats; the body keeps its shimmer', st.length === 2 && st.every((v) => v && v.moved > 200 && v.bodySame && v.flChanged && v.repeat === 0 && v.flameBlits >= 1 && v.glow === 10), R.still);
  const pl = Object.values(R.place);
  ok('[4] the body takes the art`s place (same source, dest rect, transform), and the hinged armour`s torso is baked from that body'.split('`').join("'"), pl.length === 2 && pl.every((v) => v.same && v.torsoFromBody !== false), R.place);
  ok('[5] off under reduced motion, very-low FX, a tint and window._lxNoGearLight', !!R.sw && R.sw.on >= 2 && R.sw.reducedMotion === 0 && R.sw.veryLow === 0 && R.sw.tint === 0 && R.sw.off === 0, R.sw);
  ok('[6] the bake steps stay short (the fields and one frame of the biggest flames, warm)', !!R.ms && R.ms.prep < 60 && R.ms.frame < 60, R.ms);
  ok('[7] the flames carry no outline: under 1% of every piece`s opaque flame texels are near-black'.split('`').join("'"), !R.unbaked.length && !R.ink.length, R.ink);
  ok('[8] no page errors', !errs.length, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
