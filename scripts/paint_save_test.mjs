// Paint save: the Wardrobe paint lives under its own key and is written only when it changes (v0.30.x paint-save).
//   node scripts/paint_save_test.mjs            (MOJI_GAME_FILE=<build.html> PORT=<port> to test a private build)
// Perf audit #4: every save re-wrote the whole Wardrobe paint (12 PNG layers, 1-3 MB) - a 29-65 ms stall 6-11 times a minute
// in a fight. A hero is painted with 12 layers of synthetic noise through the wardrobe's own data shapes (192x256 canvas
// toDataURL per layer, the apply path's _lxCleanPaintLayers + _lxPreloadPaintCache); every localStorage write is counted
// per key. Six boots of the same browser profile: paint + save / a reload / an old inline-paint save / a backup restore /
// an import / an account cloud pull. Checks 1-4 and the migration / "stored the new way" ones fail on the build before.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11380';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  // the account cloud: never the network - a POST is captured, anything else answers "no cloud save"
  let cloudBodies = [], cloudPull = null;
  await p.route((u) => /[/]api[/]/.test(u.pathname), async (r) => {
    if (r.request().method() === 'POST' && /[/]api[/]save$/.test(new URL(r.request().url()).pathname)) cloudBodies.push(r.request().postData() || '');
    const get = r.request().method() === 'GET' && /[/]api[/]save$/.test(new URL(r.request().url()).pathname);
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, save: get ? cloudPull : null }) });
  });
  await p.addInitScript(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    // count every localStorage write per key (+ chars), and let a check make the paint key / a big main save "full"
    const _si = Storage.prototype.setItem;
    window.__lsw = { n: {}, chars: 0 };
    Storage.prototype.setItem = function (k, v) {
      if (this === window.localStorage) {
        const q = () => new DOMException('storage full (test)', 'QuotaExceededError');
        if (window.__failPaint && k === 'levelx_save_v1_paint') throw q();
        if (window.__failBigMain && k === 'levelx_save_v1' && String(v).length > 200000) throw q();
      }
      const r = _si.call(this, k, v);
      if (this === window.localStorage) { window.__lsw.n[k] = (window.__lsw.n[k] || 0) + 1; window.__lsw.chars += String(v).length; }
      return r;
    };
    // 12 layers of noise, the wardrobe's shapes: one 192x256 canvas -> PNG data URL per layer + the full-body paint
    window.__mkPaint = (seed, rows) => {
      let x = (seed >>> 0) || 1; const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
      const mk = () => {
        const c = document.createElement('canvas'); c.width = 192; c.height = 256; const g = c.getContext('2d');
        const im = g.createImageData(192, rows || 80);
        for (let i = 0; i < im.data.length; i += 4) { im.data[i] = rnd() * 256 | 0; im.data[i + 1] = rnd() * 256 | 0; im.data[i + 2] = rnd() * 256 | 0; im.data[i + 3] = 255; }
        g.putImageData(im, 0, Math.floor(rnd() * (256 - (rows || 80)))); return c.toDataURL('image/png');
      };
      const layers = {}; for (const id of CHAR_PAINT_LAYER_IDS) layers[id] = mk();
      return { full: mk(), layers };
    };
    // what the Wardrobe's Apply does with the studio's paint
    window.__applyPaint = (pt) => { player.customPaint = pt.full || null; player.customPaintLayers = _lxCleanPaintLayers(pt.layers); _lxPreloadPaintCache(player.customPaintLayers, player.customPaint); };
    window.__hashOf = (full, layers) => {
      const parts = [full || ''].concat(CHAR_PAINT_LAYER_IDS.map((k) => k + '=' + ((layers || {})[k] || '')));
      let h = 2166136261, n = 0; for (const s of parts) { n += s.length; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } }
      return (h >>> 0).toString(16) + ':' + n;
    };
    window.__heroHash = () => __hashOf(player.customPaint, player.customPaintLayers);
    // the stored state as a load would see it: inline paint, or the paint record its reference names
    window.__stored = () => {
      const raw = localStorage.getItem('levelx_save_v1'); const rec = localStorage.getItem('levelx_save_v1_paint');
      if (!raw) return { main: 0, rec: rec ? rec.length : 0, hash: null };
      const sv = JSON.parse(raw), pl = sv.player || {}; let hash = null, via = 'none';
      if (typeof pl.customPaint === 'string' || (pl.customPaintLayers && Object.keys(pl.customPaintLayers).length)) { hash = __hashOf(pl.customPaint, pl.customPaintLayers); via = 'inline'; }
      else if (pl._lxPaintRef && rec) { const r = JSON.parse(rec); if (r.id === pl._lxPaintRef) { hash = __hashOf(r.customPaint, r.customPaintLayers); via = 'record'; } else via = 'mismatch'; }
      return { main: raw.length, rec: rec ? rec.length : 0, hash, via, coins: pl.mojicoins, level: pl.level };
    };
    window.__flush = () => { game._saveDirty = true; _flushSaveStateNow(); };
    window.__resetCount = () => { window.__lsw = { n: {}, chars: 0 }; };
  });
  const boot = async (first) => {
    await p.waitForFunction(() => typeof loadMap === 'function' && typeof _flushSaveStateNow === 'function' && typeof exportSaveSecure === 'function', null, { timeout: 180000 });
    await p.evaluate(async (first) => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; window._lxAwaitingCreation = false;
      if (first) { player.cls = 'rogue'; player.level = 70; }
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
      loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
      player.invulnerable = 999999; game.monsters.length = 0; game._resetting = false;
    }, !!first);
  };
  const reload = async (trigger, arg) => {   // trigger: a page call that reloads by itself (restore / import); else a plain reload
    const nav = p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 180000 });
    if (trigger) await p.evaluate(trigger, arg); else await p.evaluate(() => location.reload());
    await nav; await boot(false);
  };
  // the paint's pixels, as the hero renderer's cache decodes them (every layer loaded, then hashed)
  const pixels = () => p.evaluate(async () => {
    const srcs = [_lxGetCustomPaintSource()].concat(CHAR_PAINT_LAYER_IDS.map((k) => _lxGetCustomPaintSource(k))).filter(Boolean);
    const inCache = srcs.every((s) => _LX_CUSTOM_PAINT_CACHE.has(s));
    const t0 = performance.now(); let imgs = [];
    while (performance.now() - t0 < 30000) { imgs = srcs.map((s) => _lxCustomPaintImage(s)); if (imgs.every(Boolean)) break; await new Promise((r) => setTimeout(r, 100)); }
    if (!imgs.every(Boolean)) return { n: srcs.length, inCache, px: 'not decoded' };
    const c = document.createElement('canvas'); c.width = 192; c.height = 256; const g = c.getContext('2d', { willReadFrequently: true });
    let h = 2166136261; for (const im of imgs) { g.clearRect(0, 0, 192, 256); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, 192, 256).data; for (let i = 0; i < d.length; i += 3) { h ^= d[i]; h = Math.imul(h, 16777619); } }
    return { n: srcs.length, inCache, px: (h >>> 0).toString(16) };
  });

  // ---------- boot 1: paint, then save ----------
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await boot(true);
  const a = await p.evaluate(() => { __applyPaint(__mkPaint(11)); __resetCount(); __flush(); const st = __stored(); return { st, w: __lsw.n.levelx_save_v1_paint || 0, hero: __heroHash() }; });
  check(a.st.main < 200000, 'with 12 noise layers painted, the main save stays small (well under 200 KB)', { main: a.st.main, rec: a.st.rec });
  check(a.w === 1 && a.st.via === 'record' && a.st.hash === a.hero, 'the paint is stored once, under its own key, and the save points at it', { w: a.w, via: a.st.via });
  const b = await p.evaluate(() => { __resetCount(); const t0 = performance.now(); for (let i = 0; i < 5; i++) { player.mojicoins = (player.mojicoins || 0) + 1; __flush(); } const ms = (performance.now() - t0) / 5; return { w: __lsw.n.levelx_save_v1_paint || 0, main: __lsw.n.levelx_save_v1 || 0, chars: __lsw.chars, ms: Math.round(ms * 10) / 10 }; });
  console.log('INFO  one save with the paint unchanged: ' + b.ms + ' ms, ' + Math.round(b.chars / 5 / 1024) + ' KB written (information only, not a check)');
  check(b.w === 0 && b.main >= 5 && b.chars < 1000000, '5 saves without a paint change never rewrite the paint (under 1 MB written in all)', b);
  const c = await p.evaluate(() => { const pt = __mkPaint(12); __applyPaint({ full: player.customPaint, layers: Object.assign({}, player.customPaintLayers, { hair: pt.layers.hair }) }); __resetCount(); __flush(); const st = __stored(); return { w: __lsw.n.levelx_save_v1_paint || 0, ok: st.hash === __heroHash(), main: st.main }; });
  check(c.w === 1 && c.ok && c.main < 200000, 'changing one layer rewrites the paint record once', c);
  // a save naming another record id (a second tab saved in between) still gets the one record; no record = no dangling reference
  const t = await p.evaluate(() => {
    if (typeof _lxSaveWithPaint !== 'function') return { missing: true };
    const raw = localStorage.getItem('levelx_save_v1').replace(/"_lxPaintRef":"[^"]*"/, '"_lxPaintRef":"pOtherTab"');
    const whole = JSON.parse(_lxSaveWithPaint(raw)).player; const sp = JSON.parse(raw).player; _lxPaintLoad(sp);
    const rec = localStorage.getItem('levelx_save_v1_paint'); localStorage.removeItem('levelx_save_v1_paint');
    let bare = null; try { bare = JSON.parse(_lxSaveWithPaint(raw)).player; } catch (x) { bare = String(x); }
    localStorage.setItem('levelx_save_v1_paint', rec); __flush();
    const hero = __heroHash();
    return { copy: __hashOf(whole.customPaint, whole.customPaintLayers) === hero, load: __hashOf(sp.customPaint, sp.customPaintLayers) === hero,
      bare: typeof bare === 'object' && !('_lxPaintRef' in bare) && !bare.customPaint };
  });
  check(t.copy && t.load && t.bare, 'a save naming another paint id still copies / loads the one paint record; with none, a copy has no dangling reference', t);
  // copies out: the account cloud push and Steam Cloud carry whole saves, paint included
  const d = await p.evaluate(() => {
    const _s = LXAuth.session; LXAuth.session = () => ({ kind: 'cloud', token: 'test' }); __flush(); LXAuth.session = _s;
    let steam = null; window.SteamAPI = { available: true, cloud: { write: (k, v) => { steam = v; return Promise.resolve(); } } };
    try { _lxSteamCloudPush(localStorage.getItem('levelx_save_v1'), true); } finally { delete window.SteamAPI; }
    const sv = steam ? JSON.parse(steam) : { player: {} };
    return { hero: __heroHash(), steam: __hashOf(sv.player.customPaint, sv.player.customPaintLayers), steamRef: '_lxPaintRef' in sv.player };
  });
  await p.waitForTimeout(500);
  const cbRaw = cloudBodies.length ? cloudBodies[cloudBodies.length - 1] : '{"player":{}}';
  const cloudHash = await p.evaluate((t) => { const pl = JSON.parse(t).player || {}; return __hashOf(pl.customPaint, pl.customPaintLayers) + ('_lxPaintRef' in pl ? ':ref' : ''); }, cbRaw);
  check(cloudHash === d.hero && d.steam === d.hero && !d.steamRef, 'the account cloud and Steam Cloud copies carry the paint (whole saves)', { cloud: cloudHash, steam: d.steam, hero: d.hero, pushes: cloudBodies.length });
  // storage full while writing the paint record: the save keeps the paint inline, then heals once there is room
  const e = await p.evaluate(() => {
    __applyPaint(__mkPaint(13)); window.__failPaint = true; let threw = null; try { __flush(); } catch (x) { threw = String(x); }
    const st1 = __stored(); window.__failPaint = false; __flush(); const st2 = __stored();
    return { threw, via1: st1.via, ok1: st1.hash === __heroHash(), via2: st2.via, ok2: st2.hash === __heroHash(), main2: st2.main };
  });
  check(!e.threw && e.via1 === 'inline' && e.ok1 && e.via2 === 'record' && e.ok2 && e.main2 < 200000, 'no room for the paint record: the save keeps the paint inline, and moves it out once there is room', e);
  // not even the inline save fits: reported like any full save; the stored save keeps the new progress + the last stored paint
  const f = await p.evaluate(() => {
    const before = __heroHash(); const prevPaint = { full: player.customPaint, layers: player.customPaintLayers };
    __applyPaint(__mkPaint(14)); player.mojicoins = 424242; game._quotaWarned = false; window.__failPaint = true; window.__failBigMain = true;
    let threw = null; try { __flush(); } catch (x) { threw = String(x); }
    window.__failPaint = false; window.__failBigMain = false; const st = __stored(); const warned = !!game._quotaWarned;
    __applyPaint(prevPaint); __flush();
    return { threw, warned, keptPaint: st.hash === before, coins: st.coins };
  });
  check(!f.threw && f.warned && f.keptPaint && f.coins === 424242, 'when nothing fits it fails like any full save, and the stored save still loads its last paint', f);
  // a Save Backup of paint P1, then paint P2 + a secure export of it
  const g = await p.evaluate(() => { __applyPaint(__mkPaint(21)); __flush(); const h1 = __heroHash(); const ok = _lxCreateBackup('paint test') !== false; const bk = _lxGetBackups()[0]; return { ok, id: bk && bk.id, h1, bkMain: bk ? bk.data.length : 0 }; });
  await p.evaluate(() => { __applyPaint(__mkPaint(22)); __flush(); });
  const dl = p.waitForEvent('download', { timeout: 60000 });
  await p.evaluate(() => exportSaveSecure());
  const exported = readFileSync(await (await dl).path(), 'utf8');
  const h2 = await p.evaluate(() => __heroHash());
  const exHash = await p.evaluate((t) => { const o = JSON.parse(t); const sv = JSON.parse(o.data); return __hashOf(sv.player.customPaint, sv.player.customPaintLayers); }, exported);
  check(g.ok && exHash === h2 && g.bkMain > 200000, 'a Save Backup and a Secure Save export both carry the paint', { backup: g.ok, bkLen: g.bkMain, exported: exHash === h2 });
  const px2 = await pixels();

  // ---------- boot 2: a reload ----------
  await reload();
  const r2 = await p.evaluate(() => ({ hero: __heroHash() }));
  const px2b = await pixels();
  check(r2.hero === h2, 'a reload restores identical paint data', { before: h2, after: r2.hero });
  check(px2b.n === 12 && px2b.inCache && px2b.px === px2.px, 'the paint still draws on the hero after the reload (all 12 layers pre-warmed in the paint cache, same pixels)', { before: px2, after: px2b });
  // an OLD save: the paint inline in the save, no paint record
  const h3 = await p.evaluate(() => {
    const pt = __mkPaint(31); const sv = JSON.parse(localStorage.getItem('levelx_save_v1'));
    sv.player.customPaint = pt.full; sv.player.customPaintLayers = pt.layers; delete sv.player._lxPaintRef;
    game._resetting = true; if (game._saveTimer) { clearTimeout(game._saveTimer); game._saveTimer = null; }
    localStorage.removeItem('levelx_save_v1_paint'); localStorage.setItem('levelx_save_v1', JSON.stringify(sv));
    return __hashOf(pt.full, pt.layers);
  });
  // ---------- boot 3: the old inline-paint save ----------
  await reload();
  const m = await p.evaluate(() => { const hero = __heroHash(); __flush(); const st = __stored(); return { hero, via: st.via, same: st.hash === hero, main: st.main }; });
  check(m.hero === h3, 'an old save with the paint inline loads its paint', { want: h3, got: m.hero });
  check(m.via === 'record' && m.same && m.main < 200000, 'its next save moves the paint out to its own key', m);
  // ---------- boot 4: restore the Save Backup (paint P1) ----------
  await reload((id) => _lxRestoreBackup(id), g.id);
  const rb = await p.evaluate(() => ({ hero: __heroHash(), st: __stored() }));
  check(rb.hero === g.h1, 'restoring a Save Backup brings its paint back', { want: g.h1, got: rb.hero });
  check(rb.st.via === 'record' && rb.st.main < 200000, 'a restored backup is stored the new way (small save + paint record)', rb.st);
  // ---------- boot 5: import the Secure Save export (paint P2) ----------
  await p.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.id = '__imp'; i.style.display = 'none'; document.body.appendChild(i); window.uiConfirm = () => Promise.resolve(true); });
  await p.setInputFiles('#__imp', { name: 'paint.mojisave', mimeType: 'application/json', buffer: Buffer.from(exported) });
  await reload(() => importSave(document.getElementById('__imp')));
  const im = await p.evaluate(() => ({ hero: __heroHash(), st: __stored() }));
  check(im.hero === h2 && im.st.via === 'record' && im.st.main < 200000, 'export -> import round-trips the paint (stored the new way)', { want: h2, got: im.hero, st: im.st });
  // a Steam Cloud pull of a whole save with paint: split on arrival; the auto backup of the local save keeps its paint
  const sp = await p.evaluate(async () => {
    __flush(); const pt = __mkPaint(41); const sv = JSON.parse(typeof _lxSaveWithPaint === 'function' ? _lxSaveWithPaint(localStorage.getItem('levelx_save_v1')) : localStorage.getItem('levelx_save_v1'));
    sv.player.customPaint = pt.full; sv.player.customPaintLayers = pt.layers; delete sv.player._lxPaintRef; sv.player.level = (sv.player.level || 1) + 5; sv.t = Date.now() + 1000;
    const cloudRaw = JSON.stringify(sv); localStorage.removeItem('lx_cloud_local_wins');
    window.SteamAPI = { available: true, cloud: { read: async () => cloudRaw, write: () => Promise.resolve() } };
    let r = null; try { r = await _lxSteamCloudSync(); } finally { delete window.SteamAPI; }
    const bk = _lxGetBackups()[0]; const bsv = bk ? JSON.parse(bk.data) : { player: {} };
    return { r, st: __stored(), want: __hashOf(pt.full, pt.layers), local: __heroHash(), backup: __hashOf(bsv.player.customPaint, bsv.player.customPaintLayers), label: bk && bk.label };
  });
  check(sp.r === 'reloading' && sp.st.hash === sp.want && sp.st.via === 'record' && sp.st.main < 200000 && sp.backup === sp.local, 'a Steam Cloud pull stores the cloud paint under its key; the auto backup keeps the local paint', sp);
  // ---------- boot 6: an account cloud pull (sign-in) of a whole save with paint ----------
  const pull = await p.evaluate(() => { const sv = JSON.parse(typeof _lxSaveWithPaint === 'function' ? _lxSaveWithPaint(localStorage.getItem('levelx_save_v1')) : localStorage.getItem('levelx_save_v1')); const pt = __mkPaint(51, 40);
    sv.player.customPaint = pt.full; sv.player.customPaintLayers = pt.layers; delete sv.player._lxPaintRef; sv.player.level = (sv.player.level || 1) + 5; sv.t = Date.now() + 2000; return { sv, want: __hashOf(pt.full, pt.layers) }; });
  cloudPull = pull.sv;
  await reload(() => { _lxCloudSyncOnLogin({ kind: 'cloud', token: 'test', name: 'tester' }); });
  cloudPull = null;
  const ap = await p.evaluate(() => ({ hero: __heroHash(), st: __stored() }));
  check(ap.hero === pull.want && ap.st.via === 'record' && ap.st.main < 200000, 'an account cloud pull loads the cloud paint (stored the new way)', { want: pull.want, got: ap.hero, st: ap.st });
  // New Game / Erase: clearSave removes the paint record with the save
  const ng = await p.evaluate(() => { const had = !!localStorage.getItem('levelx_save_v1_paint'); clearSave(); return { had, save: localStorage.getItem('levelx_save_v1'), rec: localStorage.getItem('levelx_save_v1_paint') }; });
  check(ng.had && ng.save === null && ng.rec === null, 'New Game / Erase clears the paint record too', { had: ng.had, save: !!ng.save, rec: !!ng.rec });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
