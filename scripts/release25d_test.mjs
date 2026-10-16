// RELEASE 25d (co-op summons, per user "yes fix the co-op summons too") stays fixed - two real clients in one party on the local relay:
//   [1] Bob (guest) is a Beastmaster and presses F / G / B: Ann (host) draws his wolf, pack and werewolf through drawPet / drawWolf
//       within ~1 s of each summon, near where Bob's own summons stand, facing their travel while they move, with his HP numbers; none of
//       them is in Ann's game.monsters / player.pack / game.minions or referenced by her monsters, and her swings change nothing;
//       Bob walks through a door -> they vanish on Ann; he walks back -> they return; his pack expires -> it vanishes, the rest stays;
//       Bob disconnects -> everything of his vanishes. Frames carrying the list stay small (relay cap 64 KB)
//   [2] the reverse direction: Ann (host) is a Necromancer and presses V / F: Bob draws her undead through drawMinions, near hers, not in
//       his game.minions; they vanish when they crumble
//   node release25d_test.mjs        PORT (relay, also serves the game) / MOJI_GAME_FILE / SERVE_ROOT; ONLY=1,2
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15131), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, WS = `ws://localhost:${PORT}`;
const SHOT = process.env.R25D_SHOT || '';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: path.join(ROOT, 'mp'), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay did not start')), 15000); relay.stdout.on('data', (d) => { if (String(d).includes('MP relay')) { clearTimeout(t); res(); } }); relay.on('exit', (c) => { clearTimeout(t); rej(new Error('relay exited ' + c)); }); });
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
// every page: what it owns (refreshed outside the draw), what it DREW that it does not own (a partner's summons), what it sends
const hooks = () => {
  window.__own = new WeakSet(); window.__ghosts = new WeakSet(); window.__gw = []; window.__gm = []; window.__wolfN = 0; window.__viol = []; window.__sm = { n: 0, max: 0, maxSm: 0, t0: Date.now() };
  const ownNow = () => { for (const o of [player.pet, player.ultPet, ...(player.pack || []), ...(game.minions || []), ...(player._ballistaTurrets || [])]) if (o) window.__own.add(o); };
  const rec = (L) => L.map((o) => [Math.round(o.x), Math.round(o.y), o.facing || 1, +(+o.vx || 0).toFixed(2), Math.round(o.hp != null ? o.hp : o.currentHp), Math.round(o.maxHp), o.sprite || o.type || '']);
  const dp = window.drawPet; window.drawPet = function () { const L = [player.pet, player.ultPet, ...(player.pack || [])].filter((o) => o && !window.__own.has(o));
    if (L.length) { for (const o of L) window.__ghosts.add(o); window.__gw.push({ t: Date.now(), m: game.currentMap, L: rec(L) }); if (window.__gw.length > 600) window.__gw.splice(0, 200); } return dp.apply(this, arguments); };
  const dm = window.drawMinions; window.drawMinions = function () { const L = (game.minions || []).filter((o) => o && !window.__own.has(o));
    if (L.length) { for (const o of L) window.__ghosts.add(o); window.__gm.push({ t: Date.now(), m: game.currentMap, L: rec(L) }); if (window.__gm.length > 600) window.__gm.splice(0, 200); } return dm.apply(this, arguments); };
  const dw = window.drawWolf; window.drawWolf = function (pet) { if (pet && !window.__own.has(pet)) window.__wolfN++; return dw.apply(this, arguments); };
  // outside the draw: nothing of a partner's may sit in my arrays or be referenced by my monsters
  setInterval(() => { try { ownNow(); const G = window.__ghosts;
    for (const o of [player.pet, player.ultPet, ...(player.pack || []), ...(game.minions || []), ...(player._ballistaTurrets || [])]) if (o && G.has(o)) window.__viol.push('mine');
    for (const m of (game.monsters || [])) { if (!m) continue; if (G.has(m)) window.__viol.push('monster'); for (const k in m) { const v = m[k]; if (v && typeof v === 'object' && G.has(v)) window.__viol.push('ref ' + k); } }
    if (window.__viol.length > 50) window.__viol.length = 50; } catch (e) {} }, 60);
  window.__mine = () => { ownNow(); return { at: Date.now(), m: game.currentMap, P: (player.pack || []).length, L: rec([player.pet, player.ultPet, ...(player.pack || [])].filter(Boolean)), M: rec((game.minions || []).filter(Boolean)) }; };
  window.__wireTap = () => { const s0 = net.ws.send; net.ws.send = function (s) { try { if (typeof s === 'string' && s.indexOf('"sm":') >= 0) { const S = window.__sm; S.n++; S.max = Math.max(S.max, s.length); const i = s.indexOf('"sm":'); S.maxSm = Math.max(S.maxSm, s.length - i); } } catch (e) {} return s0.apply(this, arguments); }; };
};
const boot = async (o) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  const v = await page.evaluate(async (o) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (player.cls !== o.cls) { try { applyClass(o.cls); } catch (e) {} player.cls = o.cls; }
    devSetLevel(80); if (o.job) try { applyJob(o.job); } catch (e) {} if (o.master) try { applyMaster(o.master); } catch (e) {}
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
    const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } { const am = document.getElementById('advancement-modal'); if (am) am.style.display = 'none'; } { const tm = document.getElementById('tutorial-modal'); if (tm && (tm.classList.contains('tut-dock') || getComputedStyle(tm).display !== 'none')) try { _closeTutorial(true); } catch (e) {} } game.paused = false; };
    window.__clear = clear; clear();
    return GAME_VERSION;
  }, o);
  await page.evaluate((src) => { (0, eval)('(' + src + ')')(); }, hooks.toString());
  console.log('  build', v, o.cls, o.master || ''); return { ctx, page };
};
const press = async (page, key, hold = 120) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
const party = async (A, B, room, map) => {
  for (const P of [A, B]) await P.evaluate((m) => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[m] = true; loadMap(m, 700); }, map);
  await sleep(1500);
  await A.evaluate(({ ws, room }) => mpConnect(ws, 'Ann', room), { ws: WS, room }); await A.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {});
  await B.evaluate(({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room }); await B.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {});
  await sleep(1200);
  for (const P of [A, B]) await P.evaluate(() => { window.__wireTap(); window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { window.__clear(); player.hitStun = 0; player.stunTimer = 0; player.hp = getMaxHp(); player.mp = player.maxMp = 99999; window._lxLastInputAt = performance.now(); } catch (e) {} }, 80); });
  await sleep(1500);
  return { a: await A.evaluate(() => [net.isHost, Object.keys(net.peers || {}).length]), b: await B.evaluate(() => [net.isHost, Object.keys(net.peers || {}).length]) };
};
// first time (ms, on the shared wall clock) the viewer drew >= n foreign summons in one call, at or after t0
const firstDraw = (V, kind, t0, n, spr) => V.evaluate(({ kind, t0, n, spr }) => { const R = kind === 'm' ? window.__gm : window.__gw; const e = R.find((r) => r.t >= t0 && r.L.length >= n && (!spr || r.L.some((q) => q[6] === spr))); return e ? e.t : null; }, { kind, t0, n, spr });
const waitDraw = async (V, kind, t0, n, spr, ms = 4000) => { const t1 = Date.now(); let t = null; while (!(t = await firstDraw(V, kind, t0, n, spr)) && Date.now() - t1 < ms) await sleep(100); return t; };
const lastDraw = (V, kind) => V.evaluate((kind) => { const R = kind === 'm' ? window.__gm : window.__gw; return R.length ? R[R.length - 1] : null; }, kind);
// owner's live summons vs the viewer's latest ghost draw: each of the owner's summons to the nearest ghost (same art)
const match = (mine, ghost) => { if (!mine || !ghost) return null; const d = [];
  for (const s of mine) { let b = 1e9; for (const g of ghost) if (g[6] === s[6]) b = Math.min(b, Math.hypot(g[0] - s[0], g[1] - s[1])); d.push(Math.round(b)); } return d; };
