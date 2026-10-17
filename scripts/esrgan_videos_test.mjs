// esrgan-videos confirming test: the five backdrop clips are the reviewed upscales (same container shape: faststart h264 High, no
// audio), each plays at its new size with the old duration and aspect, is drawn in EXACTLY the box its old dimensions gave (the map
// backdrop slot, the bgNoMirror travel, the Void's cover-fit), and fills that box from >= 1.4x the source pixels it had.
//   node scripts/esrgan_videos_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// On origin (old clips) FILES, SIZES and SHARP fail; CONTAINER, DURATION/ASPECT and BOX pass on both.
import { chromium } from 'playwright-core';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11728';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// [repo path, video key ('void' = the Void's sky), map id, old W, old H, new W, new H, duration s, new sha256]
const VIDS = [
  ["backgrounds/everdawn.mp4","town","town",1280,720,1920,1080,7.583333,"9c74aed3f25ed5e853cb1eeed2c5cbd328fefa0425f0728c40f9c0f876893d17"],
  ["backgrounds/weightbearerStair.mp4","weightbearerStair","weightbearerStair",1344,768,1890,1080,9.625,"f9722bb67406252caad856b88a9e2fcb6c310de50ad19555b2e47a42a6ce3f09"],
  ["backgrounds/gravitos.mp4","gravitosArena","gravitosArena",832,464,1872,1044,5.041667,"0c9f32a016eb987dcb26fa3dc87506ce003be247646ce9db4a01460059c715ca"],
  ["backgrounds/gravitosfinale.mp4","gravitosFinale","gravitosArena",832,464,1872,1044,5.041667,"0a97bce268e7f4d0648f8b6be4dacd0a4c876782d8467c42cb1ef1bcafcac0d9"],
  ["backgrounds/thevoid.mp4","void","void",832,464,1872,1044,5.041667,"c35dfeb35e09526c5694f4f0e609bd421133a7c478d53f140b31c92601ea1eef"],
];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  // FILES + CONTAINER: the served bytes are the reviewed clips; moov before mdat (streams at once), h264 High (avcC profile 100), no sound track
  { const miss = [], shape = [];
    for (const [rel, , , , , , , , want] of VIDS) {
      let b = null; try { b = Buffer.from(await (await fetch(`http://localhost:${PORT}/${rel}`)).arrayBuffer()); } catch (e) {}
      if (!b || crypto.createHash('sha256').update(b).digest('hex') !== want) miss.push(rel);
      if (!b) { shape.push(rel + ' unreadable'); continue; }
      const moov = b.indexOf('moov'), mdat = b.indexOf('mdat'), avcC = b.indexOf('avcC');
      if (!(moov > 0 && moov < mdat)) shape.push(rel + ' moov after mdat');
      if (!(avcC > 0 && b[avcC + 5] === 100)) shape.push(rel + ' not h264 High');
      if (b.indexOf('soun') >= 0 && b.indexOf('soun') < mdat) shape.push(rel + ' has a sound track');
    }
    check(!miss.length, 'FILES: all ' + VIDS.length + ' clips are the reviewed upscales (sha256)', { notNew: miss });
    check(!shape.length, 'CONTAINER: every clip is faststart h264 High with no sound track (as before)', shape); }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  // serve.js has no byte ranges; Chrome needs them to play an mp4 that is not cached whole - answer .mp4 requests here with ranges
  await p.route(/\.mp4(\?|$)/, async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, ''), f = path.join(ROOT, rel);
    if (!existsSync(f)) return r.fulfill({ status: 404, body: '' });
    const buf = readFileSync(f), m = /bytes=(\d*)-(\d*)/.exec(r.request().headers()['range'] || '');
    if (!m) return r.fulfill({ status: 200, contentType: 'video/mp4', headers: { 'accept-ranges': 'bytes' }, body: buf });
    const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
    return r.fulfill({ status: 206, contentType: 'video/mp4', headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${b}/${buf.length}` }, body: buf.subarray(a, b + 1) });
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('lx_render_scale', '2'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _lxMapVideoEnsure === 'function' && typeof _voidVideoEnsure === 'function', null, { timeout: 150000 });
  const rows = await p.evaluate(async (VIDS) => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; try { applyClass('mage'); } catch (e) { player.cls = 'mage'; } player.level = 70;
    try { for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true; } catch (e) {}
    const frames = (n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); } return false; };
    try { _LX_VID_CACHE_ON = false; } catch (e) {}   // draw the element itself, so the blit names it
    // a map entry can raise a card that pauses the game (the town welcome, a story beat, a boss intro): clear them so frames draw
    const unblock = () => { document.getElementById('everdawn-welcome-overlay')?.remove(); for (const id of ['story-beat-overlay', 'boss-intro-overlay']) document.getElementById(id)?.classList.remove('on');
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } } try { closeAllModals(); } catch (e) {} game.paused = false; game.monsters.length = 0; };
    const P = CanvasRenderingContext2D.prototype, oD = P.drawImage; let rec = null;
    P.drawImage = function (im) { if (rec && this === ctx && im instanceof HTMLVideoElement && arguments.length === 5) { const t = this.getTransform(); rec.push({ im, dx: arguments[1], dy: arguments[2], dw: arguments[3], dh: arguments[4], a: t.a }); } return oD.apply(this, arguments); };
    const out = [];
    for (const [rel, key, map, ow, oh] of VIDS) {
      loadMap(map); await frames(5); unblock(); await frames(15); unblock(); player.invulnerable = 999999;
      if (key === 'gravitosFinale') _lxGravFinaleBg = true;
      const el = () => (key === 'void' ? _voidVideoEnsure() : _lxMapVideoEnsure(key));
      const ok = await until(() => { unblock(); if (key === 'gravitosFinale') _lxGravFinaleBg = true; const v = el(); return v && v.readyState >= 2 && v.videoWidth > 0; }, 90000);
      const v = el(); if (!ok || !v) { out.push({ rel, err: 'clip never ready', rs: v && v.readyState }); continue; }
      await until(() => { unblock(); return typeof _lxMapVideoAlpha !== 'number' || key === 'void' || _lxMapVideoAlpha >= 1; }, 15000); unblock(); await frames(4);
      rec = []; await frames(8); const hit = rec.find((c) => c.im === v && c.a > 0); rec = null;
      if (!hit) { out.push({ rel, err: 'no draw of the clip seen' }); continue; }
      const md = game.mapData, OA = ow / oh, dpr = ctx.canvas.width / W; let e;
      if (key === 'void') { const sc = Math.max(W / ow, H / oh); e = { w: ow * sc, h: oh * sc, x: (W - ow * sc) / 2, y: (H - oh * sc) / 2 }; }
      else if (md.bgNoMirror) { const s = _lxNoMirrorSize(md.worldWidth, OA); e = { w: s.w, h: s.h, y: md.bgCropTop != null ? Math.round((H - s.h) * md.bgCropTop) : H - s.h }; }
      else { let bw = W, bh = H; if (md.isVerticalTower && md.worldHeight > H) { bh = Math.round(H * 1.45); bw = Math.round(W * 1.45); } const wc = _lxWideCover(OA, bw, bh); e = wc ? { w: wc.w, h: wc.h, y: null } : { w: bw, h: bh, y: md.isVerticalTower ? null : 0 }; }
      const same = Math.abs(hit.dw - e.w) < 1e-6 && Math.abs(hit.dh - e.h) < 1e-6 && (e.y == null || Math.abs(hit.dy - e.y) < 1e-6) && (e.x == null || Math.abs(hit.dx - e.x) < 1e-6);
      out.push({ rel, map: game.currentMap, vw: v.videoWidth, vh: v.videoHeight, dur: v.duration, box: [hit.dx, hit.dy, hit.dw, hit.dh], exp: e, same, dens: +(v.videoWidth / (hit.dw * dpr)).toFixed(3), old: +(ow / (e.w * dpr)).toFixed(3) });
    }
    return out; }, VIDS.map((q) => q.slice(0, 5)));
  const byRel = Object.fromEntries(VIDS.map((q) => [q[0], q]));
  const errs2 = rows.filter((q) => q.err);
  check(!errs2.length && rows.length === VIDS.length, 'CLIPS: all ' + VIDS.length + ' backdrop clips load, play and draw in game', errs2);
  const ok = rows.filter((q) => !q.err);
  const wrong = ok.filter((q) => q.vw !== byRel[q.rel][5] || q.vh !== byRel[q.rel][6]);
  check(ok.length === VIDS.length && !wrong.length, 'SIZES: every clip plays at its upscaled size', wrong.map((q) => q.rel + ' ' + q.vw + 'x' + q.vh));
  const drift = ok.filter((q) => Math.abs(q.dur - byRel[q.rel][7]) > 0.002 || Math.abs((q.vw / q.vh) / (byRel[q.rel][3] / byRel[q.rel][4]) - 1) > 1e-4);
  check(ok.length === VIDS.length && !drift.length, 'DURATION + ASPECT: every clip keeps its old length (to 2 ms) and shape (to 0.01%)', drift.map((q) => q.rel + ' ' + q.dur));
  const moved = ok.filter((q) => !q.same);
  check(ok.length === VIDS.length && !moved.length, 'BOX: every clip is drawn in exactly the box (size + anchor) its old dimensions gave', moved);
  const soft = ok.filter((q) => !(q.dens >= 1.4 * q.old));
  check(ok.length === VIDS.length && !soft.length, 'SHARP: every clip fills its box from >= 1.4x the source pixels it had (DPR 2)', soft.map((q) => q.rel + ' ' + q.dens + ' (old ' + q.old + ')'));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
