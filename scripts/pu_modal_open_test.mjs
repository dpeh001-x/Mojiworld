// The boss boon wheel opens without a hitch and looks exactly as before (v0.30.x pu-modal-open).
//   node scripts/pu_modal_open_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "reducing the lags especially on boss fights while preserving the quality of the sprites and images". The wheel's
// first open cost ~80 ms on a quiet desktop (DPR 2; ~150 ms in a real Tower Arbiter fight): its title fit walked 2 px at a time
// to its 24 px floor (13 forced layouts, each re-shaping at a new size) and every font the wheel uses was built on the spot.
// A real Arbiter kill opens the wheel here, cold, at DPR 2; the rows check the cost, the result and that nothing else changed.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11379';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof showPowerupChoice === 'function' && typeof spawnMonster === 'function', null, { timeout: 150000 });
  // the wheel, watched from its first open: wall time of each call and every write to the title's style
  await p.evaluate(() => {
    window.__pu = { ms: [], titleWrites: [], warm: [] };
    const orig = window.showPowerupChoice;
    window.showPowerupChoice = function (bi) {
      const pm = document.getElementById('powerup-modal'), was = pm && pm.style.display;
      const mo = new MutationObserver((rs) => { for (const r of rs) if (r.target.classList && r.target.classList.contains('pr-title')) window.__pu.titleWrites.push(r.oldValue); });
      mo.observe(pm, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
      const t0 = performance.now(); const r = orig.apply(this, arguments); const dt = performance.now() - t0;
      mo.takeRecords().forEach((x) => { if (x.target.classList && x.target.classList.contains('pr-title')) window.__pu.titleWrites.push(x.oldValue); }); mo.disconnect();
      if (was !== 'flex' && pm.style.display === 'flex') { window.__pu.ms.push(+dt.toFixed(1)); if (!window.__pu.openAt) window.__pu.openAt = Math.round(t0); }
      return r;
    };
    if (typeof window._lxPuWarmPass === 'function') { const w = window._lxPuWarmPass; window._lxPuWarmPass = function (k) { const t = performance.now(); const r = w.apply(this, arguments); window.__pu.warm.push([k, Math.round(t), +(performance.now() - t).toFixed(1)]); return r; }; }
  });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 120;
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; player.boons = []; player.boonsEquipped = [];
    player.invulnerable = 999999; player.hp = player.maxHp = 999999;
    loadMap('tower_b5'); game.paused = false;
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    const clear = () => { for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o && o.classList.contains('on')) o.classList.remove('on'); } for (const id of ['boss-intro-skip', 'grav-entry-skip']) { const b = document.getElementById(id); if (b && b.offsetParent) b.click(); } if (document.getElementById('powerup-modal').style.display !== 'flex') game.paused = false; };
    window.__clear = clear;
    for (let i = 0; i < 100; i++) { await sleep(100); clear(); const fe = document.getElementById('map-fade-overlay'); if (i > 20 && !(fe && fe.classList.contains('on'))) break; }
    document.getElementById('everdawn-welcome-overlay')?.remove();
  });
  // fight: an Arbiter beside the hero, real AI, frames running; then the kill (he revives once) opens the wheel for real
  const fight = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    game.monsters = game.monsters.filter((m) => !(m && (m.isBoss || m.boss)));
    const m = spawnMonster((game.mapData.worldWidth || 1400) * 0.5, (game.mapData.worldHeight || 600) - 260, 'towerArbiter', true, false);
    if (!m) return { err: 'no spawn' };
    const g0 = game.time | 0, t0 = performance.now();
    while ((game.time | 0) - g0 < 240 && performance.now() - t0 < 40000) { await sleep(100); __clear(); player.x = m.x - 220; if (player.hp < player.maxHp) player.hp = player.maxHp; }
    const isArb = (q) => q && q.type === 'towerArbiter' && q.currentHp > 0;
    for (let k = 0; k < 6 && game.monsters.some(isArb); k++) { const b = game.monsters.find(isArb); b.evasion = 0; b.currentHp = 1; window.__killT = Math.round(performance.now()); try { hitMonster(b, 999999999, false, 'phys'); } catch (e) {} for (let j = 0; j < 30; j++) { await sleep(100); __clear(); if (!game.monsters.some(isArb)) break; } }
    const t1 = performance.now();
    while (document.getElementById('powerup-modal').style.display !== 'flex' && performance.now() - t1 < 30000) { await sleep(100); __clear(); }
    return { frames: (game.time | 0) - g0, open: document.getElementById('powerup-modal').style.display === 'flex', killAt: window.__killT, openAt: window.__pu.openAt, map: game.currentMap };
  });
  const st = await p.evaluate(() => ({ ms: __pu.ms.slice(), writes: __pu.titleWrites.slice(), warm: __pu.warm.slice(), title: (document.querySelector('#powerup-modal .pr-title') || {}).style?.fontSize, cards: document.querySelectorAll('#powerup-modal .powerup-card').length }));
  console.log('fight', JSON.stringify(fight), 'wheel', JSON.stringify(st));
  check(fight.open && st.ms.length === 1 && st.cards === 3, 'a real Arbiter kill opens the wheel (3 cards)', { fight, st });
  check(st.ms.length === 1 && st.ms[0] < 40, 'the first open costs under 40 ms (was ~80 quiet / ~150 in a fight)', st.ms);
  check(st.writes.length >= 1 && st.writes.length <= 2 && st.title === '24px', 'the title is sized once, straight to its 24 px floor (was 13 steps)', { writes: st.writes, title: st.title });
  { const before = st.warm.filter((w) => w[1] < fight.openAt), ks = new Set(before.map((w) => w[0]));
    check(ks.size === 5 && before.some((w) => w[1] >= fight.killAt), 'all 5 font rehearsal passes ran before the wheel opened, the kill one among them', { killAt: fight.killAt, openAt: fight.openAt, warm: st.warm }); }
  await p.evaluate(() => { game._lxBoonOwed = null; game._pendingBossBoon = null; game._lxBoonOwedQ = null; });   // the kill's wheel is done with: nothing re-offers it mid-check
  // the size is the one the old loop picks, for several names (and none), at desktop and phone widths
  const sameAsLoop = async (label) => p.evaluate(async (label) => {
    const out = [];
    for (const [nm, ic] of [['The Arbiter, the Judgmental', '⚖️'], ['Gravitos', '🌌'], ['Aetherion the Unbound Sovereign of the Last Step', '✨'], ['', '']]) {
      try { closeAllModals(); } catch (e) {} game.paused = false; await new Promise((r) => setTimeout(r, 100));
      showPowerupChoice(nm ? { name: nm, icon: ic } : undefined); game._lxBoonOwed = null;
      const tt = document.querySelector('#powerup-modal .pr-title'), got = tt.style.fontSize;
      tt.style.fontSize = ''; let fs = parseFloat(getComputedStyle(tt).fontSize) || 48;   // the old loop, verbatim
      while (tt.scrollWidth > tt.clientWidth + 1 && fs > 24) { fs -= 2; tt.style.fontSize = fs + 'px'; }
      out.push([label, nm || '(none)', got, tt.style.fontSize]);
    }
    return out;
  }, label);
  const rows = [...await sameAsLoop('1280x720')];
  await p.setViewportSize({ width: 700, height: 420 }); await p.waitForTimeout(600);
  rows.push(...await sameAsLoop('700x420'));
  await p.setViewportSize({ width: 1280, height: 720 }); await p.waitForTimeout(600);
  check(rows.length === 8 && rows.every((r) => r[2] === r[3]), 'every title gets the size the old loop gave it (4 names x 2 widths)', rows);
  // the rehearsal leaves no trace: content, display, pause, owed wheel, codex marks, class - and never touches an open wheel
  const inv = await p.evaluate(async () => {
    if (typeof _lxPuWarmPass !== 'function') return { missing: true };
    const pm = document.getElementById('powerup-modal'), body = pm.querySelector('.modal.powerup-reveal');
    const snap = () => JSON.stringify([pm.style.display, pm.className, body.innerHTML.length, body.innerHTML.slice(0, 400), !!game.paused, JSON.stringify(game._lxBoonOwed || null), JSON.stringify((game.boonDex || {}).seen || {}), document.body.className]);
    const a = snap(); for (let k = 0; k < 5; k++) _lxPuWarmPass(k); await new Promise((r) => setTimeout(r, 50)); const b = snap();   // open
    try { closeAllModals(); } catch (e) {} game.paused = false; await new Promise((r) => setTimeout(r, 150));
    const c = snap(); for (let k = 0; k < 5; k++) _lxPuWarmPass(k); await new Promise((r) => setTimeout(r, 150)); const d = snap();   // closed, old content kept
    return { openSame: a === b, closedSame: c === d, c: c.slice(0, 200), d: d.slice(0, 200) };
  });
  check(inv.openSame && inv.closedSame, 'the rehearsal leaves the wheel, the pause, the owed boon and the codex exactly as they were', inv);
  const click = await p.evaluate(async () => {
    showPowerupChoice({ name: 'The Arbiter', icon: '⚖️' }); await new Promise((r) => setTimeout(r, 600));
    const n0 = player.boons.length; document.querySelector('#powerup-modal .powerup-card').click();
    return { added: player.boons.length - n0, closed: document.getElementById('powerup-modal').style.display !== 'flex' };
  });
  check(click.added === 1 && click.closed, 'picking a card still takes the boon and closes the wheel', click);
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} catch (e) { check(false, 'harness', String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
