// HIDDEN-HOST certification (black-box). Emulates the host tabbing away:
// document.hidden → true (getter patch + visibilitychange), and the rAF sim
// contribution zeroed (loop's paused branch skips the world step when hidden —
// exactly like a real hidden tab where rAF never fires). From that moment the
// Web-Worker pump must drive EVERYTHING by itself — no manual stepping:
//   • host monsters keep moving (AI/physics run off worker messages)
//   • host keeps broadcasting 'mon' (guest mirrors keep moving)
//   • host presence/keepalive keeps flowing (guest's peer stays fresh)
//   • a hidden GUEST likewise stays alive (its pump keeps _mpTick running)
import { chromium } from 'playwright-core';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const WS  = 'ws://localhost:8080';
const ROOM = 'hid' + Math.floor(Math.random() * 1e9);
const MAP = 'glasswindSteppe';

const results = [];
const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function boot(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  page._errors = errs;
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function' && typeof _lxCoopWorldStep === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3200);
  await page.evaluate((nm) => { try { player.cls = player.cls || 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; } catch (e) {} }, name);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
// Emulate tab-away: document.hidden=true + visibilitychange, and pause the rAF
// sim contribution (mirrors a real hidden tab where loop() never fires).
const hide = (page) => ev(page, () => {
  Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  game.paused = true;   // rAF sim OFF — the worker pump must carry the world alone
});
const unhide = (page) => ev(page, () => {
  Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  game.paused = false;
});

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const A = await boot(browser, 'Host');
  const B = await boot(browser, 'Guest');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Host', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Guest', room), { ws: WS, room: ROOM });
  await sleep(900);
  // NOTE: no manual _mpTick pumps — the game's own machinery must do the work.
  // (While VISIBLE, headless rAF runs loop() which ticks everything normally.)
  await ev(A, ({ map }) => loadMap(map), { map: MAP });
  await ev(B, ({ map }) => loadMap(map), { map: MAP });
  await sleep(1500);
  const aHost = await ev(A, () => net.isHost), bHost = await ev(B, () => net.isHost);
  ok('host election resolved (A host, B guest)', aHost === true && bHost === false, { aHost, bHost });

  // Ensure host has moving monsters.
  const mon0 = await ev(A, () => {
    if (!(game.monsters || []).filter(m => m && m.currentHp > 0).length) { try { spawnMonster('glasswindHare', player.x + 200, player.y - 40); } catch (e) {} }
    const live = game.monsters.filter(m => m && m.currentHp > 0);
    return { n: live.length };
  });
  ok('host has live monsters', mon0.n > 0, mon0);

  // === HOST TABS AWAY ===
  await hide(A);
  await sleep(300);
  const snapA1 = await ev(A, () => ({
    t: game.time, monAt: net._coopMonAt || 0,
    xs: game.monsters.filter(m => m && m.currentHp > 0).slice(0, 6).map(m => Math.round(m.x)),
  }));
  await sleep(2500);   // no test-driven stepping — only the worker pump runs
  const snapA2 = await ev(A, () => ({
    t: game.time, monAt: net._coopMonAt || 0,
    xs: game.monsters.filter(m => m && m.currentHp > 0).slice(0, 6).map(m => Math.round(m.x)),
    pumpUp: !!_lxCoopPumpWorker,
  }));
  const simAdvanced = snapA2.t - snapA1.t;
  const anyMoved = snapA1.xs.some((x, i) => snapA2.xs[i] !== undefined && Math.abs(snapA2.xs[i] - x) > 1);
  ok('hidden host: sim time advanced via the worker pump (~150 steps expected)', simAdvanced > 60, { simAdvanced, pumpUp: snapA2.pumpUp });
  ok('hidden host: monsters kept MOVING', anyMoved, { before: snapA1.xs, after: snapA2.xs });
  ok('hidden host: kept BROADCASTING mon frames', snapA2.monAt > snapA1.monAt, { d: Math.round(snapA2.monAt - snapA1.monAt) });

  // Guest keeps seeing movement + fresh host presence.
  const g1 = await ev(B, () => {
    const ms = (game.monsters || []).filter(m => m && m._coopMirror);
    const host = net.peers[net.hostId];
    return { xs: ms.slice(0, 6).map(m => Math.round(m._tx != null ? m._tx : m.x)), last: host ? host._last : 0 };
  });
  await sleep(2000);
  const g2 = await ev(B, () => {
    const ms = (game.monsters || []).filter(m => m && m._coopMirror);
    const host = net.peers[net.hostId];
    return { xs: ms.slice(0, 6).map(m => Math.round(m._tx != null ? m._tx : m.x)), last: host ? host._last : 0, n: ms.length };
  });
  const guestSawMove = g1.xs.length > 0 && g1.xs.some((x, i) => g2.xs[i] !== undefined && Math.abs(g2.xs[i] - x) > 1);
  ok('guest: mirrored monsters KEPT MOVING while host was hidden', guestSawMove, { before: g1.xs, after: g2.xs });
  ok('guest: host presence stayed fresh (state still flowing)', g2.last > g1.last, { d: Math.round(g2.last - g1.last) });

  // === HOST RETURNS === (world resumes on rAF, no double-sim, no errors)
  await unhide(A);
  await sleep(800);
  const back = await ev(A, () => ({ paused: game.paused, hp: player.hp, mons: game.monsters.filter(m => m && m.currentHp > 0).length }));
  ok('host returns cleanly (unpaused, alive, monsters intact)', back.paused === false && back.hp > 0 && back.mons > 0, back);

  // === GUEST TABS AWAY === its pump must keep presence flowing to the host.
  await hide(B);
  const h1 = await ev(A, () => { for (const id in net.peers) return { last: net.peers[id]._last }; return { last: 0 }; });
  await sleep(2000);
  const h2 = await ev(A, () => { for (const id in net.peers) return { last: net.peers[id]._last }; return { last: 0 }; });
  ok('hidden GUEST keeps its presence alive (host still hears it)', h2.last > h1.last, { d: Math.round(h2.last - h1.last) });
  await unhide(B);
  await sleep(400);

  ok('no page errors on host', A._errors.length === 0, A._errors.slice(0, 3));
  ok('no page errors on guest', B._errors.length === 0, B._errors.slice(0, 3));
} finally {
  await browser.close();
}
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
