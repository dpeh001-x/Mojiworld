// HUD clear for bosses (v0.30.x hud-boss-clear): the side panels make way for a boss's DRAWN body, not only for the hero.
//   node scripts/hud_boss_clear_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Per user: King Krook, the Arbiter, Caprikor (and every other boss) "look cut off at the sides" - the opaque side panels sat
// over their flanks. At 1280x720 and 1920x1080, ten bosses are each held (hero mid-screen, portals cleared):
//   1) on the ground under the right-hand panels (quest tracker, Hotkeys, Taxi, minimap), 2) in the air under the stats card,
//   3) on the ground mid-screen; then two of them on a phone (844x390, touch), where the tracker sits up under the menu row.
//   The body is measured independently of the game: every blit made inside _drawBossSprite on the
//   game canvas (device box through the live transform), trimmed to the drawn file's opaque bounds (decoded here at 64 px,
//   alpha > 24). Over the frames of each hold, per panel:
//   - covered (>= 15% of its area on every frame): faded (opacity <= 0.35)        - the fade threshold is 12%
//   - untouched (no overlap on any frame, 12 px margin): full opacity, never faded
//   - a panel faded at one hold and untouched at the next is back at full opacity ("the boss moved away")
//   Plus: a boss that only grazes a panel (a few px) leaves it alone; no page errors. Per boss the drawn width vs the hitbox
//   width is printed (INFO lines).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11582';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
// the working copy can lag origin: a file missing here (and every data / root script) is served from origin/main
const CT = { '.webp': 'image/webp', '.png': 'image/png', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.css': 'text/css', '.jpg': 'image/jpeg' };
const gitShow = (rel) => new Promise((res) => execFile('git', ['show', 'origin/main:' + rel], { cwd: ROOT, encoding: 'buffer', maxBuffer: 1 << 26 }, (e, out) => res(e ? null : out)));
const BOSSES = [
  { name: 'King Krook', map: 'krookThrone', type: 'kingKrook' },
  { name: 'Caprikor', map: 'zod_capricorn', type: 'zodiac_capricorn' },
  { name: 'The Arbiter', map: 'tower_b5', type: 'towerArbiter', spawn: true },
  { name: 'Gravitos', map: 'gravitosArena', type: 'gravitos' },
  { name: 'King Slime', map: 'slimeCave', type: 'king' },
  { name: 'Mooma', map: 'boss', type: 'mooma' },
  { name: 'Aetherion', map: 'sanctum', type: 'aetherion' },
  { name: 'Distorted Mira', map: 'lastStep', type: 'miraFallen' },
  { name: 'Leo', map: 'zod_leo', type: 'zodiac_leo' },
  { name: 'Libra', map: 'zod_libra', type: 'zodiac_libra' },
];
const PANELS = ['quest-tracker', 'hotkey-hint', 'taxi-btn', 'minimap', 'world-affix-pin', 'pq-objective-pin', 'lx-corner', 'stats'];
const RIGHT = ['quest-tracker', 'hotkey-hint', 'taxi-btn', 'minimap'];
const errs = [];
const ONLY = process.env.HBC_ONLY || '', RES = process.env.HBC_RES || '';   // debug: a few boss types / one size
let p = null; const E = (f, a) => p.evaluate(f, a);
async function boot(opts) {
  const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => u.hostname === 'localhost', async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (!rel || rel === FILE || /[.]html$/.test(rel)) return r.continue();
    const fromOrigin = /^data[/].*[.]js$/.test(rel) || /^[^/]+[.]js$/.test(rel);
    if (!fromOrigin && existsSync(path.join(ROOT, rel))) return r.continue();
    const body = await gitShow(rel);
    if (!body) return r.continue();
    return r.fulfill({ status: 200, contentType: CT[path.extname(rel).toLowerCase()] || 'application/octet-stream', body });
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _drawBossSprite === 'function' && typeof _lxHudClearTick === 'function', null, { timeout: 180000 });
  await p.evaluate(async (PANELS) => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; try { _lxBootHold.release('menu'); } catch (e) {}
    if (!player.cls) applyClass('warrior'); player.level = 90; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    const isBoss = (m) => !!(m && (m.isBoss || m.boss || m.superBoss || m.zodiacBoss || (m.traits && m.traits.activeBoss)));
    // the drawn boss: every blit on the game canvas inside _drawBossSprite - its local box, the live transform, the source file
    const srcOf = (img) => { const s = img && img._lxSrc, u = (s && typeof s === 'object') ? s.src : (typeof s === 'string' ? s : (img && img.src)); return (typeof u === 'string' && /^https?:/.test(u)) ? u : null; };
    const seqNow = () => (typeof _lxDrawSeq === 'number' ? _lxDrawSeq : (game.time | 0));
    window.__recs = []; let cur = null;
    const oB = window._drawBossSprite;
    window._drawBossSprite = function (sprite, m) { const prev = cur; cur = { m, url: srcOf(sprite) }; try { return oB.apply(this, arguments); } finally { cur = prev; } };
    const oS = window._lxBossStandIn;   // the image really drawn: a set still baking is stood in for by another frame's canvas
    if (typeof oS === 'function') window._lxBossStandIn = function (sprite, m) { const r = oS.apply(this, arguments); if (cur && cur.m === m) cur.url = srcOf(r); return r; };
    const P = CanvasRenderingContext2D.prototype, oDI = P.drawImage;
    P.drawImage = function (img, ...a) {
      if (cur && this.canvas && this.canvas.id === 'game') { try { const t = this.getTransform(), box = a.length >= 8 ? a.slice(4, 8) : a.length >= 4 ? a.slice(0, 4) : [a[0], a[1], img.width, img.height];
        window.__recs.push({ m: cur.m, url: cur.url, seq: seqNow(), t: [t.a, t.b, t.c, t.d, t.e, t.f], box, k0: this.canvas.width / W }); if (window.__recs.length > 400) window.__recs.splice(0, 200); } catch (e) {} }
      return oDI.call(this, img, ...a);
    };
    // the opaque bounds of a file, decoded at 64 px (alpha > 24), cached
    const fr = new Map();
    window.__frac = async (url) => {
      if (!url) return null; if (fr.has(url)) return fr.get(url); let v = null;
      try { const bm = await createImageBitmap(await (await fetch(url)).blob(), { resizeWidth: 64, resizeHeight: 64, resizeQuality: 'low' });
        const c = new OffscreenCanvas(64, 64), g = c.getContext('2d'); g.drawImage(bm, 0, 0); const d = g.getImageData(0, 0, 64, 64).data; let l = 64, t = 64, r = -1, b = -1;
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (d[(y * 64 + x) * 4 + 3] > 24) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
        if (r >= l) v = { l: l / 64, t: t / 64, r: (r + 1) / 64, b: (b + 1) / 64 }; } catch (e) {}
      fr.set(url, v); return v;
    };
    // a record -> [full, body] in screen px (a file still unmeasured borrows the boss's last body, like the game)
    const cv = () => document.getElementById('game').getBoundingClientRect();
    const map = (rec, x, y, w, h) => { const [a, b, c, d, e, f] = rec.t, R = cv(), k = R.width / W, X = [], Y = [];
      for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { X.push(R.left + (a * px + c * py + e) / rec.k0 * k); Y.push(R.top + (b * px + d * py + f) / rec.k0 * k); }
      return [Math.min(...X), Math.min(...Y), Math.max(...X), Math.max(...Y)]; };
    window.__bodies = async (m, seq0) => {
      const out = [];
      for (const rec of window.__recs.filter((q) => q.m === m && q.seq >= seq0)) {
        let f = await window.__frac(rec.url); if (f) m.__lastF = f; else f = m.__lastF || null;
        const [x, y, w, h] = rec.box, full = map(rec, x, y, w, h);
        out.push({ seq: rec.seq, full, body: f ? map(rec, x + f.l * w, y + f.t * h, w * (f.r - f.l), h * (f.b - f.t)) : full });
      }
      const fr = []; for (const q of out) { const L = fr[fr.length - 1]; if (L && L.seq === q.seq) { for (const k of ['full', 'body']) L[k] = [Math.min(L[k][0], q[k][0]), Math.min(L[k][1], q[k][1]), Math.max(L[k][2], q[k][2]), Math.max(L[k][3], q[k][3])]; } else fr.push({ seq: q.seq, full: q.full.slice(), body: q.body.slice() }); }
      fr.singles = out; return fr;
    };
    window.__panels = () => { const o = {}; for (const id of PANELS) { const el = document.getElementById(id); if (!el) continue; const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || !(r.width > 0 && r.height > 0)) continue;
      let op = 1; for (let a = el; a && a !== document.documentElement; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
      o[id] = { r: [r.left, r.top, r.right, r.bottom], op: +op.toFixed(2), y: el.classList.contains('lx-hud-yield') }; } return o; };
    window.__draws = async (n) => { const s0 = seqNow(), t0 = performance.now(); while (seqNow() - s0 < n && performance.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 30)); return seqNow() - s0; };
    window.__seq = seqNow;
    // the hold: the boss pinned (x, and y when set), idle, unhurt; the hero pinned mid-map and untouchable; overlays shut
    window.__hold = { m: null, x: null, y: null, px: null, py: null };
    (function keep() { try { const h = window.__hold, m = h.m;
      if (m) { if (h.x != null) m.x = h.x; if (h.y != null) { m.y = h.y; m.vy = 0; } m.vx = 0; m.patternState = 'idle'; m.patternTimer = 0; m.currentHp = m.maxHp; m.stunTimer = 0; m._bigMeleeCd = 1e9;
        for (let i = game.monsters.length - 1; i >= 0; i--) { const q = game.monsters[i]; if (q !== m && isBoss(q)) game.monsters.splice(i, 1); } }
      if (h.px != null) { player.x = h.px; player.vx = 0; if (h.py != null) { player.y = h.py; player.vy = 0; } }
      player.invulnerable = 999999; player._god = true; if (player.hp < getMaxHp()) player.hp = getMaxHp(); game.paused = false;
      if (game.portals && game.portals.length) game.portals.length = 0;
      for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'everdawn-welcome-overlay', 'void-intro-overlay']) { const el = document.getElementById(id); if (el && el.style.display !== 'none') el.style.display = 'none'; }
    } catch (e) {} requestAnimationFrame(keep); })();
    window.__isBoss = isBoss;
  }, PANELS);
  await p.evaluate(() => {
    const cv = () => document.getElementById('game').getBoundingClientRect(), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // load the boss's arena, find its boss (or spawn it), pin the hero mid-map; wait until the boss is drawn from its art
    window.__arena = async (b) => {
      const h = window.__hold; h.m = null; h.x = h.y = h.px = h.py = null;
      loadMap(b.map); try { closeAllModals(); } catch (e) {} game.paused = false;
      const t0 = performance.now(); while (performance.now() - t0 < 8000 && (game.currentMap !== b.map || game.time < 5)) await sleep(50);
      await window.__draws(6); await sleep(600);
      const ww = game.mapData.worldWidth || 1400, wh = game.mapData.worldHeight || 560;
      let m = !b.spawn && game.monsters.find((q) => q.type === b.type && window.__isBoss(q));
      if (!m) { game.monsters.length = 0; m = spawnMonster(Math.round(ww * 0.55), (game.mapData.groundY || wh - 80) - 300, b.type, true, false); }
      for (let i = game.monsters.length - 1; i >= 0; i--) if (game.monsters[i] !== m) game.monsters.splice(i, 1);
      h.px = Math.round(ww / 2 - player.w / 2); h.m = m; h.x = m.x;
      for (const ax of ['x', 'y']) { let v = m[ax]; Object.defineProperty(m, ax, { configurable: true, get: () => (h.m === m && h[ax] != null ? h[ax] : v), set: (z) => { v = z; } }); }
      const t1 = performance.now(); while (performance.now() - t1 < 60000 && !window.__recs.some((q) => q.m === m && q.url)) await sleep(100);
      await window.__draws(4);
      return { ok: window.__recs.some((q) => q.m === m && q.url), map: game.currentMap, type: m.type, w: m.w, h: m.h };
    };
    // move the held boss until its drawn body's centre (or right edge, edge: true) sits on the target (screen px)
    window.__place = async (tx, ty, edge) => {
      const h = window.__hold, m = h.m, floor = () => { if (ty == null) h.y = _defaultPortalY(h.x + m.w / 2) - m.h; };   // on the ground: feet on the floor slab under it
      floor();
      for (let i = 0; i < 4; i++) {
        await window.__draws(2); const s0 = window.__seq(); await window.__draws(2);
        const B = await window.__bodies(m, s0), L = B[B.length - 1]; if (!L) continue;
        const k = cv().width / W, bx = edge ? L.body[2] : (L.body[0] + L.body[2]) / 2, by = (L.body[1] + L.body[3]) / 2;
        h.x += (tx - bx) / k; if (ty != null) h.y = (h.y == null ? m.y : h.y) + (ty - by) / k; floor();
      }
    };
    // hold still for n drawn frames, then: every panel's state, and how much of it the drawn body covered on each frame
    window.__sample = async (n) => {
      const m = window.__hold.m, s0 = window.__seq(); await window.__draws(n); await sleep(400);
      const P = window.__panels(), B = await window.__bodies(m, s0), k = cv().width / W;
      const area = (a, b, g) => { const ix = Math.min(a[2], b[2] + g) - Math.max(a[0], b[0] - g), iy = Math.min(a[3], b[3] + g) - Math.max(a[1], b[1] - g); return ix > 0 && iy > 0 ? ix * iy : 0; };
      for (const id in P) { const q = P[id], A = (q.r[2] - q.r[0]) * (q.r[3] - q.r[1]);
        q.minF = B.length ? Math.min(...B.map((x) => area(x.body, q.r, 0) / A)) : 0; q.maxF = B.length ? Math.max(...B.map((x) => area(x.body, q.r, 0) / A)) : 0;
        q.near = B.length ? Math.max(...B.map((x) => area(x.body, q.r, 12))) : 0; q.r = q.r.map(Math.round); q.minF = +q.minF.toFixed(3); q.maxF = +q.maxF.toFixed(3); }
      const L = B[B.length - 1], rng = (a) => a.length ? [Math.round(Math.min(...a)), Math.round(Math.max(...a))] : [0, 0];   // canvas px, over the hold
      return { n: B.length, P, fullW: rng(B.singles.map((q) => (q.full[2] - q.full[0]) / k)), bodyW: rng(B.singles.map((q) => (q.body[2] - q.body[0]) / k)), body: L && L.body.map(Math.round), hw: m.w };
    };
    window.__targets = () => { const P = window.__panels(), R = cv(), right = ['quest-tracker', 'hotkey-hint', 'taxi-btn', 'minimap'].filter((id) => P[id]).map((id) => P[id].r);
      return { right: right.length ? [(Math.min(...right.map((r) => r[0])) + Math.max(...right.map((r) => r[2]))) / 2, Math.min(...right.map((r) => r[0])), (Math.min(...right.map((r) => r[1])) + Math.max(...right.map((r) => r[3]))) / 2] : null,
        stats: P.stats ? [(P.stats.r[0] + P.stats.r[2]) / 2, (P.stats.r[1] + P.stats.r[3]) / 2] : null, mid: R.left + R.width / 2 }; };
  });
  return ctx;
}
const judge = (s) => { const must = [], free = [], faded = []; for (const id in s.P) { const q = s.P[id]; if (q.op <= 0.35) faded.push(id); if (q.minF >= 0.15) must.push(id); else if (q.near === 0) free.push(id); }
  return { must, free, faded, badMust: must.filter((id) => !(s.P[id].op <= 0.35)), badFree: free.filter((id) => s.P[id].y || s.P[id].op < 0.9) }; };
