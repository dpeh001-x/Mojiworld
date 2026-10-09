// Sharp Display (v0.30.x phone-sharp): the Settings > Graphics switch that draws the game canvas at the screen's sharpness.
//   node scripts/phone_sharp_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PERF=1 adds the
//                                                 busy-scene cost of ON vs OFF, thread-clock ms per frame from a trace)
// At 844x390 DPR 3 (touch) and 1280x720 DPR 2, through the real Settings switch:
//   OFF (the default) the backing store is exactly what the build before this change drew (960x560 on the phone, whose
//   cap is 1; 1920x1120 on the desktop, whose cap is 2); ON it is >= 1.5 store px per CSS px of the canvas box;
//   the canvas box itself does not move (the DOM HUD lines up); a monster drawn in a frozen frame (photo mode) lands on the
//   same CSS rect at both settings, within 1 CSS px; a click / tap on an NPC opens it and (phone) a deck tap jumps, with
//   the switch ON; a photo-mode screenshot is the whole sharp frame; the switch survives a reload; OFF again restores the
//   old backing store; no page errors.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11460';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; else if (process.env.DEBUG === '1') console.log('      ' + JSON.stringify(info).slice(0, 900)); };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
const TYPES = { woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', css: 'text/css', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm', html: 'text/html' };
async function boot(opts) {
  const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block', acceptDownloads: true }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  // any file this (possibly stale) working copy lacks comes from origin/main, like the font route of keybinds_test
  const missing = (u) => { if (u.hostname !== 'localhost') return false; const rel = decodeURIComponent(u.pathname).replace(/^[/]/, ''); return !!rel && !existsSync(path.join(ROOT, rel)); };
  await p.route(missing, async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    try { r.fulfill({ status: 200, contentType: TYPES[rel.split('.').pop().toLowerCase()] || 'application/octet-stream', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }) }); } catch (e) { r.continue(); }
  });
  // lx_drs=off: the resolution governor's emergency floor (High, desktop) drops the store to scale 1 for the rest of a map
  // once headless frames crawl past 45 ms - its own job, but it would move the numbers these checks read mid-test
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  return { ctx, p, cdp: await ctx.newCDPSession(p) };
}
// the game proper, past the title (the keybinds_test recipe), on the given map
const enterWorld = async (p, map) => {
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof openSettingsModal === 'function' && typeof togglePhotoMode === 'function', null, { timeout: 150000 });
  return p.evaluate(async (map) => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap(map); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.paused = false;
    const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < 20 && performance.now() - t0 < 20000) await new Promise((s) => setTimeout(s, 50));
    return (game.time | 0) - g0;
  }, map);
};
// n rendered frames (rAF), with a wall-clock guard; the sim may be frozen (photo mode), so not game.time
const frames = (p, n) => p.evaluate((n) => new Promise((res) => { let k = 0; const t0 = performance.now(); const f = () => { if (++k >= n || performance.now() - t0 > 15000) res(k); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
const state = (p) => p.evaluate(() => { const cv = document.getElementById('game'), R = cv.getBoundingClientRect();
  return { w: cv.width, h: cv.height, rect: [R.left, R.top, R.width, R.height].map((v) => +v.toFixed(2)), per: +(cv.width / R.width).toFixed(3), dpr: +_LX_DPR.toFixed(4), sharp: typeof _LX_SHARP === 'undefined' ? 'n/a' : _LX_SHARP }; });
// flip the switch the way a player does: open Settings, tap / click the Sharp Display toggle, close
async function setSharp(p, want, touch) {
  await p.evaluate(() => { openSettingsModal(); const e = document.getElementById('set-sharp'); if (e) e.scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(400);
  const pt = await p.evaluate(() => { const e = document.getElementById('set-sharp'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, on: e.classList.contains('on') }; });
  if (pt && pt.on !== want) { if (touch) await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300); }
  const now = await p.evaluate(() => { const e = document.getElementById('set-sharp'); return e ? e.classList.contains('on') : null; });
  await p.evaluate(() => { try { closeSettingsModal(); } catch (e) {} });
  await frames(p, 4);
  return { found: !!pt, on: now };
}
// the device box of everything drawImage'd for monster m during a frame, as CSS px on the page (n frames)
const capMon = (p, idx, n) => p.evaluate(([idx, n]) => new Promise((res) => {
  const m = game.monsters[idx]; const P = CanvasRenderingContext2D.prototype, o = P.drawImage, od = window.drawMonster;
  const boxes = []; let cur = null, on = false;
  P.drawImage = function (img) {
    if (on && this === ctx) {
      const a = arguments; let dx, dy, dw, dh;
      if (a.length >= 9) { dx = a[5]; dy = a[6]; dw = a[7]; dh = a[8]; } else if (a.length >= 5) { dx = a[1]; dy = a[2]; dw = a[3]; dh = a[4]; } else { dx = a[1]; dy = a[2]; dw = img.width; dh = img.height; }
      const t = this.getTransform();
      for (const [x, y] of [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]]) { const X = t.a * x + t.c * y + t.e, Y = t.b * x + t.d * y + t.f; if (!cur) cur = [X, Y, X, Y]; else { cur[0] = Math.min(cur[0], X); cur[1] = Math.min(cur[1], Y); cur[2] = Math.max(cur[2], X); cur[3] = Math.max(cur[3], Y); } }
    }
    return o.apply(this, arguments);
  };
  window.drawMonster = function (mm) { const me = mm === m; if (me) { on = true; cur = null; } try { return od.apply(this, arguments); } finally { if (me) { on = false; if (cur) boxes.push(cur); } } };
  const cv = document.getElementById('game'), R = cv.getBoundingClientRect(), k = R.width / cv.width;
  const done = () => { P.drawImage = o; window.drawMonster = od; res({ boxes: boxes.map((b) => [R.left + b[0] * k, R.top + b[1] * k, R.left + b[2] * k, R.top + b[3] * k].map((v) => +v.toFixed(2))),
    cam: [R.left + (m.x - game.camera.x) * R.width / W, R.top + (m.y - game.camera.y) * R.height / H].map((v) => +v.toFixed(2)) }); };
  let f = 0; const t0 = performance.now(); const step = () => { if (boxes.length >= n || ++f > n + 20 || performance.now() - t0 > 15000) done(); else requestAnimationFrame(step); }; requestAnimationFrame(step);
}), [idx, n]);
const pngSize = (buf) => (buf.length > 24 && buf.readUInt32BE(12) === 0x49484452) ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null;
async function perfWindow(p, cdp, secs) {   // thread-clock ms per main frame (Commit) from a Chrome trace
  const evs = []; const onData = (d) => { for (const e of d.value) evs.push(e); };
  cdp.on('Tracing.dataCollected', onData);
  await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel', 'blink', 'gpu', 'v8'] } });
  await p.waitForTimeout(secs * 1000);
  const doneP = new Promise((r) => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await doneP; cdp.off('Tracing.dataCollected', onData);
  const byTid = new Map(); for (const e of evs) if (e.name === 'FireAnimationFrame') byTid.set(e.pid + ':' + e.tid, (byTid.get(e.pid + ':' + e.tid) || 0) + 1);
  const main = [...byTid.entries()].sort((a, b) => b[1] - a[1])[0]; const mk = main ? main[0] : '';
  const td = {}; let commits = 0;
  for (const e of evs) { if (e.ph !== 'X' || (e.pid + ':' + e.tid) !== mk) continue; if (e.name === 'Commit') commits++;
    if (['RunTask', 'FunctionCall', 'RasterImplementation::RasterCHROMIUM'].includes(e.name)) td[e.name] = (td[e.name] || 0) + (e.tdur != null ? e.tdur : e.dur) / 1000; }
  // the GPU process: where the canvas fill lands (a software rasteriser headless - the pessimistic case)
  let gpuPid = null; for (const e of evs) if (e.ph === 'M' && e.name === 'process_name' && e.args && /GPU/i.test(e.args.name || '')) gpuPid = e.pid;
  const gpu = { outer: 0, inner: 0 }; for (const e of evs) { if (e.ph !== 'X' || e.pid !== gpuPid) continue; const t = (e.tdur != null ? e.tdur : e.dur) / 1000; if (e.name === 'ThreadControllerImpl::RunTask') gpu.outer += t; else if (e.name === 'RunTask') gpu.inner += t; }
  const fr = Math.max(1, commits);
  return { gpu: +(Math.max(gpu.outer, gpu.inner) / fr).toFixed(2), frames: commits, script: +((td.FunctionCall || 0) / fr).toFixed(2), canvasFlush: +((td['RasterImplementation::RasterCHROMIUM'] || 0) / fr).toFixed(2), mainThread: +((td.RunTask || 0) / fr).toFixed(2) };
}

// origin's backing stores, from its render-scale rule min(phone ? 1 : 2, max(1, devicePixelRatio x fit)):
//   844x390 DPR 3 touch -> 1 -> 960x560;  1280x720 DPR 2 -> min(2, 2 x 1.2857) = 2 -> 1920x1120
const CASES = [
  // f105df76e v0.30.1532 wide phone view: a phone fills its screen, so the play width follows the aspect
  // (560 x 844/390 = 1212) instead of the fixed 960 - still 1 backing px per CSS px with the switch off
  { tag: '844x390 DPR3 touch', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, origin: [1212, 560], touch: true },
  { tag: '1280x720 DPR2', opts: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }, origin: [1920, 1120], touch: false },
];
const perfOut = [];
try {
  for (const C of CASES) {
    const { ctx, p, cdp } = await boot(C.opts);
    await enterWorld(p, 'forest');
    const s0 = await state(p);
    check(s0.w === C.origin[0] && s0.h === C.origin[1], `${C.tag}: by default (switch off) the backing store is exactly the old one, ${C.origin.join('x')}`, s0);
    // a monster on screen, the world frozen (photo mode) while the switch flips
    const idx = await p.evaluate(() => { let best = -1, bd = 1e9; game.monsters.forEach((m, i) => { if (!m || m.currentHp <= 0 || m.isBoss) return; const sx = m.x - game.camera.x, sy = m.y - game.camera.y; if (sx < 80 || sx > W - 140 || sy < 40 || sy > H - 60) return; const d = Math.abs(sx - W / 2); if (d < bd) { bd = d; best = i; } }); return best; });
    await p.evaluate(() => { togglePhotoMode(true); });
    await frames(p, 6);
    const offCap = await capMon(p, idx, 3);
    const on1 = await setSharp(p, true, C.touch);
    await frames(p, 8);
    const s1 = await state(p);
    check(on1.found && on1.on === true && s1.per >= 1.5, `${C.tag}: Settings > Graphics has a Sharp Display switch, and ON the canvas has >= 1.5 backing px per CSS px`, { on1, off: s0, on: s1 });
    check(on1.found && s1.rect.every((v, i) => Math.abs(v - s0.rect[i]) < 0.5), `${C.tag}: the canvas box on the page does not move when it flips (the DOM HUD lines up)`, { off: s0.rect, on: s1.rect });
    const onCap = await capMon(p, idx, 3);
    await p.evaluate(() => { togglePhotoMode(false); });
    const last = (c) => c.boxes[c.boxes.length - 1];
    const dMax = (offCap.boxes.length && onCap.boxes.length) ? Math.max(...last(offCap).map((v, i) => Math.abs(v - last(onCap)[i]))) : null;
    const dCam = Math.max(...offCap.cam.map((v, i) => Math.abs(v - onCap.cam[i])));
    check(idx >= 0 && s1.per >= 1.5 && dMax != null && dMax <= 1 && dCam <= 1, `${C.tag}: a monster lands on the same screen rect with Sharp Display ON as OFF (camera mapping and drawn sprite, <= 1 CSS px)`, { idx, dMax, dCam, off: offCap, on: onCap, per: s1.per });

    // a click / tap on an NPC in town, switch ON
    await enterWorld(p, 'town');
    const npcPt = await p.evaluate(() => { const cv = document.getElementById('game'), R = cv.getBoundingClientRect(), k = R.width / W;
      for (const n of game.npcs) { const feet = n.y + 44, top = feet - _lxNpcDrawnH(n); const x = R.left + (n.x - game.camera.x) * k, y = R.top + ((top + feet) / 2 - game.camera.y) * k;
        if (x < R.left + 20 || x > R.right - 20 || y < R.top + 20 || y > R.bottom - 20) continue; if (document.elementFromPoint(x, y) !== cv) continue; return { x, y, name: n.name }; } return null; });
    if (npcPt) { if (C.touch) await p.touchscreen.tap(npcPt.x, npcPt.y); else await p.mouse.click(npcPt.x, npcPt.y); await p.waitForTimeout(700); }
    const talk = await p.evaluate(() => { const d = document.getElementById('dialog'); const open = !!(d && d.style.display === 'block'); const who = game._activeNpc && game._activeNpc.name; try { closeDialog(); } catch (e) {} try { closeAllModals(); } catch (e) {} game.paused = false; return { open, who }; });
    const sT = await state(p);
    check(sT.per >= 1.5 && !!npcPt && talk.open && talk.who === npcPt.name, `${C.tag}: with Sharp Display ON a ${C.touch ? 'tap' : 'click'} on an NPC opens that NPC`, { npcPt, talk, per: sT.per });
    if (C.touch) {   // the deck: a finger on Jump
      await frames(p, 6);
      const jb = await p.evaluate(() => { const b = document.querySelector('#mobile-deck .mc-jump') || document.querySelector('.mc-jump'); if (!b) return null; const r = b.getBoundingClientRect(); window.__jy0 = player.y; window.__jmin = player.y; window.__jw = setInterval(() => { window.__jmin = Math.min(window.__jmin, player.y); }, 16); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b || b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; });
      if (jb) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(jb.x), y: Math.round(jb.y) }] }); await p.waitForTimeout(220); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
      await p.evaluate(() => new Promise((res) => { const g0 = game.time | 0, t0 = performance.now(); const f = () => { if ((game.time | 0) - g0 >= 20 || performance.now() - t0 > 10000) res(); else setTimeout(f, 50); }; f(); }));
      const jr = await p.evaluate(() => { clearInterval(window.__jw); return { y0: window.__jy0, min: window.__jmin }; });
      check(!!jb && jb.hit && jr.min < jr.y0 - 8 && (await state(p)).per >= 1.5, `${C.tag}: with Sharp Display ON a tap on the deck's Jump button jumps`, { jb, jr });
    }
    // photo mode's screenshot is the whole frame at the sharp size
    await p.evaluate(() => { togglePhotoMode(true); }); await frames(p, 4);
    let shot = null, sP = null; try { const [dl, st] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.evaluate(() => { const cv = document.getElementById('game'); _lxPhotoSave(); return { w: cv.width, h: cv.height, per: +(cv.width / cv.getBoundingClientRect().width).toFixed(3) }; })]); sP = st; shot = pngSize(readFileSync(await dl.path())); } catch (e) { shot = String(e).slice(0, 120); }
    await p.evaluate(() => { togglePhotoMode(false); });
    sP = sP || await state(p);
    check(sP.per >= 1.5 && Array.isArray(shot) && shot[0] === sP.w && shot[1] === sP.h, `${C.tag}: with Sharp Display ON a photo-mode screenshot is the whole frame at the sharp size`, { shot, backing: [sP.w, sP.h] });
    // it persists
    await p.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
    await enterWorld(p, 'town');
    const s2 = await state(p);
    const shown = await p.evaluate(() => { openSettingsModal(); const e = document.getElementById('set-sharp'); const on = e ? e.classList.contains('on') : null; try { closeSettingsModal(); } catch (x) {} return on; });
    check(s2.sharp === true && s2.per >= 1.5 && shown === true, `${C.tag}: Sharp Display survives a reload (store stays sharp, the switch shows ON)`, { s2, shown });
    // and OFF again is the old store exactly
    const off2 = await setSharp(p, false, C.touch);
    const s3 = await state(p);
    check(off2.found && off2.on === false && s3.w === C.origin[0] && s3.h === C.origin[1] && s3.rect.every((v, i) => Math.abs(v - s2.rect[i]) < 0.5), `${C.tag}: switched OFF again, the backing store is the old ${C.origin.join('x')} and the box has not moved`, { off2, s3 });

    if (process.env.PERF === '1') {   // busy forest: 30 more mobs, hits landing; alternate OFF / ON four times inside one warm session
      await enterWorld(p, 'forest');
      await p.evaluate(() => {
        const types = [...new Set(game.monsters.filter((m) => m && !m.isBoss).map((m) => m.type))];
        for (let i = 0; i < 30; i++) try { spawnMonster(player.x - 300 + (i % 10) * 70, player.y - 40, types[i % types.length]); } catch (e) {}
        setInterval(() => { const live = game.monsters.filter((m) => m && m.currentHp > 0 && !m.isBoss); const m = live[(Math.random() * live.length) | 0]; if (!m) return; if (!(m.maxHp >= 1e6)) m.maxHp = 1e6; m.currentHp = Math.max(m.currentHp || 0, 5e5); m.evasion = 0;   /* forest mobs have ~50-95 HP: without this every hit is a kill and the crowd thins to the respawn floor */ try { hitMonster(m, 100 + ((Math.random() * 900) | 0), Math.random() < 0.3, 'phys'); } catch (e) {} }, 140);
      });
      const flip = (on) => p.evaluate((on) => { const s = _lxGetSettings(); s.sharp = on; _lxSaveSettings(s); _applySettings(s); return +_LX_DPR.toFixed(3); }, on);
      const rows = [];
      await p.waitForTimeout(5000);   // warm: the map load and the first bakes are not the scene
      for (const on of [false, true, false, true, false, true, false, true]) { const dpr = await flip(on); await p.waitForTimeout(4000); const r = await perfWindow(p, cdp, 5); rows.push({ on, dpr, mons: await p.evaluate(() => game.monsters.length), ...r }); }
      perfOut.push({ tag: C.tag, rows });
    }
    await ctx.close();
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} finally {
  await browser.close(); srv.kill();
}
for (const o of perfOut) { console.log(`PERF ${o.tag} (thread-clock ms per main frame):`); for (const r of o.rows) console.log(`  sharp ${r.on ? 'ON ' : 'OFF'} scale ${r.dpr}  mobs ${r.mons}  frames ${r.frames}  script ${r.script}  canvas flush ${r.canvasFlush}  main thread ${r.mainThread}  GPU process ${r.gpu}`);
  const med = (on, k) => { const v = o.rows.filter((r) => r.on === on).map((r) => r[k]).sort((a, b) => a - b); return v.length ? +(v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2).toFixed(2) : null; };
  console.log(`  MEDIAN  OFF: script ${med(false, 'script')}  flush ${med(false, 'canvasFlush')}  main ${med(false, 'mainThread')}  GPU ${med(false, 'gpu')}   ON: script ${med(true, 'script')}  flush ${med(true, 'canvasFlush')}  main ${med(true, 'mainThread')}  GPU ${med(true, 'gpu')}`); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
