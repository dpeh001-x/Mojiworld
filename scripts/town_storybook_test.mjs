// Everdawn Central, revamped (per user: "Work on a nice revamp redesign of everdawn central map, try to stick to some
// similarities of the current map as we have generated some videos based off it. Make the everdawn central map very
// memorable"). One page, the real town:
//   1. the landmarks are built and drawn: the Dawn Gate at the plaza and the Megamall's storefront at its door, their art asked
//      for with the map; the gate's sun throws its rays (none at low FX)
//   2. every ledge is drawn as part of the town (a market awning, a timber balcony, the rope bridge, the swing, or a landmark's
//      own art) and the old stone slab is never drawn here; the street is the cobble bake
//   3. the ledges a landmark's art defines sit on that art (the gate's top beam and dais, the storefront's sign) and the
//      load-time spacing pass leaves them (and the swing) where they are
//   4. what the films show stays: the backdrop, every NPC on a ledge or the street (Guguma on the gate's beam, in front of its
//      sun), the three portals where they were; Guguma's beam and the sign are reachable from the street
//   5. the street's things (lamp posts, planters, a mailbox, a bench, a cart, a notice board, and the speakers and taxi sign on
//      their owners' balconies) stand on the street or a ledge; the new town costs about what the old one did; no page errors
//   6. the east gatehouse (per user: "add the east gatehouse around the forest portal") stands around that portal - the portal
//      in its open arch, stone on either side - whole inside the world; its roof is a ledge, and Bravo's veranda beside it
// The build before fails 1-3 (and 6, and the counts in 1-4, before the gatehouse).   node scripts/town_storybook_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11874), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 330) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40; player._tutorialSeen = true; player._storyBeatsSeen = { tutorial_intro: true, everdawn_welcome: true };
    try { window._perfTick = function () {}; LX_PERF.lowFx = false; LX_PERF.veryLowFx = false; } catch (e) {}
    loadMap('town', 300); await sleep(1500);
    for (const x of [0, 700, 1400, 1900]) { player.x = x + 480; await sleep(800); }
    const md = game.mapData, sb = md.storybook || null, d = _LX_DPR, gy = 480; out.cfg = !!sb;
    out.asked = typeof _lxArt2MapKeys === 'function' ? (sb ? sb.landmarks.every((L) => _lxArt2MapKeys('town').includes('prop:' + L.key)) : false) : null;
    out.decoded = sb ? sb.landmarks.map((L) => { const im = LX_OBJECTS[L.key]; return !!im && im.naturalWidth > 0; }) : [];
    game.paused = true;
    const shot = (t, rect) => { game.time = t; _lxRenderOnly = true; try { ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; _lxDrawFrame(performance.now()); } finally { _lxRenderOnly = false; } return ctx.getImageData(Math.round(rect[0] * d), Math.round(rect[1] * d), Math.round(rect[2] * d), Math.round(rect[3] * d)).data; };
    const diff = (A, B) => { let s = 0; for (let i = 0; i < A.length; i += 4) s += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); return +(s / (A.length / 4) / 3).toFixed(2); };
    const stubbed = (name, fn, ret) => { const o = window[name]; window[name] = function () { return ret; }; try { return fn(); } finally { window[name] = o; } };
    // 1. each landmark drawn; the rays
    out.drawn = (sb ? sb.landmarks : []).map((L) => { game.camera.x = Math.max(0, L.x - 480); player.x = L.x + 600; const rect = [L.x - game.camera.x - L.w * 0.4, gy - 200, L.w * 0.8, 190];
      return diff(shot(5000, rect), stubbed('_lxTownBack', () => shot(5000, rect))); });
    { const L = sb && sb.landmarks[0]; if (L) { game.camera.x = Math.max(0, L.x - 480); player.x = L.x + 600; const rect = [L.x - game.camera.x - 200, 40, 400, 120];
      const a = shot(5000, rect), b = shot(5900, rect); out.rays = diff(a, b); LX_PERF.lowFx = true; try { out.raysLow = diff(shot(5000, rect), shot(5900, rect)); } finally { LX_PERF.lowFx = false; } } }
    // 2. kinds; no stone slab
    const kinds = {}; let slabs = 0; const oC = window._drawCutePlatform; window._drawCutePlatform = function () { slabs++; return oC.apply(this, arguments); };
    try { for (const cx of [0, 700, 1400, 1900]) { game.camera.x = cx; player.x = cx + 480; shot(6000, [0, 0, 1, 1]); } } finally { window._drawCutePlatform = oC; }
    const owned = (p) => (sb && typeof _lxTownOwned === 'function') ? _lxTownOwned(sb, p) : null;
    for (const p of md.platforms) { const k = p.type === 'ground' ? 'ground' : owned(p) ? 'landmark' : ((sb && sb.swings) || []).some((w) => Math.abs(w.x - p.x) <= 2) ? 'swing' : p.h <= 6 ? 'rope' : (p.y >= 395 && p.w <= 100) ? 'awning' : 'deck'; kinds[k] = (kinds[k] || 0) + 1; }
    out.kinds = kinds; out.slabs = slabs; out.street = Object.keys(_lxMallBakes).some((k) => k.indexOf('tstreet') === 0);
    // 3. the art ledges on their art, unmoved
    const at = (x) => md.platforms.find((p) => Math.abs(p.x - x) <= 2);
    out.ledges = sb ? [].concat(...sb.landmarks.map((L) => (L.owns || []).map((ox) => { const p = at(ox), src = MAPS.town.platforms.find((q) => Math.abs(q.x - ox) <= 2);
      const im = LX_OBJECTS[L.key], h = L.w * im.naturalHeight / im.naturalWidth, top = gy + (L.sink || 0) - h * L.foot, cv = _lxMallBakes['tland' + L.key + L.w + (L.sign ? 'F' : '') + '|' + d] || _lxMallBakes['tland' + L.key + L.w + (L.sign ? 'f' : '') + '|' + d];
      let ink = null; if (cv && p) { const cx = Math.round((p.x + p.w / 2 - (L.x - L.w / 2)) * d), cy = Math.round((p.y + 3 - top) * d); ink = cv.getContext('2d').getImageData(cx, cy, 1, 1).data[3]; }
      return { key: L.key, x: ox, y: p && p.y, srcY: src && src.y, moved: !p || !src || p.x !== src.x || p.y !== src.y, ink }; }))) : [];
    out.swing = sb ? (sb.swings || []).map((w) => { const p = at(w.x), src = MAPS.town.platforms.find((q) => Math.abs(q.x - w.x) <= 2); return { x: w.x, moved: !p || !src || p.y !== src.y }; }) : [];
    // 4. NPCs on ledges, portals, reach
    out.npcs = game.npcs.map((n) => { const feet = n.y + (n.h || 46), cx = n.x + (n.w || 0) / 2; const on = md.platforms.some((p) => cx >= p.x - 6 && cx <= p.x + p.w + 6 && Math.abs(feet - p.y) <= 4); return { n: n.name, on, feet: Math.round(feet) }; });
    const gug = game.npcs.find((n) => n.name === 'Guguma'); out.gugOnBeam = !!(gug && sb && Math.abs(gug.y + (gug.h || 46) - at(sb.landmarks[0].owns[0]).y) <= 4);
    out.portals = (md.portals || []).map((p) => p.dest + '@' + p.x);
    const fl = md.platforms.filter((p) => p.type !== 'ground'), R0 = new Set(), q = [];
    for (const p of fl) if (gy - p.y <= 90) { R0.add(p); q.push(p); }
    while (q.length) { const s = q.pop(); for (const t of fl) { if (R0.has(t)) continue; const rise = s.y - t.y, gap = Math.max(t.x - (s.x + s.w), s.x - (t.x + t.w), 0); if (rise <= 90 && gap <= 120 + Math.max(0, -rise) * 0.8) { R0.add(t); q.push(t); } } }
    out.reach = sb ? [].concat(...sb.landmarks.map((L) => (L.owns || []).map((ox) => R0.has(at(ox))))) : [];
    // 6. the east gatehouse around the forest portal
    { const L = sb && sb.landmarks.find((m) => m.key === 'town_east_gate'), po = (md.portals || []).find((p) => p.dest === 'forest'), bv = game.npcs.find((n) => n.name === 'Bravo'), ver = md.platforms.find((p) => Math.abs(p.x - 2430) <= 2);
      if (L && po) { const im = LX_OBJECTS[L.key], h = L.w * im.naturalHeight / im.naturalWidth, top = gy + (L.sink || 0) - h * L.foot, cv = _lxMallBakes['tland' + L.key + L.w + '|' + d];
        const a = (x, y) => cv ? cv.getContext('2d').getImageData(Math.round((x - (L.x - L.w / 2)) * d), Math.round((y - top) * d), 1, 1).data[3] : null;
        out.east = { gate: [L.x - L.w / 2, L.x + L.w / 2], portal: po.x, ww: md.worldWidth, arch: a(po.x, 430), jambs: [a(po.x - 45, 430), a(po.x + 45, 430)], bravoFeet: bv && Math.round(bv.y + (bv.h || 46)), veranda: ver && ver.y }; } }
    // 5. props, cost
    out.props = (MAP_PROPS.town || []).filter((p) => /^town_/.test(p.key)).map((p) => { const im = LX_OBJECTS[p.key], meta = LX_OBJECTS_META[p.key]; return { key: p.key, x: p.x, y: p.y, ok: !!im && im.naturalWidth > 0 && !!meta && meta.bboxBottomY != null, onLedge: p.y === gy || md.platforms.some((q) => p.x >= q.x && p.x <= q.x + q.w && Math.abs(q.y - p.y) <= 1) }; });
    const oB = window._lxTownBack, oP = window._lxTownPlatDraw, setOld = (old) => { window._lxTownBack = old ? function () {} : oB; window._lxTownPlatDraw = old ? function () { return false; } : oP; };
    const frame = () => { game.time++; const t0 = performance.now(); _lxRenderOnly = true; try { ctx.setTransform(d, 0, 0, d, 0, 0); _lxDrawFrame(performance.now()); } finally { _lxRenderOnly = false; } ctx.getImageData(0, 0, 1, 1); return performance.now() - t0; };
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], ratios = [];
    try { for (let r = 0; r < 8; r++) for (const cx of [0, 700, 1400, 1900]) { game.camera.x = cx; player.x = cx + 480; const m = {};
      for (const old of (r % 2 ? [true, false] : [false, true])) { setOld(old); const a = []; for (let i = 0; i < 8; i++) a.push(frame()); m[old] = med(a.slice(2)); } ratios.push(m[false] / m[true]); } } finally { setOld(false); }
    out.cost = +med(ratios).toFixed(3);
    game.paused = false;
    return out;
  });
  ok('1. the town has its storybook layout, and each landmark\'s art is asked for with the map and decoded', R.cfg && R.asked === true && R.decoded.length === 3 && R.decoded.every(Boolean), { asked: R.asked, decoded: R.decoded });
  ok('1. the Dawn Gate, the Megamall\'s storefront and the east gatehouse are drawn', R.drawn.length === 3 && R.drawn.every((v) => v > 6), R.drawn);
  ok('1. the gate\'s sun throws slowly turning rays (the sky over the gate changes far more than without them), none at low FX', R.rays > 1 && R.raysLow < R.rays / 4, { rays: R.rays, low: R.raysLow });
  ok('2. every ledge is drawn as part of the town (awnings, balconies, the rope bridge, the swing, the landmarks\' own ledges)', R.kinds.awning >= 9 && R.kinds.deck >= 8 && R.kinds.rope === 1 && R.kinds.swing === 1 && R.kinds.landmark === 4, R.kinds);
  ok('2. the old stone slab is never drawn in town, and the street is the cobble bake', R.slabs === 0 && R.street, { slabs: R.slabs, street: R.street });
  ok('3. the ledges a landmark draws sit on its art (opaque where you stand) and the spacing pass leaves them, and the swing, alone', R.ledges.length === 4 && R.ledges.every((l) => !l.moved && l.ink > 128) && R.swing.every((w) => !w.moved), { ledges: R.ledges, swing: R.swing });
  ok('4. every NPC stands on a ledge or the street, Guguma on the gate\'s beam', R.npcs.length >= 9 && R.npcs.every((n) => n.on) && R.gugOnBeam, R.npcs.filter((n) => !n.on).concat([{ gug: R.gugOnBeam }]));
  ok('4. the three portals are where they were', JSON.stringify(R.portals) === JSON.stringify(['cadetsStrand@153', 'everdawn_megamall@1479', 'forest@2735']), R.portals);
  ok('4. Guguma\'s beam, the dais, the Megamall\'s sign and the gatehouse\'s roof are reachable from the street', R.reach.length === 4 && R.reach.every(Boolean), R.reach);
  ok('5. the street\'s things (lamp posts, planters, a mailbox, a bench, a flower cart, a notice board; speakers and a taxi sign on their owners\' balconies) stand on the street or a ledge', R.props.length >= 12 && R.props.every((p) => p.ok && p.onLedge), R.props.filter((p) => !p.ok || !p.onLedge));
  ok('5. the new town costs about what the old one did (whole frames, paired; < 15% more)', R.cost < 1.15, R.cost);
  { const E = R.east; ok('6. the east gatehouse stands around the forest portal (the portal in its open arch, stone either side), whole inside the world, and Bravo stands on the veranda beside it',
      !!E && Math.abs((E.gate[0] + E.gate[1]) / 2 - E.portal) <= 8 && E.gate[1] <= E.ww && E.arch < 40 && E.jambs.every((v) => v > 200) && Math.abs(E.bravoFeet - E.veranda) <= 4, E); }
  ok('5. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
