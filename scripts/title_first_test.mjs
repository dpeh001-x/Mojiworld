// The title menu comes first (v0.30.x title-first): before it is interactive only the title's own art loads.
//   node scripts/title_first_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// A cold first visit fetched ~50 MB before the title menu could be clicked (every town backdrop, the town NPC sheets,
// every character-creation part, the UI tabs) - about a minute on a slow line. Every boot here is a fresh profile on a
// throttled line (CDP: 1.5 MB/s down, 40 ms), served by an in-process server that answers ETag revalidations like a
// CDN. The same build is booted with ?lxtf=0 (the old order; a no-op on a build without title-first) and without it,
// in the same run:
//   A  bytes, files and time before the title is interactive drop by >= 40%; the title's own art is in when it is up;
//      what the menu no longer waits for starts right after it
//   B  New Game at once: the creator's look page opens on loaded parts (none broken or blank), within a bounded time
//      and no later overall than the old order
//   C  Continue with a save made on a non-town map (every resume opens in town): the boot prepares the map it opens on,
//      not the save's; that map's backdrop is loaded and drawn in the first frame the fade lifts, no later overall
//   D  a returning player (warm cache): the title is no later than the old order's
import { chromium } from 'playwright-core';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 11501);
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const THROTTLE = { offline: false, latency: 40, downloadThroughput: 1.5e6, uploadThroughput: 1e6 };
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// ---- the server: the repo's files, and origin/main's for any the (possibly stale) working copy lacks; ETag revalidation --
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.webm': 'video/webm', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
let TREE = new Set();
try { TREE = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main'], { cwd: ROOT, maxBuffer: 1 << 26 }).toString().split('\n')); } catch (e) {}
const blobs = new Map();
const srvStat = { n200: 0, n304: 0 };
const srv = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^[/]+/, '');
  if (!rel) rel = FILE;
  if (rel === 'mojiworld_game.html' && process.env.MOJI_GAME_FILE) rel = FILE;
  const fp = path.join(ROOT, path.normalize(rel));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  let body = null, tag = null;
  try {
    if (existsSync(fp) && statSync(fp).isFile()) { const st = statSync(fp); tag = '"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"'; if (req.headers['if-none-match'] !== tag) body = readFileSync(fp); }
    else if (TREE.has(rel)) { let b = blobs.get(rel); if (!b) { b = execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 28 }); blobs.set(rel, b); } tag = '"g' + crypto.createHash('md5').update(b).digest('hex').slice(0, 16) + '"'; if (req.headers['if-none-match'] !== tag) body = b; }
  } catch (e) { tag = null; body = null; }
  if (!tag) { res.writeHead(404); return res.end('not found'); }
  if (!body) { srvStat.n304++; res.writeHead(304, { ETag: tag, 'Cache-Control': 'no-cache' }); return res.end(); }
  srvStat.n200++;
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(rel).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: tag });
  res.end(body);
});
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
// ---- a boot: CDP throttle + request log; the title = the boot hold's release (the menu asks for it as it comes up) --------
const INIT = () => {
  let H = null;
  try {
    Object.defineProperty(window, '_lxBootHold', { configurable: true, get() { return H; }, set(v) {
      H = v;
      try { const r = v.release; v.release = function (why) { if (!window.__relAt) { window.__relAt = performance.timeOrigin + performance.now(); window.__relWhy = why; } return r.apply(this, arguments); }; } catch (e) {}
    } });
  } catch (e) {}
  const mark = () => {
    const o = document.getElementById('loading-overlay'), a = document.getElementById('lo-auth');
    if (!window.__titleAt && o && a && o.classList.contains('menu-up') && a.classList.contains('shown')) {
      window.__titleAt = performance.timeOrigin + performance.now();
      // what the title shows, the moment it is up: its pictures, the key art, its fonts
      const imgs = [...o.querySelectorAll('img')].filter((im) => im.getAttribute('src'));
      const got = new Set(performance.getEntriesByType('resource').map((e) => e.name));
      window.__titleArt = { imgs: imgs.length, imgsIn: imgs.filter((im) => im.complete && im.naturalWidth > 0).length,
        // the key art: every image the <head> preloads (the title backdrop), fetched by now
        keyArt: (() => { const l = [...document.querySelectorAll('link[rel="preload"][as="image"]')].map((x) => x.href); return l.length > 0 && l.every((h) => got.has(h)); })(),
        fonts: document.fonts ? document.fonts.status : 'n/a' };
    }
    if (!window.__fadeAt && o && o.classList.contains('fade') && window.__titleAt) { window.__fadeAt = performance.timeOrigin + performance.now(); try { if (window.__onFade) window.__onFade(); } catch (e) { window.__onFadeErr = String(e); } }
  };
  new MutationObserver(mark).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
};
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
const boot = async (label, qs, save, ctx0) => {
  const ctx = ctx0 || await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(label + ' ' + String(e).slice(0, 160)));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', THROTTLE);
  const R = new Map(); let off = null;
  cdp.on('Network.requestWillBeSent', (e) => { if (off == null) off = e.wallTime - e.timestamp; if (!R.has(e.requestId)) R.set(e.requestId, { u: e.request.url, w: e.wallTime * 1000, chunks: [], done: 0 }); });
  // bytes off the network: a finished request's encodedDataLength; one still in flight, its chunks so far; a cache hit (or a
  // not-modified revalidation) brings none
  cdp.on('Network.dataReceived', (e) => { const r = R.get(e.requestId); if (r && off != null) r.chunks.push([(e.timestamp + off) * 1000, e.dataLength]); });
  cdp.on('Network.requestServedFromCache', (e) => { const r = R.get(e.requestId); if (r) r.cached = true; });
  cdp.on('Network.responseReceived', (e) => { const r = R.get(e.requestId); const q = e.response || {}; if (r && (q.status === 304 || q.fromDiskCache || q.fromMemoryCache || q.fromPrefetchCache)) r.cached = true; });
  cdp.on('Network.loadingFinished', (e) => { const r = R.get(e.requestId); if (r && off != null) { r.done = (e.timestamp + off) * 1000; r.enc = e.encodedDataLength; } });
  await p.addInitScript(INIT);
  if (save) await p.addInitScript((sv) => { try { if (!sessionStorage.getItem('__tfSaved')) { sessionStorage.setItem('__tfSaved', '1'); localStorage.setItem('levelx_save_v1', sv); localStorage.setItem('mojiworld_prologue_seen', '1'); } } catch (e) {} }, save);
  const t0 = Date.now();
  await p.goto(`http://localhost:${PORT}/${FILE}${qs}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await p.waitForFunction(() => !!window.__titleAt, null, { timeout: 300000, polling: 100 });
  const pg = await p.evaluate(() => ({ titleAt: window.__titleAt, relAt: window.__relAt || 0, why: window.__relWhy || null, t0: performance.timeOrigin, art: window.__titleArt }));
  const at = pg.relAt || pg.titleAt;
  const art = (u) => /^https?:/.test(u);
  const pre = [...R.values()].filter((r) => art(r.u) && r.w < at);
  const bytes = [...R.values()].reduce((s, r) => s + (r.cached ? 0 : (r.done && r.done < at) ? (r.enc || 0) : r.chunks.filter((c) => c[0] < at).reduce((a, c) => a + c[1], 0)), 0);
  return { label, ctx, p, cdp, R, at, t0, pg, titleMs: Math.round(pg.titleAt - pg.t0), files: pre.length, mb: +(bytes / 1e6).toFixed(1), wallMs: Date.now() - t0 };
};
const folder = (u) => { try { const q = decodeURIComponent(new URL(u).pathname).replace(/^[/]/, '').split('/'); return q.slice(0, q[0] === 'Sprites' ? 2 : 1).join('/'); } catch (e) { return '?'; } };
const byFolder = (b) => { const o = {}; for (const r of b.R.values()) { if (!/^https?:/.test(r.u) || r.w >= b.at) continue; const k = folder(r.u); o[k] = (o[k] || 0) + 1; } return o; };
// the creator's look page, the moment the loading overlay starts to fade (B)
const LOOK_SNAP = () => {
  const st = (im) => !im ? 'missing' : (im.complete && im.naturalWidth > 0) ? 'ok' : (im.complete ? 'broken' : 'loading');
  const lc = (player && player.lookCustom) || {};
  const parts = { hair: st(LX_HAIR[lc.hairId || 'flow']), eyes: st(LX_EYES[lc.eyeId || 'default']), mouth: st(LX_MOUTH[lc.mouthId || 'default']) };
  const heads = Object.keys(LX_HEAD).map((k) => st(LX_HEAD[k]));
  const look = document.getElementById('cs-page-look'), modal = document.getElementById('class-select-modal');
  const imgs = [...document.querySelectorAll('#class-select-modal img')].filter((im) => im.getAttribute('src') && im.offsetParent !== null);
  const thumbs = [...document.querySelectorAll('#cs-page-look .cs-dd-trigger img')];
  window.__look = { parts, heads, lookVisible: !!(look && modal && modal.style.display === 'flex' && getComputedStyle(look).display !== 'none'),
    imgs: imgs.length, imgsOk: imgs.filter((im) => st(im) === 'ok').length, imgsBad: imgs.filter((im) => st(im) !== 'ok').map((im) => im.getAttribute('src')).slice(0, 5),
    thumbs: thumbs.length, thumbsOk: thumbs.filter((im) => st(im) === 'ok').length };
};
try {
  // ---- A + B: the old order, then title-first; New Game the moment the title is up ----------------------------------------
  const run = {};
  for (const [label, qs] of [['old', '?lxtf=0'], ['new', '']]) {
    const b = await boot(label, qs);
    b.byFolder = byFolder(b);
    console.log(`${label}: title at ${b.titleMs} ms after ${b.files} files / ${b.mb} MB (released by ${b.pg.why}) ${JSON.stringify(b.byFolder)}`);
    await b.p.evaluate((snap) => {
      window.__onFade = new Function('return (' + snap + ')')();
      document.getElementById('menu-newgame').click();
      document.getElementById('auth-user').value = 'Tester';
      window.__clickAt = performance.timeOrigin + performance.now();
      document.getElementById('auth-submit').click();
    }, LOOK_SNAP.toString());
    await b.p.waitForFunction(() => !!window.__fadeAt, null, { timeout: 300000, polling: 100 });
    await b.p.waitForTimeout(300);
    b.look = await b.p.evaluate(() => ({ look: window.__look, err: window.__onFadeErr || null, clickToLook: Math.round(window.__fadeAt - window.__clickAt), loadToLook: Math.round(window.__fadeAt - performance.timeOrigin) }));
    console.log(`${label}: New Game -> look page ${b.look.clickToLook} ms after the click (${b.look.loadToLook} ms after load) ${JSON.stringify(b.look.look)}`);
    run[label] = b;
  }
  const O = run.old, N = run.new;
  const info = { old: { ms: O.titleMs, files: O.files, mb: O.mb }, new: { ms: N.titleMs, files: N.files, mb: N.mb } };
  check(N.mb <= O.mb * 0.6 && N.files <= O.files * 0.6, `before the title is interactive: ${N.mb} MB / ${N.files} files, down >= 40% from the old order's ${O.mb} MB / ${O.files} files`, info);
  check(N.titleMs <= O.titleMs * 0.6, `the title is interactive at ${N.titleMs} ms, down >= 40% from the old order's ${O.titleMs} ms (same throttled line)`, info);
  const artOk = (b) => b.pg.art && b.pg.art.imgs > 0 && b.pg.art.imgsIn === b.pg.art.imgs && b.pg.art.keyArt;
  check(artOk(N) && artOk(O) && N.pg.why === 'menu', `the title's own art is in when it comes up (${N.pg.art && N.pg.art.imgsIn}/${N.pg.art && N.pg.art.imgs} pictures, key art ${N.pg.art && N.pg.art.keyArt}, fonts ${N.pg.art && N.pg.art.fonts}); the menu released the hold`, { old: O.pg, new: N.pg });
  // what the menu no longer waits for starts right after it: the creator's parts (the start map's art) and the town
  const firstAfter = (b, rx) => { let t = Infinity; for (const r of b.R.values()) if (rx.test(decodeURIComponent(r.u)) && r.w >= b.at) t = Math.min(t, r.w - b.at); return t === Infinity ? null : Math.round(t); };
  // (a new save starts in the Void; next door is the town: its backdrop and its NPC sheets)
  const nb = await N.p.evaluate(() => { const bg = [], npc = []; for (const q of (MAPS.void.portals || [])) { const md = MAPS[q.dest]; if (!md) continue;
    if (md.bg && BG_IMAGES[md.bg]) bg.push('/' + BG_IMAGES[md.bg]._lxPath); for (const n of (md.npcs || [])) if (NPC_SPRITE_FILES[n.name]) npc.push('/Sprites/npc/' + NPC_SPRITE_FILES[n.name]); } return { bg, npc }; });
  const anyOf = (list) => ({ test: (u) => list.some((x) => u.endsWith(x)) });
  const aft = { parts: firstAfter(N, /\/Sprites\/character\/hair\//), town: firstAfter(N, anyOf(nb.bg)), npc: firstAfter(N, anyOf(nb.npc)) };
  check(aft.parts != null && aft.parts < 1500 && aft.town != null && aft.town < 4000 && aft.npc != null && aft.npc < 4000, `what the title no longer waits for starts right after it (ms after: creator parts ${aft.parts}, the town next door: backdrop ${aft.town}, NPC sheet ${aft.npc})`, aft);
  const lookOk = (l) => l && l.lookVisible && Object.values(l.parts).every((x) => x === 'ok') && l.heads.length > 0 && l.heads.every((x) => x === 'ok') && l.imgs > 0 && l.imgsOk === l.imgs && l.thumbs >= 3 && l.thumbsOk === l.thumbs;
  check(lookOk(N.look.look), `New Game at once: the look page opens on loaded art - hair/eyes/mouth ${JSON.stringify(N.look.look && N.look.look.parts)}, ${N.look.look && N.look.look.imgsOk}/${N.look.look && N.look.look.imgs} pictures, ${N.look.look && N.look.look.thumbsOk}/${N.look.look && N.look.look.thumbs} part thumbs`, N.look);
  check(N.look.clickToLook <= 90000 && N.look.loadToLook <= Math.max(O.look.loadToLook * 1.1, O.look.loadToLook + 3000), `... within a bounded wait (${N.look.clickToLook} ms after the click) and no later overall than the old order (${N.look.loadToLook} vs ${O.look.loadToLook} ms after load)`, { old: O.look, new: N.look });
  for (const label of ['old', 'new']) await run[label].ctx.close();
  // ---- D: a returning player (a disk cache from an earlier visit; ETag revalidation): the title is no later than before -------
  const warm = {};
  for (const [label, qs] of [['old', '?lxtf=0'], ['new', '']]) {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'tf-warm-'));
    const pctx = await chromium.launchPersistentContext(dir, { channel: 'chrome', args: ['--mute-audio'], viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
    try {
      // the earlier visit, at full speed: the title, then what the boot loads with or behind it
      const p1 = pctx.pages()[0] || await pctx.newPage();
      await p1.goto(`http://localhost:${PORT}/${FILE}${qs}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await p1.waitForFunction(() => { const H = window._lxBootHold, B = window._lxBootStats; return !!(H && B && H.stats().open && H.stats().held === 0 && (!H.tf || H.tf().waiting === 0) && B.gated >= B.gatedTotal && B.all >= B.allTotal); }, null, { timeout: 120000, polling: 250 }).catch(() => {});
      await p1.close();
      const s0 = { ...srvStat };
      const w = await boot(label + '-warm', qs, null, pctx);
      warm[label] = { ms: w.titleMs, files: w.files, mb: w.mb, full: srvStat.n200 - s0.n200, notModified: srvStat.n304 - s0.n304 };
      console.log(`${label} (warm cache): title at ${w.titleMs} ms, ${w.files} requests / ${w.mb} MB before it ${JSON.stringify(warm[label])}`);
    } finally { await pctx.close(); try { rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
  }
  check(warm.new.ms <= warm.old.ms + 750, `a returning player (warm cache) gets the title no later than before (${warm.new.ms} vs ${warm.old.ms} ms)`, warm);
  // ---- C: Continue with a saved game on a non-town map -----------------------------------------------------------------------
  const MAP = 'mushroom';
  // bughunt D2: a save with no signature is refused now (Continue would never start), so the fixture is signed the way the game signs it:
  // HMAC-SHA256 over the ls3 body (only the signed keys count: cls + level; `look` and `currentMap` are not part of it)
  const SECRET = /const _LX_SAVE_SECRET = '([^']+)'/.exec(readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8'))[1];
  const saveObj = { v: 1, t: Date.now(), player: { cls: 'warrior', level: 12, look: { name: 'Tester' } }, game: { currentMap: MAP } };
  saveObj.sig = crypto.createHmac('sha256', SECRET).update(['ls3', saveObj.v, saveObj.t, JSON.stringify({ cls: 'warrior', level: 12 }), '{}'].join('\n')).digest('hex');
  const save = JSON.stringify(saveObj);
  // every resume lands in town (loadState, v0.26.961), whatever map the save was made on: THAT is the map to prepare
  const cont = {};
  for (const [label, qs] of [['old', '?lxtf=0'], ['new', '']]) {
    const c = await boot('continue-' + label, qs, save);
    const cm = await c.p.evaluate((map) => {
      const sv = MAPS[map], cur = game.currentMap, md = MAPS[cur];
      const bg = (md && md.bg && BG_IMAGES[md.bg]) || (md && md.isTown ? BG_IMAGES.everdawnMegamall : null);
      window.__bgDraws = []; window.__rg = [];
      const o = window.drawBackground;
      window.drawBackground = function () {
        try { const ov = document.getElementById('loading-overlay'); const pick = _pickBGImage();
          window.__bgDraws.push({ fade: !ov || ov.classList.contains('fade'), map: game.currentMap, own: !!bg && pick === bg, loaded: !!(bg && bg._loaded && bg.naturalWidth > 0) }); } catch (e) {}
        return o.apply(this, arguments);
      };
      const g = window._lxReadyGate; window._lxReadyGate = function (id) { window.__rg.push(id); return g.apply(this, arguments); };
      window.__onFade = () => { window.__bgAtFade = { loaded: !!(bg && bg.complete && bg.naturalWidth > 0), map: game.currentMap }; };
      const atTitle = !!(bg && bg.complete && bg.naturalWidth > 0);
      window.__clickAt = performance.timeOrigin + performance.now();
      document.getElementById('menu-continue').click();
      return { saved: map, savedTown: !!(sv && sv.isTown), savedBg: sv && sv.bg && BG_IMAGES[sv.bg] ? BG_IMAGES[sv.bg]._lxPath : null, map: cur, bg: bg ? bg._lxPath : null, loadedAtTitle: atTitle };
    }, MAP);
    await c.p.waitForFunction(() => !!window.__fadeAt && (window.__bgDraws || []).filter((d) => d.fade).length >= 3, null, { timeout: 300000, polling: 100 });
    const cr = await c.p.evaluate(() => ({ atFade: window.__bgAtFade, first: (window.__bgDraws || []).find((d) => d.fade), readied: window.__rg,
      clickToFade: Math.round(window.__fadeAt - window.__clickAt), loadToFade: Math.round(window.__fadeAt - performance.timeOrigin), fadeAt: window.__fadeAt }));
    const reqAt = (file, until) => { let t = null; if (file) for (const r of c.R.values()) if (r.w < until && decodeURIComponent(r.u).endsWith('/' + file)) t = Math.min(t == null ? Infinity : t, Math.round(r.w - c.at)); return t; };
    cr.bgAsked = reqAt(cm.bg, Infinity); cr.savedBgAsked = reqAt(cm.savedBg, cr.fadeAt);   // ms after the title (negative: before it)
    console.log(`continue (${label}): title at ${c.titleMs} ms after ${c.files} files / ${c.mb} MB; ${JSON.stringify(cm)} -> ${JSON.stringify(cr)}`);
    cont[label] = { c, cm, cr };
    await c.ctx.close();
  }
  const { cm, cr } = cont.new, co = cont.old.cr;
  check(!cm.savedTown && cm.bg && cr.readied && cr.readied[0] === cm.map && cr.bgAsked != null && cr.bgAsked < 1500 && cr.savedBgAsked == null,
    `Continue with a save made on ${MAP} (not a town) prepares the map it opens on (${cm.map}): its backdrop asked for ${cr.bgAsked} ms after the title, the ready gate on ${cr.readied && cr.readied[0]}; ${MAP}'s backdrop not fetched (${cr.savedBgAsked})`, { cm, cr });
  check(cr.atFade && cr.atFade.map === cm.map && cr.atFade.loaded && cr.first && cr.first.map === cm.map && cr.first.own && cr.first.loaded && cr.loadToFade <= Math.max(co.loadToFade * 1.1, co.loadToFade + 3000),
    `... its backdrop is loaded and drawn in the first frame the fade lifts (${cr.clickToFade} ms after the click), no later overall than the old order (${cr.loadToFade} vs ${co.loadToFade} ms after load)`, { cm, cr, old: co });
} catch (e) { check(false, 'harness error', String(e && e.stack || e).slice(0, 400)); }
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); srv.close();
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
