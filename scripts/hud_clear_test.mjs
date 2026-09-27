// HUD clear (v0.30.x hud-clear): nothing the player needs to see sits under the HUD.
//   node scripts/hud_clear_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// By bounding rects; canvas things (portals, their plates, the hero, the boss plate) are mapped to the screen through the
// camera (screen = canvas rect + (world - camera) * canvas px per world px).
//   town exit portal (Everdawn Central's right end, the first quest's way out) at 1280x720 and 1920x1080: no visible
//     HUD element over the portal, its plate or the hero standing at it - or it is faded (opacity <= 0.35);
//   the hero at the Void's right edge: the same;
//   a forced "+XP" kill pill (and a coin pill) with a quest tracked: clear of the tracker, Hotkeys and Taxi;
//   phones (844x390, 667x375, touch): the top menu buttons clear of the affix chip and the area nameplate, and the quest
//     tracker / Multi chip clear of the buttons and of each other;
//   prologue: the "Zodiac Sanctum" portal plate clear of the Gravitos boss plate and of the memory card; no page errors.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11364';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
async function boot(opts) {
  const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof acceptQuest === 'function' && typeof _renderAffixPin === 'function' && typeof _prologueApexSegment === 'function', null, { timeout: 150000 });
  await p.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true;
    // page helpers: wait N sim frames (wall-clock guarded), world box -> screen rect, and the element scan
    window.__frames = async (n, ms) => { const t0 = game.time | 0, w0 = Date.now(); while ((game.time | 0) - t0 < n && Date.now() - w0 < (ms || 30000)) await new Promise((s) => setTimeout(s, 40)); return (game.time | 0) - t0; };
    window.__scr = (x, y, w, h) => { const R = document.getElementById('game').getBoundingClientRect(), k = R.width / W, cx = game.camera.x || 0, cy = game.camera.y || 0; return [R.left + (x - cx) * k, R.top + (y - cy) * k, R.left + (x + w - cx) * k, R.top + (y + h - cy) * k]; };
    window.__hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    window.__rect = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
    // every visible, painted element (not the canvas, its ancestors, full-screen layers or dev-only chips) over a target, with its
    // effective opacity (the product up the tree)
    window.__over = (targets) => {
      const cv = document.getElementById('game'), R = cv.getBoundingClientRect(), out = [];
      const clear = (c) => !c || c === 'transparent' || /rgba\(\d+, \d+, \d+, 0\)/.test(c);
      for (const el of document.querySelectorAll('body *')) {
        if (el === cv || el.contains(cv) || cv.contains(el) || /^(lx-dev-lock|mobile-dev-btn)$/.test(el.id)) continue;
        const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0) || (r.width > R.width * 0.9 && r.height > R.height * 0.9)) continue;
        const b = [r.left, r.top, r.right, r.bottom]; if (!targets.some((t) => __hit(t, b))) continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const paints = /^(IMG|CANVAS|VIDEO|svg)$/i.test(el.tagName) || !clear(cs.backgroundColor) || cs.backgroundImage !== 'none'
          || (parseFloat(cs.borderTopWidth) > 0 && !clear(cs.borderTopColor)) || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!paints) continue;
        let op = 1; for (let a = el; a && a !== document.documentElement; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
        if (op < 0.02) continue;
        out.push({ el: el.id || (el.className && String(el.className).slice(0, 24)) || el.tagName, op: +op.toFixed(2) });
      }
      return out;
    };
  });
  return { ctx, p };
}
const enterWorld = (p, map, lvl) => p.evaluate(async ([map, lvl]) => {
  window._prologueActive = false; player.cls = 'warrior'; player.level = lvl || 2;
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
  loadMap(map); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
  player.invulnerable = 999999; game.monsters.length = 0;
  try { acceptQuest('q_act1_waking', true); } catch (e) {} try { renderQuestTracker(); } catch (e) {}
  return __frames(20);
}, [map, lvl]);
// the portal plate as drawn (drawImage of a portal's baked plate) and the boss plate's painted box (drawImage / fillRect made
// inside drawSuperBossBar with an unsquashed transform), both in canvas px
const hooks = (p) => p.evaluate(() => {
  if (window.__hooked) return; window.__hooked = true; let inBB = false;
  window.__cvs = (b) => { const R = document.getElementById('game').getBoundingClientRect(), k = R.width / W; return [R.left + b[0] * k, R.top + b[1] * k, R.left + b[2] * k, R.top + b[3] * k]; };
  const cvBox = (ctx, x, y, w, h) => { const m = ctx.getTransform(), k0 = ctx.canvas.width / W; if (Math.abs(m.b) > 1e-3 || Math.abs(m.c) > 1e-3) return null; return [(m.e + m.a * x) / k0, (m.f + m.d * y) / k0, (m.e + m.a * (x + w)) / k0, (m.f + m.d * (y + h)) / k0, m.a / k0, m.d / k0]; };
  // the plate lives in the top band; the boss-name card that eases in mid-screen for 1.9 s on acquisition is not the header
  const bb = (b) => { if (inBB && b && b[1] < 90 && Math.abs(b[4] - 1) < 0.05 && Math.abs(b[5] - 1) < 0.05) window.__bbCur.push(b.slice(0, 4)); };
  const d = CanvasRenderingContext2D.prototype.drawImage, f = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.drawImage = function (img) {
    try {
      const a = arguments, n = a.length, dst = n >= 9 ? [a[5], a[6], a[7], a[8]] : n >= 5 ? [a[1], a[2], a[3], a[4]] : [a[1], a[2], img.width, img.height];
      if (n === 5 && img && img.tagName === 'CANVAS' && game.portals && game.portals.some((q) => q._lblSprite === img)) window.__lbl = cvBox(this, ...dst);
      else bb(cvBox(this, ...dst));
    } catch (e) {}
    return d.apply(this, arguments);
  };
  CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) { try { bb(cvBox(this, x, y, w, h)); } catch (e) {} return f.apply(this, arguments); };
  const o = window.drawSuperBossBar;
  window.drawSuperBossBar = function () { inBB = true; window.__bbCur = []; try { return o.apply(this, arguments); } finally { inBB = false; if (window.__bbCur.length) window.__bb = window.__bbCur.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])]); } };
});

