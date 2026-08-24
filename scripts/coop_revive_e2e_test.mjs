// END-TO-END: does the co-op revive actually work, and is it really once per map?
//
// Per user: "ensure that this feature of reviving a downed player actually
// works" and "that it is only once per map."
//
// Not a unit test — TWO real browser clients on a REAL relay (mp/server.mjs),
// in one room, on one map. Client A goes down through the game's own
// _coopTryDowned; client B stands beside the body and channels through the
// game's own _coopReviveTick; every frame crosses the websocket. Nothing about
// the revive path is stubbed.
//   node scripts/coop_revive_e2e_test.mjs [gamePort] [relayPort]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
const pick = async (from) => { for (let p = from; p <= from + 300; p++) if (await free(p)) return String(p); throw new Error('no port'); };
const GAME_PORT = process.argv[2] || await pick(8767);
const RELAY_PORT = process.argv[3] || await pick(9310);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', GAME_PORT], { stdio: 'ignore' });
// The relay needs mp/node_modules (ws). A worktree without it dies silently
// and every check downstream fails for the wrong reason - so its output is
// captured and its liveness proven with a real HTTP hit before the test starts.
const relay = spawn(process.execPath, ['mp/server.mjs'], { env: { ...process.env, PORT: RELAY_PORT } });
let relayLog = '';
relay.stdout.on('data', d => { relayLog += d; });
relay.stderr.on('data', d => { relayLog += d; });
await new Promise(r => setTimeout(r, 2500));
const relayUp = await fetch('http://127.0.0.1:' + RELAY_PORT + '/').then(r => r.ok || r.status > 0).catch(() => false);
if (!relayUp) { console.log('RELAY DID NOT START:\n' + relayLog.slice(0, 600)); process.exit(1); }

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 900, height: 600 } });
const errs = [];
const open = async (tag) => {
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(tag + ': ' + String(e).slice(0, 120)));
  await pg.goto(`http://localhost:${GAME_PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await pg.waitForFunction(() => typeof mpConnect === 'function' && typeof _coopTryDowned === 'function'
    && typeof _coopReviveTick === 'function', null, { timeout: 120000 });
  return pg;
};
const A = await open('A'), B = await open('B');
const ROOM = 'REVIVETEST';
const join = (pg, name) => pg.evaluate(([url, nm, room]) => {
  player.name = nm; if (player.look) player.look.name = nm;
  mpConnect(url, nm, room);
}, [`ws://127.0.0.1:${RELAY_PORT}`, name, ROOM]);
await join(A, 'Alpha'); await join(B, 'Bravo');
const connected = (pg) => pg.waitForFunction(() => net && net.connected && net.myId != null
  && Object.keys(net.peers || {}).length > 0, null, { timeout: 30000 }).then(() => true).catch(() => false);
const cA = await connected(A), cB = await connected(B);
ok('both clients reach the relay and see each other', cA && cB, { A: cA, B: cB, relayPort: RELAY_PORT });

// Park both on the same map, standing together, and keep presence flowing.
const MAP = 'forest';
const map_ = MAP;
const place = (pg, x) => pg.evaluate(([map, px]) => {
  game.paused = false;
  if (game.currentMap !== map && typeof loadMap === 'function') loadMap(map);
  player.x = px; player.y = 400; player.hp = (typeof getMaxHp === 'function') ? getMaxHp() : 100;
  player._downed = false; player._downedSilent = false;
  player._coopReviveMapAt = {};                       // fresh slate for the test
  // _isOnboardingActive() gates the WHOLE revive off: a fresh client has
  // _tutorialSeen unset and sits behind the prologue flags, so a down there is
  // silent and never revivable. That is correct for a first-run player and
  // wrong for this test, which is about the normal case - so clear the four
  // things it looks at and be explicit that we are doing so.
  player._tutorialSeen = true;
  window._prologueActive = false; window._prologuePending = false;
  document.body.classList.remove('sb-active');
  const _tut = document.getElementById('tutorial-modal'); if (_tut) _tut.hidden = true;
  // presence: the reviver gates on p.map === game.currentMap and p.x/p.y
  if (net && net.ws && net.ws.readyState === 1)
    net.ws.send(JSON.stringify({ t: 'state', map: map, x: Math.round(px), y: 400, name: player.name }));
}, [map_, x]);
await place(A, 500); await place(B, 540);             // 40px apart, inside the 90px range
await new Promise(r => setTimeout(r, 1200));

const peerSeen = await B.evaluate((m) => {
  const ids = Object.keys(net.peers || {});
  return ids.map(i => ({ id: i, map: net.peers[i].map, x: net.peers[i].x })).filter(p => p.map === m);
}, MAP);
ok('B sees A on the same map with a position', peerSeen.length === 1 && Number.isFinite(peerSeen[0].x), { peers: peerSeen });

// ---------- 1) A goes down for real ----------
await A.evaluate(() => { player._coopReviveMapAt = {}; _coopTryDowned();
  // the banner is built by _coopDownedTick, which the title-screen page never
  // reaches through updatePlayer - drive the real tick rather than the builder
  _coopDownedTick(16); });
await new Promise(r => setTimeout(r, 900));
const downA = await A.evaluate(() => ({ downed: !!player._downed, revivable: !!player._downRevivable,
  banner: !!document.getElementById('coop-downed-banner') }));
const downSeen = await B.evaluate(() => { const p = Object.values(net.peers)[0] || {};
  return { downed: !!p._downed, noRev: !!p._downNoRevive }; });
ok('A is downed and knows a partner can reach them', downA.downed && downA.revivable && downA.banner, downA);
ok('B receives the down broadcast over the relay', downSeen.downed && !downSeen.noRev, downSeen);

// ---------- 2) B channels the revive ----------
const channel = () => B.evaluate(() => {
  // drive the game's own tick; 3s of dt in 100ms slices, staying in range
  for (let i = 0; i < 40; i++) _coopReviveTick(100);
  const p = Object.values(net.peers)[0] || {};
  return { theirReviveMs: p._reviveMs, theyLookUp: !p._downed };
});
const chan = await channel();
await new Promise(r => setTimeout(r, 900));
const upA = await A.evaluate(() => ({
  downed: !!player._downed, hp: player.hp, maxHp: (typeof getMaxHp === 'function') ? getMaxHp() : 0,
  spent: !!(player._coopReviveMapAt && player._coopReviveMapAt[game.currentMap]),
  banner: !!document.getElementById('coop-downed-banner'), invuln: player.invulnerable | 0,
}));
ok('THE REVIVE WORKS — A is back up after B channels beside them',
  !upA.downed && upA.banner === false, { ...upA, reviverSaw: chan });
ok('...restored to half health with i-frames, not left at 1 hp',
  upA.hp > 1 && Math.abs(upA.hp - Math.floor(upA.maxHp * 0.5)) <= 1 && upA.invuln > 0,
  { hp: upA.hp, halfOfMax: Math.floor(upA.maxHp * 0.5), invulnMs: upA.invuln });
ok('...and the map\'s revive is stamped as spent', upA.spent, { spent: upA.spent });

// ---------- 3) ONCE PER MAP: a second down on the same map cannot be revived ----------
await A.evaluate(() => { player.hp = (typeof getMaxHp === 'function') ? getMaxHp() : 100; _coopTryDowned();
  _coopDownedTick(16); });
await new Promise(r => setTimeout(r, 900));
const down2 = await A.evaluate(() => ({ downed: !!player._downed, revivable: !!player._downRevivable,
  already: !!player._downAlreadyRevived,
  copy: (document.getElementById('coop-downed-banner') || {}).textContent || '' }));
const seen2 = await B.evaluate(() => { const p = Object.values(net.peers)[0] || {}; return { noRev: !!p._downNoRevive }; });
const chan2 = await channel();
await new Promise(r => setTimeout(r, 900));
const still = await A.evaluate(() => ({ downed: !!player._downed }));
ok('a SECOND down on the same map is not revivable', down2.downed && !down2.revivable && down2.already, down2);
ok('...B is told not to bother channelling (rev:0 in the down frame)', seen2.noRev, seen2);
ok('...and even if B channels anyway, A stays down', still.downed, { stillDowned: still.downed, reviver: chan2 });
ok('...the banner says so in words', /already revived on this map/.test(down2.copy), { copy: down2.copy.slice(0, 80) });

// ---------- 4) a DIFFERENT map has its own revive ----------
const MAP2 = 'mushroom';
await A.evaluate((m) => { player._downed = false; document.getElementById('coop-downed-banner')?.remove();
  if (typeof loadMap === 'function') loadMap(m);
  player.x = 500; player.y = 400; player.hp = (typeof getMaxHp === 'function') ? getMaxHp() : 100;
  net.ws.send(JSON.stringify({ t: 'state', map: m, x: 500, y: 400, name: player.name })); }, MAP2);
await B.evaluate((m) => { if (typeof loadMap === 'function') loadMap(m);
  player.x = 540; player.y = 400;
  net.ws.send(JSON.stringify({ t: 'state', map: m, x: 540, y: 400, name: player.name })); }, MAP2);
await new Promise(r => setTimeout(r, 1200));
await A.evaluate(() => _coopTryDowned());
await new Promise(r => setTimeout(r, 900));
const down3 = await A.evaluate(() => ({ revivable: !!player._downRevivable }));
await channel();
await new Promise(r => setTimeout(r, 900));
const up3 = await A.evaluate(() => ({ downed: !!player._downed }));
ok('a different map gets its own revive — it is per map, not per run',
  down3.revivable && !up3.downed, { revivableOnMap2: down3.revivable, backUp: !up3.downed });

ok('no page errors on either client', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill(); relay.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
