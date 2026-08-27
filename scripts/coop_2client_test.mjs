// 2-client live co-op certification. Drives two real browser clients against the
// local relay and asserts host-authoritative shared monsters + shared damage +
// shared kills. Headless throttles requestAnimationFrame, so we inject a
// setInterval pump that calls the game's own outbound ticks (_mpTick /
// _coopTickMonsters); all INBOUND handling (welcome/state/mon/dmg/kill) fires
// automatically via the WebSocket onmessage handler, exactly as in a real client.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const URL = 'http://localhost:8080/mojiworld_game.html';
const WS  = 'ws://localhost:8080';
const MAP = 'glasswindSteppe';
const ROOM = 'cert' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));

const results = [];
const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function boot(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 180)));
  page._errors = errors;
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof game === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => {
    try { player.cls = player.cls || 'warrior'; } catch (e) {}
    try { if (player.look) player.look.name = nm; } catch (e) {}
    try { game.paused = false; window._prologueActive = false; } catch (e) {}
  }, name);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const startPump = (page) => page.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} }, 90); });

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const A = await boot(browser, 'Alice');
  const B = await boot(browser, 'Bob');

  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM });
  // Wait for A's WELCOME (id assigned) before B connects — a fixed sleep raced:
  // a backgrounded page's socket-open callback can lag, letting B's hello reach
  // the relay first and win the lower id (correctly becoming host, breaking the
  // test's A-is-host assumption). Deterministic ordering, same intent.
  await A.waitForFunction(() => net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM });
  await sleep(800);
  await startPump(A); await startPump(B);        // drive outbound ticks on both
  await sleep(600);

  ok('A connected', await ev(A, () => net.connected));
  ok('B connected', await ev(B, () => net.connected));
  const aHost = await ev(A, () => net.isHost), bHost = await ev(B, () => net.isHost);
  ok('exactly one host', aHost !== bHost, { aHost, bHost });
  ok('first-joiner is host', aHost === true && bHost === false);

  // Host loads a monster map; B loads the same map (its own spawns should get
  // purged once it starts mirroring — this exercises the ordering fix).
  await ev(A, (m) => loadMap(m), MAP);
  await sleep(400);
  await ev(B, (m) => loadMap(m), MAP);
  await sleep(2200);   // presence propagates host's map -> B follows -> mon sync

  const aMon = await ev(A, () => ({ n: game.monsters.length, allUid: game.monsters.every(m => m.uid != null) }));
  ok('host spawned monsters w/ uids', aMon.n > 0 && aMon.allUid, aMon);

  const bMon = await ev(B, () => ({
    n: game.monsters.length,
    following: _coopFollowingHost(), hostMap: _coopHostMap(), curMap: game.currentMap,
    mirrors: game.monsters.filter(m => m._coopMirror).length,
    locals: game.monsters.filter(m => !m._coopMirror).length,
  }));
  ok('non-host is following host', bMon.following === true, bMon);
  ok('non-host mirrors host monsters', bMon.mirrors > 0, bMon);
  ok('non-host has NO local duplicates', bMon.locals === 0, bMon);

  // Mirror uids are the HOST's uids (identity carried across the wire).
  const aUids = (await ev(A, () => game.monsters.map(m => m.uid))).sort((x, y) => x - y);
  const bUids = (await ev(B, () => game.monsters.filter(m => m._coopMirror).map(m => m.uid))).sort((x, y) => x - y);
  ok('mirror uid set == host uid set', JSON.stringify(aUids) === JSON.stringify(bUids), { host: aUids.length, mirror: bUids.length });

  // SHARED DAMAGE: non-host bloodies (not kills) a mirror; host's same-uid HP drops.
  const tUid = bUids[0];
  const hpBefore = await ev(A, (u) => { const m = game.monsters.find(x => x.uid === u); return m ? m.currentHp : null; }, tUid);
  await ev(B, (u) => { const m = game.monsters.find(x => x.uid === u); if (m) hitMonster(m, Math.max(1, Math.floor(m.currentHp * 0.25)), false, 'certtest'); }, tUid);
  await sleep(500);
  const hpAfter = await ev(A, (u) => { const m = game.monsters.find(x => x.uid === u); return m ? m.currentHp : 'GONE'; }, tUid);
  ok('non-host damage reached host (shared HP)', typeof hpAfter === 'number' && hpAfter < hpBefore, { tUid, hpBefore, hpAfter });
  await sleep(400);
  const hpMirror = await ev(B, (u) => { const m = game.monsters.find(x => x.uid === u); return m ? m.currentHp : 'GONE'; }, tUid);
  ok('reduced HP synced back to non-host', hpMirror === 'GONE' || Math.abs(hpMirror - hpAfter) <= 2, { hpAfter, hpMirror });

  // SHARED KILL: non-host lands the lethal blow; host removes it + broadcasts kill.
  const xpBefore = await ev(B, () => player.exp || 0);
  await ev(B, (u) => { const m = game.monsters.find(x => x.uid === u); if (m) hitMonster(m, 9999999, true, 'certtest'); }, tUid);
  await sleep(700);
  ok('killed monster gone on host', await ev(A, (u) => !game.monsters.some(x => x.uid === u), tUid), { tUid });
  ok('killed monster gone on non-host', await ev(B, (u) => !game.monsters.some(x => x.uid === u), tUid), { tUid });
  const xpAfter = await ev(B, () => player.exp || 0);
  ok('non-host gained XP from the shared kill', xpAfter > xpBefore, { xpBefore, xpAfter });

  // HOST-side kill also reaches the peer: host kills a different monster directly.
  const tUid2 = aUids[aUids.length - 1];
  await ev(A, (u) => { const m = game.monsters.find(x => x.uid === u); if (m) { m.currentHp = 1; hitMonster(m, 9999, false, 'hosttest'); } }, tUid2);
  await sleep(700);
  ok('host kill removes monster on non-host too', await ev(B, (u) => !game.monsters.some(x => x.uid === u), tUid2), { tUid2 });

  ok('no page errors on host', A._errors.length === 0, A._errors.slice(0, 5));
  ok('no page errors on non-host', B._errors.length === 0, B._errors.slice(0, 5));
} catch (e) {
  results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) });
} finally {
  await browser.close();
}

const passed = results.filter(r => r.pass).length;
console.log('\n=== 2-CLIENT CO-OP CERTIFICATION ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