async function desktop(vw, vh) {
  const { ctx, p } = await boot({ viewport: { width: vw, height: vh } });
  await hooks(p);
  const fr = await enterWorld(p, 'town');
  // the kill feed first (the hero is not near the panels yet)
  const xp = await p.evaluate(async () => {
    showKillToast(12, 8); await __frames(2); showCoinToast(5); await new Promise((s) => setTimeout(s, 400));
    const vis = (id) => { const e = document.getElementById(id); return e && e.getBoundingClientRect().height > 0 ? __rect(e) : null; };
    const pills = [...document.querySelectorAll('#coin-toast-zone .coin-toast')].map(__rect), qt = vis('quest-tracker');
    const panels = ['quest-tracker', 'hotkey-hint', 'taxi-btn'].map(vis).filter(Boolean);
    return { pills: pills.length, qt, hits: pills.filter((r) => panels.some((q) => __hit(r, q))).map((r) => r.map(Math.round)) };
  });
  check(fr > 5 && xp.qt && xp.pills >= 2 && xp.hits.length === 0, `${vw}x${vh}: a "+XP" kill pill and a coin pill land clear of the quest tracker, Hotkeys and Taxi`, xp);
  // the first quest's way out: the Emerald Thicket portal at the right end of Everdawn Central, the hero standing at it
  const town = await p.evaluate(async () => {
    for (const e of document.querySelectorAll('#coin-toast-zone .coin-toast')) e.remove();   // the pills above had their own check
    const po = game.portals.find((q) => q.dest === 'forest'); if (!po) return { err: 'no portal' };
    window.__lbl = null; const w0 = Date.now(), t0 = game.time | 0;
    while ((game.time | 0) - t0 < 45 && Date.now() - w0 < 40000) { player.x = po.x - player.w / 2 - 20; player.vx = 0; await new Promise((s) => setTimeout(s, 40)); }
    const fy = (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x);
    const T = [__scr(po.x - 55, fy - 140, 110, 140), __scr(player.x - 16, player.y - 40, player.w + 32, player.h + 56)];
    if (window.__lbl) T.push(__cvs(window.__lbl));
    const all = __over(T);
    return { lbl: !!window.__lbl, cam: Math.round(game.camera.x), under: all.length, opaque: all.filter((o) => o.op > 0.35) };
  });
  check(town.lbl && town.under > 0 && town.opaque.length === 0, `${vw}x${vh}: the town exit portal, its "Enter" plate and the hero at it are not under an opaque HUD panel`, town);
  // the Void's right edge
  const vd = await p.evaluate(async () => {
    loadMap('void'); await new Promise((s) => setTimeout(s, 1500)); for (const o of document.querySelectorAll('#void-intro-overlay, #story-beat-overlay')) o.classList.remove('show', 'on');
    player.invulnerable = 999999; const w0 = Date.now(), t0 = game.time | 0;
    while ((game.time | 0) - t0 < 45 && Date.now() - w0 < 40000) { player.x = (game.mapData.worldWidth || W) - player.w; player.vx = 0; await new Promise((s) => setTimeout(s, 40)); }
    const all = __over([__scr(player.x - 16, player.y - 40, player.w + 32, player.h + 56)]);
    return { map: game.currentMap, under: all.length, opaque: all.filter((o) => o.op > 0.35) };
  });
  check(vd.map === 'void' && vd.under > 0 && vd.opaque.length === 0, `${vw}x${vh}: the hero at the Void's right edge is not under an opaque HUD panel`, vd);
  await ctx.close();
}