const brief = (s) => ({ n: s.n, body: s.body, P: Object.fromEntries(Object.entries(s.P).map(([id, q]) => [id, [q.op, q.minF, q.maxF]])) });
const info = [];
// one boss, three holds (right panels / stats card / mid-screen) + the graze; phone: the stats card only when the layout shows it
async function holds(b, tag, vw) {
  const a = await E((b) => window.__arena(b), b);
  if (!a.ok) { check(false, `${tag}: the boss is drawn from its art`, a); return; }
  const T = await E(() => window.__targets());
  // 1) under the right-hand panels: on the ground (a phone's tracker sits up under the menu row: in the air there)
  await E(([T, air]) => window.__place(T.right[0], air ? T.right[2] : null), [T, vw === 'phone']);
  const s1 = await E(() => window.__sample(8)), j1 = judge(s1);
  check(j1.must.some((id) => RIGHT.includes(id)) && !j1.badMust.length && !j1.badFree.length,
    `${tag}: under the right-hand panels - each one its drawn body covers is faded (${j1.must.join(', ') || 'none covered'}), the rest untouched`, { j: j1, s: brief(s1) });
  if (vw === 1280) info.push(`INFO  ${b.name}: hitbox ${s1.hw} px wide; drawn (blit) ${s1.fullW.join('-')} px, opaque body ${s1.bodyW.join('-')} px over the hold -> the body is ${(s1.bodyW[0] / s1.hw).toFixed(2)}-${(s1.bodyW[1] / s1.hw).toFixed(2)}x the hitbox`);
  // 2) in the air under the stats card (a phone layout without the card skips this hold)
  let j2 = null;
  if (T.stats) {
    await E((T) => window.__place(T.stats[0], T.stats[1]), T);
    const s2 = await E(() => window.__sample(8)); j2 = judge(s2);
    check(j2.must.includes('stats') && !j2.badMust.length && !j2.badFree.length, `${tag}: under the stats card - the card fades, every untouched panel stays at full opacity`, { j: j2, s: brief(s2) });
  } else if (vw !== 'phone') check(false, `${tag}: the stats card is on screen`, T); else info.push(`INFO  ${tag}: this layout shows no stats card`);
  // 3) back on the ground mid-screen: what it left is back at full opacity
  await E((T) => window.__place(T.mid, null), T);
  const s3 = await E(() => window.__sample(8)), j3 = judge(s3);
  const restored = j2 ? [...j1.faded.filter((id) => j2.free.includes(id)), ...j2.faded.filter((id) => j3.free.includes(id))] : j1.faded.filter((id) => j3.free.includes(id));
  check(restored.length > 0 && !j3.badFree.length && !j3.badMust.length, `${tag}: moved away - the panels it left are back at full opacity (${restored.join(', ') || 'none'})`, { j3, s: brief(s3) });
  // a boss that only grazes a panel leaves it alone (once)
  if (vw === 1280 && b.type === 'kingKrook') {
    await E((T) => window.__place(T.right[1] + 6, null, true), T);
    const s4 = await E(() => window.__sample(8)), graze = Object.keys(s4.P).filter((id) => s4.P[id].maxF > 0 && s4.P[id].maxF < 0.08);
    check(graze.length > 0 && graze.every((id) => !s4.P[id].y && s4.P[id].op >= 0.9), `${tag}: grazing a panel by a few px leaves it at full opacity (${graze.join(', ') || 'no graze'})`, brief(s4));
  }
}
try {
  const ctx1 = await boot({ viewport: { width: 1280, height: 720 } });
  for (const [vw, vh] of [[1280, 720], [1920, 1080]].filter((v) => !RES || RES === String(v[0]))) {
    await p.setViewportSize({ width: vw, height: vh }); await E(() => window.__draws(34));   // hud-clear re-reads panel rects every 30 frames
    for (const b of BOSSES.filter((q) => !ONLY || ONLY.split(',').includes(q.type))) await holds(b, `${vw}x${vh} ${b.name}`, vw);
  }
  await ctx1.close();
  // a phone in landscape: the same panels inside the scaled game box
  if (!RES || RES === 'phone') {
    const ctx2 = await boot({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await E(() => window.__draws(34));
    for (const b of BOSSES.filter((q) => q.type === 'zodiac_capricorn' || q.type === 'miraFallen')) await holds(b, `844x390 phone ${b.name}`, 'phone');
    await ctx2.close();
  }
  for (const l of info) console.log(l);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