const goDoor = async (P, dest) => { const x = await P.evaluate((d) => { const p = (game.mapData.portals || []).find((q) => q.dest === d); if (!p) return null; player.x = p.x - player.w / 2; player.vx = 0; return p.x; }, dest);
  if (x == null) return false; for (let i = 0; i < 6; i++) { await press(P, 'ArrowUp', 90); await sleep(700); if (await P.evaluate((d) => game.currentMap === d, dest)) return true; } return false; };
const waitOwn = async (P, pred, ms = 5000) => { const t1 = Date.now(); let s = null; while (Date.now() - t1 < ms) { s = await P.evaluate(() => window.__mine()); if (pred(s)) return s; await sleep(40); } return null; };
const facingOk = (V, kind, t0, t1) => V.evaluate(({ kind, t0, t1 }) => { const R = kind === 'm' ? window.__gm : window.__gw; let n = 0, good = 0;
  for (const r of R) if (r.t >= t0 && r.t <= t1) for (const q of r.L) if (Math.abs(q[3]) > 1) { n++; if (Math.sign(q[3]) === Math.sign(q[2])) good++; } return { n, good }; }, { kind, t0, t1 });
const sampleNear = async (O, V, kind, k = 6) => { const out = [];
  for (let i = 0; i < k; i++) { const m = await O.evaluate(() => window.__mine()); const g = await lastDraw(V, kind); const d = match(kind === 'm' ? m.M : m.L, g && g.L);
    if (d && d.length) out.push(Math.max(...d)); await sleep(250); } return out; };