async function phone(vw, vh) {
  const { ctx, p } = await boot({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await enterWorld(p, 'mushroom', 30);
  const ph = await p.evaluate(async () => {
    const L = WORLD_AFFIXES.find((a) => a.id === 'lucid'); window._activeAffix = () => L; _renderAffixPin(); renderQuestTracker();
    const w0 = Date.now(); while (document.body.classList.contains('cinematic') && Date.now() - w0 < 12000) await new Promise((s) => setTimeout(s, 100));
    await __frames(10);
    const vis = (el) => { if (!el) return null; const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0) ? [r.left, r.top, r.right, r.bottom] : null; };
    const btns = [...document.querySelectorAll('.mc-pots > *'), document.getElementById('fullscreen-btn'), document.getElementById('settings-btn')].map(vis).filter(Boolean);
    const it = {}; for (const id of ['world-affix-pin', 'map-label', 'quest-tracker', 'mp-btn']) it[id] = vis(document.getElementById(id));
    const on = (id) => it[id] ? btns.filter((b) => __hit(b, it[id])).length : -1;
    const ids = ['world-affix-pin', 'quest-tracker', 'mp-btn'].filter((id) => it[id]); let pair = 0;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (__hit(it[ids[i]], it[ids[j]])) pair++;
    for (const k in it) if (it[k]) it[k] = it[k].map(Math.round);
    return { mc: document.body.classList.contains('mc-landscape'), btns: btns.length, it, chip: on('world-affix-pin'), plate: on('map-label'), qt: on('quest-tracker'), mp: on('mp-btn'), pair };
  });
  check(ph.mc && ph.btns >= 6 && ph.chip === 0 && ph.plate === 0, `${vw}x${vh} phone: the top menu buttons are clear of the "LUCID +12% EXP" chip and the area nameplate`, ph);
  check(ph.it['quest-tracker'] && ph.qt === 0 && ph.mp <= 0 && ph.pair === 0, `${vw}x${vh} phone: the quest tracker and the Multi chip are clear of the buttons and of the chip`, ph);
  await ctx.close();
}

async function prologue() {
  const { ctx, p } = await boot({ viewport: { width: 1280, height: 720 } });
  await hooks(p);
  await p.evaluate(() => { player.cls = 'warrior'; player.level = 1; window._prologueActive = true; _prologueApexSegment(); });
  const armed = await p.waitForFunction(() => !!document.getElementById('prologue-hud') && !game.paused && game.currentMap === 'gravitosArena', null, { timeout: 150000 }).then(() => true, () => false);
  if (!armed) { check(false, 'prologue: the Gravitos fight arms', await p.evaluate(() => ({ map: game.currentMap, paused: game.paused, hud: !!document.getElementById('prologue-hud'), active: !!window._prologueActive, t: game.time | 0 }))); await ctx.close(); return; }
  const pr = await p.evaluate(async () => {
    const po = game.portals.find((q) => q.dest === 'zodiacHall'); if (!po) return { err: 'no Zodiac portal' };
    const fy = (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x);
    window.__lbl = null; window.__bb = null; const w0 = Date.now(), t0 = game.time | 0;
    while ((game.time | 0) - t0 < 30 && Date.now() - w0 < 30000) { player.x = po.x - player.w / 2 - 30; player.y = fy - player.h; player.vx = 0; player.vy = 0; await new Promise((s) => setTimeout(s, 30)); }
    const L = window.__lbl, B = window.__bb; if (!L || !B) return { err: 'not drawn', lbl: !!L, boss: !!B };
    const lbl = L.slice(0, 4), card = document.getElementById('prologue-hud'), cr = card ? __rect(card) : null;
    return { lbl: lbl.map(Math.round), plate: B.map(Math.round), boss: __hit(lbl, B), card: cr ? __hit(__cvs(lbl), cr) : null, cr: cr && cr.map(Math.round) };
  });
  check(!pr.err && pr.boss === false, 'prologue: the "Zodiac Sanctum" portal plate is clear of the Gravitos boss plate', pr);
  check(!pr.err && pr.card === false, 'prologue: ...and of the memory card under it', pr);
  await ctx.close();
}

const ONLY = process.env.HC_ONLY || '';   // debug: run one part (desktop | phone | prologue)
try {
  if (!ONLY || ONLY === 'desktop') { await desktop(1280, 720); await desktop(1920, 1080); }
  if (!ONLY || ONLY === 'phone') { await phone(844, 390); await phone(667, 375); }
  if (!ONLY || ONLY === 'prologue') await prologue();
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
