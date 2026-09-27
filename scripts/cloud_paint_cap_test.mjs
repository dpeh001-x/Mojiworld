// Cloud paint cap: a painted hero's progress reaches the account cloud (v0.30.x cloud-paint-cap).
//   node scripts/cloud_paint_cap_test.mjs            (MOJI_GAME_FILE=<build.html> PORT=<port> to test a private build)
// The account cloud refuses a save over 512 KB (CSAVE_CAP in mp-cf/src/index.js, 413). The endpoint is stubbed with the same
// rule (text length > cap -> 413) and every POST captured; nothing reaches the network. A hero is painted with 12 layers of
// noise in the Wardrobe's data shapes (~0.9 MB): over the cap. Then a lowered server cap (413 -> one retry), a small paint,
// a pull back onto this device (its paint stays), and a pull onto a fresh device (a second browser profile).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11388';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const CAP = 512 * 1024;
let serverCap = CAP, cloudPull = null; const posts = [];   // { len, status, paint, localOnly, coins }
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const setup = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  // the account cloud, stubbed with the server's rule: a POST over the cap is refused 413; GET returns cloudPull
  await p.route((u) => /[/]api[/]/.test(u.pathname), async (r) => {
    const req = r.request(), isSave = /[/]api[/]save$/.test(new URL(req.url()).pathname);
    if (isSave && req.method() === 'POST') {
      const t = req.postData() || ''; const status = (!t || t.length > serverCap) ? 413 : 200; let pl = {};
      try { pl = JSON.parse(t).player || {}; } catch (e) {}
      posts.push({ len: t.length, status, paint: !!(pl.customPaint || (pl.customPaintLayers && Object.keys(pl.customPaintLayers).length)), localOnly: pl._lxPaintLocalOnly === true, ref: '_lxPaintRef' in pl, coins: pl.mojicoins, body: status === 200 ? t : '' });
      return r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { ok: true } : { ok: false, error: 'save missing or too large' }) });
    }
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, save: (isSave && req.method() === 'GET') ? cloudPull : null }) });
  });
  await p.addInitScript(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    window.__mkPaint = (seed, rows, ids) => {   // noise layers in the Wardrobe's shapes: a 192x256 canvas -> PNG data URL each
      let x = (seed >>> 0) || 1; const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
      const mk = () => { const c = document.createElement('canvas'); c.width = 192; c.height = 256; const g = c.getContext('2d'); const im = g.createImageData(192, rows);
        for (let i = 0; i < im.data.length; i += 4) { im.data[i] = rnd() * 256 | 0; im.data[i + 1] = rnd() * 256 | 0; im.data[i + 2] = rnd() * 256 | 0; im.data[i + 3] = 255; }
        g.putImageData(im, 0, Math.floor(rnd() * (256 - rows))); return c.toDataURL('image/png'); };
      const layers = {}; for (const id of (ids || CHAR_PAINT_LAYER_IDS)) layers[id] = mk();
      return { full: mk(), layers };
    };
    window.__applyPaint = (pt) => { player.customPaint = pt.full || null; player.customPaintLayers = _lxCleanPaintLayers(pt.layers); _lxPreloadPaintCache(player.customPaintLayers, player.customPaint); };
    window.__hashOf = (full, layers) => { const parts = [full || ''].concat(CHAR_PAINT_LAYER_IDS.map((k) => k + '=' + ((layers || {})[k] || '')));
      let h = 2166136261, n = 0; for (const s of parts) { n += s.length; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } } return (h >>> 0).toString(16) + ':' + n; };
    window.__heroHash = () => __hashOf(player.customPaint, player.customPaintLayers);
    window.__flush = () => { game._saveDirty = true; _flushSaveStateNow(); };
    // signed in to a cloud account for the length of one call (pushes happen only for cloud sessions)
    window.__asCloud = (f) => { const _s = LXAuth.session; LXAuth.session = () => ({ kind: 'cloud', token: 'test' }); try { return f(); } finally { LXAuth.session = _s; } };
  });
  const boot = async (first) => {
    await p.waitForFunction(() => typeof loadMap === 'function' && typeof _flushSaveStateNow === 'function' && typeof LXAuth === 'object', null, { timeout: 180000 });
    await p.evaluate(async (first) => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; window._lxAwaitingCreation = false;
      if (first) { player.cls = 'rogue'; player.level = 70; }
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
      loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
      player.invulnerable = 999999; game.monsters.length = 0;
      // count the cloud-paint toast
      window.__cpT = 0; const _st = window.showToast; window.showToast = function (m) { if (/too big for cloud sync/.test(String(m))) window.__cpT++; return _st.apply(this, arguments); };
    }, !!first);
  };
  const reloadBy = async (fn) => { const nav = p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 180000 }); await p.evaluate(fn); await nav; await boot(false); };
  return { ctx, p, errs, boot, reloadBy };
};
const newPosts = async (from, n, ms) => { const t0 = Date.now(); while (posts.length < from + n && Date.now() - t0 < (ms || 20000)) await new Promise((r) => setTimeout(r, 200)); return posts.slice(from); };
try {
  const A = await setup(); const p = A.p;
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await A.boot(true);
  // 1) a painted save over the cap: the flush's push goes without the paint, and lands
  let n0 = posts.length;
  const big = await p.evaluate(() => { __applyPaint(__mkPaint(11, 80)); player.mojicoins = 777001; __flush(); const raw = localStorage.getItem('levelx_save_v1'); return { hero: __heroHash(), whole: (typeof _lxSaveWithPaint === 'function' ? _lxSaveWithPaint(raw) : raw).length }; });
  await p.evaluate(() => __asCloud(() => __flush()));
  let got = await newPosts(n0, 1); const f1 = got[0] || {};
  check(big.whole > CAP && f1.status === 200 && f1.len <= CAP && !f1.paint && f1.localOnly && f1.coins === 777001,
    'a painted save over the 512 KB cap is pushed WITHOUT its paint (marked local-only), under the cap, and accepted with its progress', { whole: big.whole, len: f1.len, status: f1.status, paint: f1.paint, localOnly: f1.localOnly, coins: f1.coins, posts: got.length });
  check(await p.evaluate(() => window.__cpT) === 1, 'a toast says the paint stays on this device and progress still syncs', await p.evaluate(() => window.__cpT));
  // 2) another over-cap push (the pagehide one): the same, and no second toast
  n0 = posts.length;
  await p.evaluate(() => __asCloud(() => _lxCloudPushSave(localStorage.getItem('levelx_save_v1'), true)));
  got = await newPosts(n0, 1, 8000); const t2 = await p.evaluate(() => window.__cpT);
  check(got.length >= 1 && got[0].status === 200 && !got[0].paint && got[0].localOnly && t2 === 1, 'a second over-cap push also goes without the paint, and the toast shows only once per session', { post: got[0] && { status: got[0].status, paint: got[0].paint }, toasts: t2 });
  // 3) a server cap below the client's mirror: the whole save is refused (413), then retried once without the paint
  serverCap = 300 * 1024; n0 = posts.length;
  const med = await p.evaluate(() => { __applyPaint(__mkPaint(12, 35)); __flush(); const raw = localStorage.getItem('levelx_save_v1'); return (typeof _lxSaveWithPaint === 'function' ? _lxSaveWithPaint(raw) : raw).length; });
  let seq = []; const tq = Date.now();
  while (Date.now() - tq < 45000) {   // the push is throttled to one per 15 s: keep saving until it goes
    await p.evaluate(() => __asCloud(() => __flush())); await p.waitForTimeout(1000);
    seq = posts.slice(n0); const k = seq.findIndex((x) => x.status === 413); if (k >= 0 && seq.length > k + 1) break;
  }
  const i413 = seq.findIndex((x) => x.status === 413), retry = i413 >= 0 ? seq[i413 + 1] : null;
  check(med > 300 * 1024 && med <= CAP && i413 >= 0 && seq[i413].paint && retry && retry.status === 200 && !retry.paint && retry.localOnly,
    'with a lower server cap, the refused (413) push is retried once without the paint, and lands', { whole: med, seq: seq.map((x) => [x.len, x.status, x.paint]) });
  serverCap = CAP;
  // 4) a small paint still travels with the save, as before
  n0 = posts.length;
  const sm = await p.evaluate(() => { __applyPaint(__mkPaint(13, 8, ['hair'])); __flush(); return __heroHash(); });
  await p.evaluate(() => __asCloud(() => _lxCloudPushSave(localStorage.getItem('levelx_save_v1'), true)));
  got = await newPosts(n0, 1, 8000); const s1 = got[0] || {};
  const smHash = s1.body ? await p.evaluate((t) => { const pl = JSON.parse(t).player; return __hashOf(pl.customPaint, pl.customPaintLayers); }, s1.body) : null;
  check(s1.status === 200 && s1.paint && !s1.localOnly && !s1.ref && smHash === sm, 'a small paint is still pushed with the save (whole), as before', { status: s1.status, paint: s1.paint, localOnly: s1.localOnly, same: smHash === sm });
  // 5) pull a save that was pushed without its paint back onto this device: its paint stays, the cloud's progress arrives
  const loc = await p.evaluate(() => {
    __applyPaint(__mkPaint(14, 80)); __flush(); const sv = JSON.parse(localStorage.getItem('levelx_save_v1'));
    delete sv.player._lxPaintRef; delete sv.player.customPaint; delete sv.player.customPaintLayers; sv.player._lxPaintLocalOnly = true;
    sv.player.level = (sv.player.level || 1) + 5; sv.player.mojicoins = 919191; sv.t = Date.now() + 2000; sv.sig = _lxLocalSaveSig(sv);
    return { hero: __heroHash(), sv };
  });
  cloudPull = loc.sv;
  await A.reloadBy(() => { _lxCloudSyncOnLogin({ kind: 'cloud', token: 'test', name: 'tester' }); });
  const back = await p.evaluate(() => ({ hero: __heroHash(), level: player.level, coins: player.mojicoins }));
  check(back.hero === loc.hero && back.level === loc.sv.player.level && back.coins >= 919191 /* + whatever a login reward adds */, 'pulling it back onto this device keeps this device\'s paint, with the cloud\'s progress', { same: back.hero === loc.hero, level: back.level, want: loc.sv.player.level, coins: back.coins });
  // 6) a fresh device (another browser profile) pulls the same save: the progress, no paint, no errors
  const B = await setup();
  await B.p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await B.boot(false);
  cloudPull = loc.sv;
  await B.reloadBy(() => { _lxCloudSyncOnLogin({ kind: 'cloud', token: 'test', name: 'tester' }); });
  cloudPull = null;
  const fr = await B.p.evaluate(() => ({ level: player.level, coins: player.mojicoins, full: player.customPaint || null, layers: Object.keys(player.customPaintLayers || {}).length, rec: !!localStorage.getItem('levelx_save_v1_paint') }));
  check(fr.level === loc.sv.player.level && fr.coins >= 919191 && !fr.full && fr.layers === 0 && !fr.rec && B.errs.length === 0, 'a fresh device pulls the progress with no paint, and no errors', { fr, errs: B.errs.slice(0, 2) });
  check(A.errs.length === 0 && B.errs.length === 0, 'no page errors', A.errs.concat(B.errs).slice(0, 3));
  await A.ctx.close(); await B.ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
