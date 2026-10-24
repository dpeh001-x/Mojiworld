// A co-op guest draws the SAME ward dome as the host (fix-guest-dome-ref).
//   node scripts/coop_guest_dome_test.mjs      (PORT=<port>: the relay + game port; MOJI_GAME_FILE=<build.html> for a private build; ARENAS=zod_virgo,confusedVigil)
// A boss's dome is one constant box taken from his idle frame 0 (boss_ward_constant_test). On a guest the mirror reached that frame at other moments than the host's boss, so the side without it
// drew the live pose measure: Virgo (she hovers, her idle frame 0 rarely comes) read 334 on the host and 339 on the guest, Barnaby (never stands still) 243 against 224, in a real fight with
// a real relay (mp/server.mjs, spawned here) and two real Chrome pages. The host now sends the box it draws (key wr, only while a boss is warded or shattering); a mirror draws that.
//   1. the host holds a reference the guest does not (its own measure is switched off): the guest's dome is the host's size and place
//   2. the host holds none yet (the live pose box, which moves with every frame): the guest follows the host's box, it never draws a box the host did not
//   3. an older host sends no wr: the guest keeps measuring its own, as before
//   4. the key rides only the warded frames of a boss: an idle boss's frame is byte-for-byte what it was
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15996);
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const ARENAS = (process.env.ARENAS || 'zod_virgo,confusedVigil').split(',');
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, WS = `ws://localhost:${PORT}`;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const until = async (p, fn, arg, ms = 8000) => { const t0 = Date.now(); for (;;) { let r; try { r = await p.evaluate(fn, arg); } catch (e) { r = null; } if (r || Date.now() - t0 > ms) return r; await sleep(150); } };
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: path.join(ROOT, 'mp'), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay did not start')), 15000); relay.stdout.on('data', (d) => { if (String(d).includes('MP relay')) { clearTimeout(t); res(); } }); relay.on('exit', (c) => { clearTimeout(t); rej(new Error('relay exited ' + c)); }); });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
async function boot(name, cls, lv) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  const page = await ctx.newPage(); page._errors = []; page.on('pageerror', (e) => page._errors.push(String(e.message).slice(0, 200)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function' && typeof mpConnect === 'function', null, { timeout: 240000 });
  await ev(page, async ({ nm, cls, lv }) => { const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    applyClass(cls); player._tutorialSeen = true; player._gravitosCineSeen = true; if (player.look) player.look.name = nm;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sl(1500); try { devSetLevel(lv); } catch (e) { player.level = lv; }
    await sl(600); player.hp = getMaxHp(); player.mp = getMaxMp();
    try { closeAllModals(); } catch (e) {} loadMap('forest'); await sl(2500); try { closeAllModals(); } catch (e) {}
    try { const tm = document.getElementById('tutorial-modal'); if (tm && getComputedStyle(tm).display !== 'none') _closeTutorial(true); } catch (e) {} game.paused = false;
  }, { nm: name, cls, lv });
  return page;
}
// in the page: the dome box AS DRAWN (the call _drawBossWardShield makes), the host's own measure switched off on request, and the wr key seen on incoming frames
const hook = (p) => ev(p, () => {
  window.__dm = []; window.__wrSeen = 0; window.__noMeasure = false;
  const sh = window._drawBossWardShield, wb = window._lxWardBox; let inDraw = false;
  window._lxWardBox = function (m, sx, sy) { const r = wb.apply(this, arguments); if (inDraw && m.isBoss) window.__dm.push([game.time | 0, +r.size.toFixed(1), +(r.cx - (sx + (m.w || 0) / 2)).toFixed(1), +(r.cy - (sy + (m.h || 0))).toFixed(1)]); return r; };
  window._drawBossWardShield = function (m, sx, sy) { inDraw = true; try { return sh.apply(this, arguments); } finally { inDraw = false; } };
  const ru = window._lxWardRefUpdate; window._lxWardRefUpdate = function () { if (window.__noMeasure) return; return ru.apply(this, arguments); };
  const ca = window._coopApplyMonsters;
  window._coopApplyMonsters = function (msg) {
    try { for (const e of (msg && msg.list) || []) { const x = Array.isArray(e) ? e[7] : e; if (x && typeof x === 'object' && x.wr) window.__wrSeen++; } } catch (er) {}
    return ca.apply(this, arguments);
  };
});
const boss = (p) => ev(p, () => { const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); return m ? { mir: !!m._coopMirror, key: m._phaseSprite || m.type, ward: ((m._wardUntil | 0) > (game.time | 0)) } : null; });
const stand = (p, s) => ev(p, (side) => { const b = game.monsters.find((m) => m && m.isBoss && m.currentHp > 0); if (!b) return; player._god = true; game.paused = false; player.x = side * 200 + b.x + b.w / 2 - 14; player.vx = 0; }, s);
// run a scenario for ms of wall time with both players beside the boss; returns the boxes each side drew
async function run(H, G, ms) {
  for (const p of [H, G]) await ev(p, () => { window.__dm = []; window.__wrSeen = 0; });
  const t0 = Date.now(); while (Date.now() - t0 < ms) { await stand(H, -1); await stand(G, 1); await sleep(250); }
  return { h: await ev(H, () => window.__dm), g: await ev(G, () => window.__dm), wr: await ev(G, () => window.__wrSeen) };
}
const ward = (p, steps) => ev(p, (n) => { const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); if (!m) return; m._wardLen = n; m._wardUntil = (game.time | 0) + n; m._wardNextAt = (game.time | 0) + 1e9; m._wardGauge = 0; m._sovShielded = false; }, steps);
const unward = (p) => ev(p, () => { const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); if (!m) return; m._wardUntil = 0; m._wardBreakUntil = 0; });
const near = (a, b, d = 1) => Math.abs(a - b) <= d;
let A = null, B = null;
try {
  A = await boot('Alpha', 'warrior', 99);
  B = await boot('Beta', 'mage', 99);
  await ev(A, (u) => mpConnect(u, 'Alpha', 'DOMETEST'), WS); await until(A, () => net.connected && net.myId != null, null, 15000);
  await ev(B, (u) => mpConnect(u, 'Beta', 'DOMETEST'), WS); await until(B, () => net.connected && net.myId != null, null, 15000);
  await sleep(800);
  const H = (await ev(A, () => !!net.isHost)) ? A : B, G = H === A ? B : A;
  ok('setup: one host and one guest', (await ev(H, () => net.isHost)) === true && (await ev(G, () => net.isHost)) === false);
  for (const ARENA of ARENAS) {
    for (const p of [H, G]) await ev(p, (a) => { try { closeAllModals(); } catch (e) {} player.hp = getMaxHp(); loadMap(a); }, ARENA);
    const bs = await until(H, () => game.monsters.some((q) => q && q.isBoss && q.currentHp > 0), null, 20000);
    await until(G, () => game.monsters.some((q) => q && q.isBoss && q.currentHp > 0 && q._coopMirror), null, 20000);
    await sleep(2500);
    for (const p of [H, G]) await hook(p);
    const bh = await boss(H), bg = await boss(G);
    ok(ARENA + ': a host boss and a guest mirror of it', !!bs && !!bh && !!bg && bh.mir === false && bg.mir === true && bh.key === bg.key, { bh, bg });
    // ---- 1. the host holds a reference, the guest has none and measures none
    for (const p of [H, G]) await ev(p, () => { window.__noMeasure = true; });
    await ev(H, () => { const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); m._lxWardRef = { key: m._phaseSprite || m.type, size: 301, ox: 6, oy: -111 }; });
    await ev(G, () => { const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); delete m._lxWardRef; delete m._lxWardNet; });
    await ward(H, 240);
    const r1 = await run(H, G, 3200);
    const hs1 = r1.h.map((r) => r[1]), gs1 = r1.g.map((r) => r[1]);
    ok(ARENA + ' 1: the host draws its reference (301) and the guest draws the dome too', r1.h.length >= 20 && r1.g.length >= 20 && hs1.every((v) => near(v, 301)), { h: r1.h.length, g: r1.g.length, hs: [...new Set(hs1)] });
    ok(ARENA + ' 1: the guest\'s dome is the host\'s size, one constant size (it drew its live pose measure: 224 / 334 / 449)', r1.g.length >= 20 && gs1.every((v) => near(v, 301)), { gs: [...new Set(gs1)] });
    const hox = new Set(r1.h.map((r) => Math.round(r[2]))), hoy = new Set(r1.h.map((r) => Math.round(r[3])));
    ok(ARENA + ' 1: ...and in the host\'s place (the same offset from his feet)', r1.g.length >= 20 && r1.g.every((r) => [...hox].some((x) => near(r[2], x)) && [...hoy].some((y) => near(r[3], y))), { hox: [...hox], hoy: [...hoy], gox: [...new Set(r1.g.map((r) => Math.round(r[2])))], goy: [...new Set(r1.g.map((r) => Math.round(r[3])))] });
    ok(ARENA + ' 1: the wr key rode the warded frames', r1.wr >= 5, r1.wr);
    // ---- 2. the host holds no reference yet: the live pose box, which moves with the frame
    await unward(H); await sleep(500);
    await ev(H, () => { const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); delete m._lxWardRef; delete m._lxWardOut; });
    await ev(G, () => { const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); delete m._lxWardRef; delete m._lxWardNet; });
    await ward(H, 300);
    const r2 = await run(H, G, 4200);
    const hset = r2.h.map((r) => r[1]);
    const late = r2.g.filter((r) => r[0] > ((r2.g[0] || [0])[0] + 12));
    ok(ARENA + ' 2: the host draws its live pose box (no reference)', r2.h.length >= 20 && r2.g.length >= 20, { h: r2.h.length, g: r2.g.length });
    ok(ARENA + ' 2: the guest never draws a size the host did not (its own pose measure differed)', late.length >= 15 && late.every((r) => hset.some((v) => near(v, r[1]))), { host: [...new Set(hset.map((v) => Math.round(v)))], guest: [...new Set(late.map((r) => Math.round(r[1])))] });
    // ---- 3. an older host sends no wr: the guest measures its own dome, as before
    await unward(H); await sleep(2500);   // the held box expires (90 steps)
    await ev(H, () => { window.__oldNetOf = window._lxWardNetOf; window._lxWardNetOf = () => null; });
    await ev(G, () => { window.__noMeasure = true; const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); delete m._lxWardNet; m._lxWardRef = { key: m._phaseSprite || m.type, size: 222, ox: 3, oy: -80 }; });
    await ward(H, 240);
    const r3 = await run(H, G, 3000);
    ok(ARENA + ' 3: no wr from the host -> the guest draws its own box (222), nothing held over', r3.g.length >= 15 && r3.g.every((r) => near(r[1], 222)) && r3.wr === 0, { gs: [...new Set(r3.g.map((r) => Math.round(r[1])))], wr: r3.wr });
    await ev(H, () => { window._lxWardNetOf = window.__oldNetOf; });
    // ---- 4. the key rides only a warded boss
    await unward(H); await sleep(900);
    const quiet = await ev(H, () => { const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); return { idle: typeof _lxWardNetOf === 'function' ? _lxWardNetOf(m) : 'missing' }; });
    await ward(H, 120); await sleep(300);
    const warded = await ev(H, () => { const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); return { w: typeof _lxWardNetOf === 'function' ? _lxWardNetOf(m) : null }; });
    ok(ARENA + ' 4: an unwarded boss sends no wr (its frame is what it was); a warded one sends [size, ox, oy]', quiet.idle === null && Array.isArray(warded.w) && warded.w.length === 3 && warded.w.every((v) => Number.isFinite(v)), { quiet, warded });
    await unward(H);
    for (const p of [H, G]) await ev(p, () => { window.__noMeasure = false; });
  }
  const errs = [...A._errors, ...B._errors];
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 700)); }
finally { try { await browser.close(); } catch (e) {} try { relay.kill(); } catch (e) {} }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
