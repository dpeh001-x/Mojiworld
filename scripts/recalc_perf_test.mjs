// Style recalc in a crowded fight (v0.30.x recalc-perf). One run, two builds, measured the same way:
//   node scripts/recalc_perf_test.mjs      (MOJI_GAME_FILE=<build.html> = the build under test; LX_BASE_FILE=<build.html> = the
//                                           baseline: default origin/main, or - once this fix is on origin - the build before it)
// Perf audit #5: in a 60-mob fight most style recalcs were FORCED in the middle of the frame's script. The biggest one of
// our own was the combo counter's pop: a style + layout flush on every frame that landed a hit. (The whole-document :has()
// cost went in v0.30.1217 / 1221 / 1229.)
// Judged by counts and thread time from a Chrome trace, never by fps: both builds run side by side and are traced in the
// same windows, so machine load lands on both alike. Then the things the fix touches must look and behave as before.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11480';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const ROUNDS = Number(process.env.ROUNDS || 3), SECS = Number(process.env.SECS || 4);
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 26 }).toString('utf8');
// the baseline is served from memory (a route), never written into the repo
const FIX_MARK = 'function _lxComboPopReplay(';
let BASE = '', baseFrom = '';
if (process.env.LX_BASE_FILE) { BASE = readFileSync(path.resolve(ROOT, process.env.LX_BASE_FILE), 'utf8'); baseFrom = process.env.LX_BASE_FILE; }
else {
  BASE = git('show', 'origin/main:mojiworld_game.html'); baseFrom = 'origin/main';
  if (BASE.includes(FIX_MARK)) {   // the commit that shipped it: the oldest one whose message names the tag
    const sha = git('log', '--format=%H', '--grep=recalc-perf', 'origin/main').trim().split(/\s+/).pop();
    if (sha) { BASE = git('show', sha + '~1:mojiworld_game.html'); baseFrom = sha.slice(0, 10) + '~1'; }
  }
}
const BASE_NAME = '_recalc_perf_base.html';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const boot = async (name, html) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  if (html) await p.route((u) => u.pathname === '/' + name, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${name}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function' && typeof spawnMonster === 'function' && typeof bumpCombo === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0; game.paused = false;
  });
  return { ctx, p, errs, name, cdp: await ctx.newCDPSession(p) };
};
// frames, with a wall-clock guard (a stalled sim must not hang the run)
const frames = (b, n, capMs = 30000) => b.p.evaluate(async ([n, capMs]) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < capMs) await new Promise((r) => setTimeout(r, 30)); return (game.time | 0) - g0; }, [n, capMs]);
// THE CROWD: 60 mobs round the hero, two hits a game frame (the combo climbs), a toast every 40 frames, one mob in four
// chatting, HP and MP moving now and then. Identical and deterministic on both builds.
const startScene = (b) => b.p.evaluate(() => {
  const types = ['mushroom', 'slime', 'snail', 'orange', 'stump'].filter((t) => monsterTypes[t]);
  game.monsters.length = 0;
  for (let i = 0; i < 60; i++) { try { spawnMonster(player.x + ((i % 15) - 7) * 70, player.y - 40, types[i % types.length]); } catch (e) {} }
  let last = game.time | 0, tn = 0, hitI = 0;
  const lines = ['bounce!', 'squish~', 'spore~', 'noted.', 'creak'];
  const step = () => {
    const t = game.time | 0;
    if (window.__sceneRun) for (let f = last; f < t; f++) {
      const ms = game.monsters.filter((m) => m && m.currentHp > 0 && !m.isBoss);
      for (const m of ms) { if (m.currentHp < m.maxHp * 0.6) m.currentHp = m.maxHp; if (Math.abs(m.x - player.x) > 600) m.x = player.x + ((hitI % 17) - 8) * 55; }
      for (let k = 0; k < 2 && ms.length; k++) { const m = ms[(hitI++) % ms.length]; try { hitMonster(m, 5 + (hitI % 7), hitI % 5 === 0, 'phys'); } catch (e) {} }
      if (f % 40 === 0) { tn++; showToast('Crowd probe ' + tn, ['common', 'rare', 'epic', 'success'][tn % 4]); }
      if (f % 10 === 0) for (let j = 0; j < ms.length; j += 4) { const m = ms[j]; if (!m._chat) m._chat = { text: lines[j % 5], life: 2200, maxLife: 2200 }; }
      if (f % 120 === 0) player.hp = Math.max(1, player.maxHp * (0.55 + 0.4 * ((f / 120) % 5) / 5));   // the hero is invulnerable: the HUD still moves now and then
      if (f % 90 === 0) player.mp = Math.max(0, (player.mp || 0) - 2);
    }
    last = t; requestAnimationFrame(step);
  };
  window.__sceneRun = true; requestAnimationFrame(step);
  return game.monsters.filter((m) => m && m.currentHp > 0).length;
});
// One traced window with BOTH pages running side by side, so whatever else loads the machine loads both alike. The trace is
// browser-wide; each page's renderer main thread is found by its own console.timeStamp mark. A recalc nested inside a
// script event was forced by that script; the rest are the frame's own. Thread time (tdur), not wall time.
const traceAll = async (builds) => {
  const lead = builds[0], evs = []; const onData = (d) => { for (const e of d.value) evs.push(e); };
  lead.cdp.on('Tracing.dataCollected', onData);
  const g0 = []; for (const b of builds) g0.push(await b.p.evaluate(() => game.time | 0));
  await lead.cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel', 'blink', 'v8.execute'] } });
  await lead.p.waitForTimeout(SECS * 1000);
  const marks = builds.map((b, i) => 'lxrp-' + i + '-' + Date.now());
  for (let i = 0; i < builds.length; i++) await builds[i].p.evaluate((m) => { for (let k = 0; k < 3; k++) console.timeStamp(m); }, marks[i]);
  const done = new Promise((r) => lead.cdp.once('Tracing.tracingComplete', r));
  await lead.cdp.send('Tracing.end'); await done; lead.cdp.off('Tracing.dataCollected', onData);
  const out = [];
  for (let i = 0; i < builds.length; i++) {
    const g1 = await builds[i].p.evaluate(() => game.time | 0);
    const me = evs.find((e) => e.name === 'TimeStamp' && e.args && e.args.data && e.args.data.message === marks[i]);
    const R = { found: !!me, frames: 0, gameFrames: g1 - g0[i], recalc: 0, recalcMs: 0, forced: 0, forcedMs: 0, layForced: 0 };
    out.push(R); if (!me) continue;
    const M = evs.filter((e) => e.pid === me.pid && e.tid === me.tid && e.ph === 'X');
    const js = M.filter((e) => ['FunctionCall', 'FireAnimationFrame', 'TimerFire', 'EventDispatch', 'EvaluateScript', 'v8.callFunction'].includes(e.name)).map((e) => [e.ts, e.ts + e.dur]);
    const inJs = (e) => js.some(([a, z]) => e.ts >= a && e.ts < z);
    for (const e of M) {
      if (e.name === 'Commit') R.frames++;
      else if (e.name === 'UpdateLayoutTree') { const ms = (e.tdur != null ? e.tdur : e.dur) / 1000; R.recalc++; R.recalcMs += ms; if (inJs(e)) { R.forced++; R.forcedMs += ms; } }
      else if (e.name === 'Layout' && inJs(e)) R.layForced++;
    }
  }
  return out;
};
try {
  const T = await boot(FILE, null), B = await boot(BASE_NAME, BASE);
  const builds = [B, T];
  for (const b of builds) b.mobs = await startScene(b);
  await Promise.all(builds.map((b) => frames(b, 240, 40000)));   // the spawned mobs' art streams in, the combo climbs
  const sum = new Map(builds.map((b) => [b, { lost: 0, frames: 0, gameFrames: 0, recalc: 0, recalcMs: 0, forced: 0, forcedMs: 0, layForced: 0 }]));
  for (let r = 0; r < ROUNDS; r++) {
    const Rs = await traceAll(builds);
    builds.forEach((b, i) => { const R = Rs[i], S = sum.get(b); if (!R.found) { S.lost++; return; } for (const k of ['frames', 'gameFrames', 'recalc', 'recalcMs', 'forced', 'forcedMs', 'layForced']) S[k] += R[k]; });
    const f = (R) => [+(R.recalc / Math.max(1, R.frames)).toFixed(2), +(R.recalcMs / Math.max(1, R.frames)).toFixed(2)];
    console.log(`  window ${r + 1}: recalcs / recalc ms per frame  before ${JSON.stringify(f(Rs[0]))} (${Rs[0].frames} frames)  after ${JSON.stringify(f(Rs[1]))} (${Rs[1].frames} frames)`);
  }
  const rep = (b) => { const S = sum.get(b), f = Math.max(1, S.frames), g = Math.max(1, S.gameFrames);
    return { mobs: b.mobs, frames: S.frames, gameFrames: S.gameFrames, recalcPerFrame: +(S.recalc / f).toFixed(2), recalcMsPerFrame: +(S.recalcMs / f).toFixed(3),
      forcedRecalcPerFrame: +(S.forced / f).toFixed(2), forcedLayoutPerFrame: +(S.layForced / f).toFixed(2), recalcPer100GameFrames: +(S.recalc * 100 / g).toFixed(1), recalcMsPer100GameFrames: +(S.recalcMs * 100 / g).toFixed(1) }; };
  const b0 = rep(B), t0 = rep(T);
  console.log('BEFORE (' + baseFrom + '): ' + JSON.stringify(b0));
  console.log('AFTER  (' + FILE + '): ' + JSON.stringify(t0));
  const cut = (a, z) => (a > 0 ? 1 - z / a : 0), dN = cut(b0.recalcPerFrame, t0.recalcPerFrame), dMs = cut(b0.recalcMsPerFrame, t0.recalcMsPerFrame);
  console.log(`style recalcs per frame: ${(dN * 100).toFixed(0)}% fewer; style recalc time per frame: ${(dMs * 100).toFixed(0)}% less`);
  check(b0.mobs >= 55 && t0.mobs >= 55 && b0.frames >= 15 && t0.frames >= 15, 'the crowd is up (60 mobs) and both builds were traced long enough to judge', { b0, t0, lost: [sum.get(B).lost, sum.get(T).lost] });
  check(!BASE.includes(FIX_MARK), 'the baseline is a build from before this fix', baseFrom);
  check(dN >= 0.30 || dMs >= 0.30, 'a crowded fight costs >= 30% fewer style recalcs, or >= 30% less recalc time, per frame than the baseline', { fewer: +dN.toFixed(3), less: +dMs.toFixed(3) });

  // ---- no visual change (the build under test) --------------------------------------------------------------------
  const p = T.p;
  // mob chat: bubbles over their mobs, following them (the scene keeps one mob in four chatting)
  const chat = await p.evaluate(async () => {
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const od = window._drawMobChat, ob = window._drawBubble; let cur = null; const rows = [];
    window._drawMobChat = function (m) { cur = m; try { return od.apply(this, arguments); } finally { cur = null; } };
    window._drawBubble = function (cx, topY, text) { if (cur) rows.push({ id: game.monsters.indexOf(cur), cx, topY, text, want: cur.x + cur.w / 2 - game.camera.x, wantY: cur.y - 4, said: cur._chat && cur._chat.text }); return ob.apply(this, arguments); };
    const g0 = game.time | 0, t0 = performance.now(); let nudged = false;
    while ((game.time | 0) - g0 < 40 && performance.now() - t0 < 15000) { await raf(); if (!nudged && (game.time | 0) - g0 >= 20) { nudged = true; for (const m of game.monsters) if (m && m._chat) m.x += 25; } }   // every chatting mob steps 25 px
    window._drawMobChat = od; window._drawBubble = ob;
    const by = new Map(); for (const r of rows) { if (!by.has(r.id)) by.set(r.id, new Set()); by.get(r.id).add(Math.round(r.want)); }
    return { bubbles: rows.length, mobs: by.size, frames: (game.time | 0) - g0, off: rows.filter((r) => Math.abs(r.cx - r.want) > 0.01 || Math.abs(r.topY - r.wantY) > 0.01 || r.text !== r.said).length, followedMoves: [...by.values()].filter((xs) => xs.size > 1).length };
  });
  check(chat.bubbles > 0 && chat.mobs >= 4 && chat.off === 0 && chat.followedMoves >= 1, 'mob chat bubbles appear over their mobs and follow them as they move', chat);
  await p.evaluate(() => { window.__sceneRun = false; });   // the hits stop; the HUD settles
  await frames(T, 4, 10000);
  // HUD numbers: the combo counter and the HP / MP readouts match the hero (polled a few frames: regen may tick in between)
  const hud = await p.evaluate(async () => {
    const q = (id) => document.getElementById(id); let r = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((s) => requestAnimationFrame(s));
      const hpPct = Math.max(0, Math.min(100, player.hp / getMaxHp() * 100)), mpPct = Math.max(0, Math.min(100, player.mp / getMaxMp() * 100));
      r = { combo: game.combo, comboText: q('combo-count').textContent,
        hpText: q('hp-text').textContent, hpWant: _FMT_BIG(Math.max(0, Math.ceil(player.hp))) + ' / ' + _FMT_BIG(getMaxHp()),
        hpW: parseFloat(q('hp-bar').style.width), hpPct: +hpPct.toFixed(2), mpW: parseFloat(q('mp-bar').style.width), mpPct: +mpPct.toFixed(2) };
      if (r.comboText === String(r.combo) && r.hpText === r.hpWant && Math.abs(r.hpW - r.hpPct) < 0.2 && Math.abs(r.mpW - r.mpPct) < 0.2) break;
    }
    return r;
  });
  check(hud.combo >= 20 && hud.comboText === String(hud.combo), 'the combo counter shows the right number (it climbed through the fight)', hud);
  check(hud.hpText === hud.hpWant && Math.abs(hud.hpW - hud.hpPct) < 0.2 && Math.abs(hud.mpW - hud.mpPct) < 0.2, 'the HUD numbers match the hero: HP text, HP and MP bars', hud);
  // the combo pop restarts on every hit, is the stylesheet's own pop, and a big combo break still flashes with no pop over it
  const pop = await p.evaluate(async () => {
    const el = document.getElementById('combo-meter'), raf = () => new Promise((r) => requestAnimationFrame(r));
    const pops = () => el.getAnimations().filter((a) => a.transitionProperty === undefined && a.animationName !== 'comboBreak');   // CSS comboPop, or its replay
    let n = 0, restarted = 0; const miss = [];
    for (let i = 0; i < 8; i++) {
      await raf(); const T0 = document.timeline.currentTime;
      game._lastComboPopFrame = -1; bumpCombo(1); n++;
      const a = pops(); if (a.some((x) => x.startTime == null || x.startTime >= T0 - 0.5)) restarted++; else miss.push(a.map((x) => [x.playState, x.startTime, T0]));
    }
    game.combo = 15; resetCombo(); await raf();
    game._lastComboPopFrame = -1; bumpCombo(1); await raf();
    const r = { n, restarted, miss: miss.slice(0, 2), breakOn: el.classList.contains('break'), breakAnim: el.getAnimations().some((x) => x.animationName === 'comboBreak' && x.playState === 'running'), popsUnderBreak: pops().filter((x) => x.playState === 'running' || x.pending).length };
    return r;
  });
  check(pop.restarted === pop.n, 'the combo counter pops on every hit (the pop restarts each time)', pop);
  check(pop.breakOn && pop.breakAnim && pop.popsUnderBreak === 0, 'a big combo break still flashes, with no pop over it', pop);
  // the replayed pop is frame-for-frame the stylesheet's: the same keyframes and timing as a fresh CSS comboPop
  const same = await p.evaluate(async () => {
    if (typeof _lxComboPopFx === 'undefined') return { baseline: true };   // a build without the replay pops through CSS only
    await new Promise((s) => setTimeout(s, 600));   // the break flash ends
    const el = document.getElementById('combo-meter'), wa = el._lxPopAnim;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    const nm = getComputedStyle(el).animationName, css = el.getAnimations().find((x) => x.animationName === nm);
    const norm = (kfs) => JSON.stringify(kfs.map((k) => Object.keys(k).filter((q) => q !== 'computedOffset').sort().map((q) => q + '=' + k[q]).join(';')));
    const tm = (a) => { const t = a.effect.getTiming(); return [t.duration, t.delay, t.endDelay, t.iterations, t.direction, t.fill, t.easing].join('|'); };
    return { nm, copied: !!_lxComboPopFx, replay: !!wa, kfSame: !!(css && wa) && norm(css.effect.getKeyframes()) === norm(wa.effect.getKeyframes()), tSame: !!(css && wa) && tm(css) === tm(wa),
      css: css ? norm(css.effect.getKeyframes()) + ' ' + tm(css) : null, wa: wa ? norm(wa.effect.getKeyframes()) + ' ' + tm(wa) : null };
  });
  check(same.baseline || (same.copied && same.replay && same.kfSame && same.tSame), 'the replayed pop has exactly the stylesheet\'s keyframes and timing (no visual change)', same);
  // toasts still dodge an open panel, and go back when it closes
  const dodge = await p.evaluate(async () => {
    const raf = () => new Promise((r) => requestAnimationFrame(r)), host = document.getElementById('toast-container');
    try { closeAllModals(); } catch (e) {} game.paused = false; await raf();
    const m = document.getElementById('inventory-modal'); toggleModal('inventory-modal', () => { try { renderInventory(); } catch (e) {} }); await raf(); await raf();
    showToast('Dodge probe ' + Date.now(), 'rare'); await raf(); await raf();
    const pr = (m.querySelector(':scope > .modal') || m.firstElementChild).getBoundingClientRect(), hr = host.getBoundingClientRect();
    const r = { open: m.style.display, panel: [Math.round(pr.left), Math.round(pr.right)], toasts: [Math.round(hr.left), Math.round(hr.right)], dodged: host.classList.contains('lx-dodge'), dim: host.classList.contains('lx-dodge-dim'),
      overlap: !(hr.right <= pr.left || hr.left >= pr.right || hr.bottom <= pr.top || hr.top >= pr.bottom) };
    try { closeAllModals(); } catch (e) {} game.paused = false; await new Promise((s) => setTimeout(s, 900)); r.stillDodged = host.classList.contains('lx-dodge');
    return r;
  });
  check(dodge.open === 'flex' && dodge.dodged && (!dodge.overlap || dodge.dim) && !dodge.stillDodged, 'toasts still dodge an open panel, and go back when it closes', dodge);
  check(T.errs.length === 0 && B.errs.length === 0, 'no page errors', { after: T.errs.slice(0, 3), before: B.errs.slice(0, 3) });
  for (const b of builds) await b.ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
