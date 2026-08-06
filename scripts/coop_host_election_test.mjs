// v0.29.472 — host election under ghosts. Written because v0.29.471's election
// fix shipped with TWO defects that a marker-grep could not see:
//   • it compared a performance.now() stamp against Date.now(), so every peer
//     looked ~1.75e12 ms stale and EVERY client elected itself host;
//   • _coopReelectTick was defined and never called.
// This asserts BEHAVIOUR, which is what would have caught both.
//
//   node serve.js 8835 && node scripts/coop_host_election_test.mjs 8835 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8835';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_coopRecomputeHost') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(() => {
  const N = eval('net');
  const STALE = eval('_LX_HOST_STALE_MS');
  const recompute = eval('_coopRecomputeHost');
  const saved = { peers: N.peers, myId: N.myId, ws: N.ws, connected: N.connected };
  // _coopActive() needs a live-looking connection; fake the minimum.
  N.ws = { readyState: 1, send() {} }; N.connected = true;
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  const run = (myId, peers) => { N.myId = myId; N.peers = peers; recompute(); return { hostId: N.hostId, isHost: N.isHost }; };

  const out = {};
  // 1. Two LIVE peers: lowest id wins, and only one client thinks it is host.
  out.liveLowest = run(2, { 1: { _last: now(), map: 'town' } });
  out.liveIAmLowest = run(1, { 2: { _last: now(), map: 'town' } });
  // 2. The ghost case the fix exists for: peer 1 silent well past the cutoff.
  out.ghostSkipped = run(3, { 1: { _last: now() - (STALE + 4000), map: 'town' }, 2: { _last: now(), map: 'town' } });
  // 3. A peer that has never sent state (no _last) must NOT be treated as a
  //    ghost — a fresh joiner would otherwise be skipped and never host.
  out.noLastKept = run(3, { 1: { map: 'town' } });
  // 4. Alone in the room.
  out.alone = run(5, {});
  N.myId = saved.myId; N.peers = saved.peers; N.ws = saved.ws; N.connected = saved.connected;
  try { recompute(); } catch (e) {}
  return { ...out, STALE, reelectWired: typeof eval('_coopReelectTick') === 'function' };
});

ok('live lowest-id peer is elected host (not me)', r.liveLowest.hostId === 1 && r.liveLowest.isHost === false, r.liveLowest);
ok('I am host when I hold the lowest id', r.liveIAmLowest.hostId === 1 && r.liveIAmLowest.isHost === true, r.liveIAmLowest);
ok('CLOCK: a LIVE peer is never mistaken for a ghost',
   r.liveLowest.isHost === false, { note: 'if the clock units mismatched, every peer looks stale and this flips to true' });
ok('a peer silent past the cutoff is skipped, next-lowest LIVE peer wins',
   r.ghostSkipped.hostId === 2 && r.ghostSkipped.isHost === false, r.ghostSkipped);
ok('a peer with no _last yet is NOT treated as a ghost', r.noLastKept.hostId === 1, r.noLastKept);
ok('alone in the room I am host', r.alone.isHost === true && r.alone.hostId === 5, r.alone);
ok('the staleness cutoff matches the follow-path cutoff (5s)', r.STALE === 5000, { STALE: r.STALE });
ok('_coopReelectTick exists', r.reelectWired === true);

// Dead-code check: defined AND called. A grep for the name alone would pass on
// the broken build, so require MORE than one reference in the shipped source.
const wired = await page.evaluate(() => {
  const src = [...document.querySelectorAll('script')].map(x => x.textContent).join('\n');
  return {
    refs: (src.match(/_coopReelectTick/g) || []).length,
    calledInHeartbeat: /_coopReelectTick\(\);?[\s\S]{0,80}MP_LIFELINE_MS/.test(src),
  };
});
ok('_coopReelectTick is CALLED, not just defined', wired.refs >= 2, wired);
ok('it is wired into the lifeline heartbeat', wired.calledInHeartbeat === true, wired);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