try {
  // ======== [1] a guest Beastmaster's summons on the host's screen
  if (on('1')) {
    const { ctx: cA, page: A } = await boot({ cls: 'warrior' });
    const { ctx: cB, page: B } = await boot({ cls: 'archer', job: 'ranger', master: 'beastmaster' });
    const roles = await party(A, B, 'r25d' + Math.floor(Math.random() * 1e8), 'forest');
    ok('[1-setup] Ann runs Emerald Thicket, Bob (Beastmaster) follows in her party', roles.a[0] === true && roles.b[0] === false && roles.a[1] === 1 && roles.b[1] === 1, roles);
    await A.evaluate(() => { window.__hitG = 0; const h0 = window.hitMonster; window.hitMonster = function (m) { if (m && window.__ghosts.has(m)) window.__hitG++; return h0.apply(this, arguments); }; });
    const lat = {};
    await press(B, 'f'); const sF = await waitOwn(B, (s) => s.L.length >= 1);
    { const d = sF ? await waitDraw(A, 'w', sF.at - 40, 1) : null; lat.F = d ? d - sF.at : null; }
    await sleep(1100); await press(B, 'g'); const sG = await waitOwn(B, (s) => s.P >= 1);
    { const d = sG ? await waitDraw(A, 'w', sG.at - 40, sG.L.length) : null; lat.G = d ? d - sG.at : null; }
    await sleep(1100); await press(B, 'b'); const sU = await waitOwn(B, (s) => s.L.some((q) => q[6] === 'werewolf'));
    { const d = sU ? await waitDraw(A, 'w', sU.at - 40, sU.L.length, 'werewolf') : null; lat.B = d ? d - sU.at : null; }
    const wolfN = await A.evaluate(() => window.__wolfN), nOwn = sU ? sU.L.length : 99;
    ok('[1a] F: Bob\'s wolf is drawn on Ann\'s screen (drawWolf) within ~1 s of the summon', lat.F != null && lat.F <= 1200 && wolfN > 0, { lat, wolfN });
    ok('[1b] G: his whole pack joins it within ~1 s', lat.G != null && lat.G <= 1200, { lat, own: sG && sG.L.length, pack: sG && sG.P });
    ok('[1c] B: the Apex werewolf too, within ~1 s', lat.B != null && lat.B <= 1200, { lat, own: sU && sU.L.map((q) => q[6]) });
    // Bob walks right then left: the ghosts stay near his summons and face their travel
    const tW0 = Date.now(); const near = [];
    await B.keyboard.down('ArrowRight'); near.push(...await sampleNear(B, A, 'w', 6)); await B.keyboard.up('ArrowRight');
    await B.keyboard.down('ArrowLeft'); near.push(...await sampleNear(B, A, 'w', 6)); await B.keyboard.up('ArrowLeft');
    near.push(...await sampleNear(B, A, 'w', 4)); const tW1 = Date.now();
    const fc = await facingOk(A, 'w', tW0, tW1);
    const srt = near.slice().sort((a, b) => a - b), med = srt[srt.length >> 1];
    ok('[1d] while Bob walks, each of his summons has a ghost near it on Ann\'s screen (worst summon per sample: median <= 90 px, every sample <= 200)', near.length >= 12 && med <= 90 && srt[srt.length - 1] <= 200, { med, max: srt[srt.length - 1], n: near.length });
    ok('[1e] ...and a moving ghost faces its travel (>= 90% of draws with |vx| > 1)', fc.n >= 10 && fc.good / fc.n >= 0.9, fc);
    const hpM = await (async () => { const m = await B.evaluate(() => window.__mine()); const g = await lastDraw(A, 'w'); if (!g) return null;
      return m.L.map((s) => { const q = g.L.find((x) => x[6] === s[6] && Math.hypot(x[0] - s[0], x[1] - s[1]) < 200); return q ? [s[4], s[5], q[4], q[5]] : null; }); })();
    ok('[1f] ...with his HP numbers on their plates', !!hpM && hpM.length === nOwn && nOwn >= 4 && hpM.every((r) => r && r[1] === r[3] && Math.abs(r[0] - r[2]) <= 0.1 * r[1]), hpM);
    // Ann swings where the ghosts stand: nothing to hit; nothing of Bob's in her arrays or her monsters' refs
    await A.evaluate(() => { const g = (window.__gw[window.__gw.length - 1] || { L: [] }).L[0]; if (g) { player.x = g[0] - 20; player.y = g[1]; } });
    for (let i = 0; i < 5; i++) await press(A, 'z', 90);
    await sleep(600);
    const V = await A.evaluate(() => ({ viol: window.__viol.slice(0, 5), hitG: window.__hitG, pack: (player.pack || []).length, pet: !!player.pet, ult: !!player.ultPet, minions: (game.minions || []).length, ghostsInMonsters: (game.monsters || []).filter((m) => window.__ghosts.has(m)).length }));
    ok('[1g] the ghosts are not Ann\'s: not in her pack / pet / minions / monsters, no monster of hers refers to one, her swings never reach one', V.viol.length === 0 && V.hitG === 0 && !V.pack && !V.pet && !V.ult && !V.minions && !V.ghostsInMonsters && wolfN > 0, V);
    const S = await B.evaluate(() => ({ ...window.__sm, secs: (Date.now() - window.__sm.t0) / 1000 }));
    ok('[1h] the frames carrying Bob\'s list stay small: under the relay\'s 64 KB, the list itself <= 2 KB', S.n > 0 && S.max < 65536 && S.maxSm <= 2048, { n: S.n, perSec: +(S.n / S.secs).toFixed(1), maxFrame: S.max, maxList: S.maxSm });
    if (SHOT) { await B.evaluate(() => { player.x = 860; player.vx = 0; }); await sleep(2500); await A.evaluate(() => { player.x = 700; player.facing = 1; }); await sleep(600); await A.screenshot({ path: SHOT }); }
    // a door: away -> gone on Ann; back -> there again
    const preD = await A.evaluate((t) => window.__gw.filter((r) => r.t > t - 1500 && r.t <= t).length, Date.now()); const went = await goDoor(B, 'mushroom'); const tD = Date.now(); await sleep(2600);
    const afterD = await A.evaluate((t) => window.__gw.filter((r) => r.t > t + 1500).length, tD);
    const travelled = await B.evaluate(() => window.__mine().L.length);
    ok('[1i] Bob walks through a door (his summons go with him): they vanish on Ann within 1.5 s', preD > 0 && went && afterD === 0 && travelled === nOwn, { preD, went, afterD, travelled, nOwn });
    const back = await goDoor(B, 'forest'); const tR = Date.now();
    const reT = back ? await waitDraw(A, 'w', tR - 200, nOwn, 'werewolf', 6000) : null;
    ok('[1j] ...and come back with him when he walks back in', back && reT != null, { back, ms: reT && reT - tR });
    await B.evaluate(() => { for (const p of (player.pack || [])) p.life = 150; });
    const sE = await waitOwn(B, (s) => s.L.length <= 2, 6000); await sleep(2200);
    const tail = await A.evaluate((t) => window.__gw.filter((r) => r.t > t + 1500).map((r) => r.L.length), sE ? sE.at : Date.now());
    ok('[1k] his pack expires: it vanishes on Ann within 1.5 s, his wolf and werewolf stay', lat.G != null && !!sE && tail.length > 0 && tail.every((n) => n === 2), { own: sE && sE.L.length, tail: tail.slice(-4) });
    const preX = await A.evaluate((t) => window.__gw.filter((r) => r.t > t - 1500 && r.t <= t).length, Date.now()); await cB.close(); const tX = Date.now(); await sleep(3500);
    const afterX = await A.evaluate((t) => ({ n: window.__gw.filter((r) => r.t > t + 2000).length, peers: Object.keys(net.peers || {}).length }), tX);
    ok('[1l] Bob disconnects: everything of his vanishes on Ann within 2 s', preX > 0 && afterX.n === 0 && afterX.peers === 0, { preX, ...afterX });
    await cA.close();
  }
  // ======== [2] the reverse direction: the host's undead on the guest's screen
  if (on('2')) {
    const { ctx: cA, page: A } = await boot({ cls: 'mage', job: 'warlock', master: 'necromancer' });
    const { ctx: cB, page: B } = await boot({ cls: 'warrior' });
    const roles = await party(A, B, 'r25e' + Math.floor(Math.random() * 1e8), 'forest');
    ok('[2-setup] Ann (Necromancer) runs the map, Bob follows', roles.a[0] === true && roles.b[0] === false, roles);
    await press(A, 'v'); await sleep(900); await press(A, 'f');
    const sV = await waitOwn(A, (s) => s.M.length >= 1, 6000);
    const dV = sV ? await waitDraw(B, 'm', sV.at - 40, 1) : null, latV = dV ? dV - sV.at : null;
    ok('[2a] V / F: Ann\'s undead are drawn on Bob\'s screen (drawMinions) within ~1 s', latV != null && latV <= 1200, { latV, own: sV && sV.M.length });
    await sleep(1500);
    const near = await sampleNear(A, B, 'm', 8); const srt = near.slice().sort((a, b) => a - b);
    ok('[2b] ...near where they stand on Ann\'s screen (median <= 90 px, every sample <= 200)', near.length >= 6 && srt[srt.length >> 1] <= 90 && srt[srt.length - 1] <= 200, { near });
    const fc = await facingOk(B, 'm', 0, Date.now());
    ok('[2c] ...facing their travel when they move', fc.n >= 5 && fc.good / fc.n >= 0.9, fc);
    const V = await B.evaluate(() => ({ viol: window.__viol.slice(0, 5), minions: (game.minions || []).length, pet: !!player.pet, pack: (player.pack || []).length }));
    const S = await A.evaluate(() => ({ ...window.__sm }));
    ok('[2d] they are not Bob\'s (not in his game.minions, no monster refers to one); Ann\'s list rides her frames, small', V.viol.length === 0 && !V.minions && !V.pet && !V.pack && S.n > 0 && S.maxSm <= 2048 && S.max < 65536, { V, S });
    await A.evaluate(() => { for (const m of (game.minions || [])) if (m && !m.mojimon) m.life = 150; });
    const preC = await B.evaluate((t) => window.__gm.filter((r) => r.t > t - 1500 && r.t <= t).length, Date.now()); const sC = await waitOwn(A, (s) => s.M.length === 0, 6000); await sleep(2200);
    const after = await B.evaluate((t) => window.__gm.filter((r) => r.t > t + 1500).length, sC ? sC.at : Date.now());
    ok('[2e] they crumble: gone from Bob\'s screen within 1.5 s', preC > 0 && !!sC && after === 0, { preC, after });
    await cA.close(); await cB.close();
  }
} catch (e) { ok('no exception', false, String(e && e.stack || e).slice(0, 400)); }
ok('no page errors', errs.length === 0, errs.slice(0, 5));
await browser.close(); try { relay.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
