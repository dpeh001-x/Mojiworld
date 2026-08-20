// More players must mean more EXP, and most of all in a Party Quest.
//
// Per user: "Improve on PQ aspect, if there are more players increase bonus exp
// as well." Every co-op EXP path stopped at the FIRST nearby ally and returned
// a flat x2 — `if (dx*dx + dy*dy <= RANGE) return 2;` — so a duo and a full
// five-player room earned exactly the same, including inside the Ticket Rush,
// the one chain written for a group.
//
// Measured by planting synthetic peers in net.peers (the same shape the
// presence tick writes) and asking the LIVE _coopXpMul what a kill is worth,
// plus a real killMonster to confirm the multiplier reaches player.exp.
//   node scripts/party_exp_scaling_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _coopXpMul === 'function' && typeof killMonster === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.level = 40; player.hp = getMaxHp();
  player.x = 600; player.y = 300;

  // Plant N peers the way the presence tick does: same map, inside the 400px
  // wedge, with a fresh _last so the stale-peer guard keeps them.
  const setParty = (n, mapId) => {
    game.currentMap = mapId;
    net.connected = n > 0;
    net.peers = {};
    for (let i = 0; i < n; i++) {
      net.peers['peer' + i] = { map: mapId, x: player.x + 40 + i * 10, y: player.y,
        _last: (performance && performance.now) ? performance.now() : Date.now() };
    }
  };
  const mulAt = (n, mapId) => { setParty(n, mapId); return _coopXpMul(null); };

  out.normalMap = [0, 1, 2, 3, 4, 5].map(n => mulAt(n, 'glasswindSteppe'));
  out.pqMap     = [0, 1, 2, 3, 4, 5].map(n => mulAt(n, 'clockworkUnderpassLobby'));

  // A stale peer must not buy a party bonus.
  setParty(2, 'clockworkUnderpassLobby');
  for (const id in net.peers) net.peers[id]._last = ((performance && performance.now) ? performance.now() : Date.now()) - 60000;
  out.stalePeersIgnored = _coopXpMul(null);

  // A peer on another map is not in my party.
  setParty(2, 'clockworkUnderpassLobby');
  for (const id in net.peers) net.peers[id].map = 'town';
  out.offMapIgnored = _coopXpMul(null);

  // A peer standing far away is not in my party.
  setParty(2, 'clockworkUnderpassLobby');
  for (const id in net.peers) net.peers[id].x = player.x + 5000;
  out.farAwayIgnored = _coopXpMul(null);

  // ...and the multiplier actually reaches the wallet, through the real kill.
  // A hand-built Ticket Mech rather than spawnMonster: the spawner refuses a
  // map that was set by assignment instead of loaded (it returns a rejection
  // marker, {_suppressed,_sanctuary}, whose .exp is undefined - which silently
  // turned the first version of this measurement into NaN). A literal with a
  // known exp also isolates what is under test: the MULTIPLIER, not the
  // spawner or the stat table.
  const expFor = (n) => {
    setParty(n, 'clockworkUnderpassLobby');
    game.monsters.length = 0; game.drops.length = 0;
    game.particles.length = 0; game.damageNumbers.length = 0;
    player.level = 40;
    player.exp = 0;
    player.expToNext = 1e12;   // setting .level does not recompute this; keep the kill from levelling us and rewriting exp
    const m = { type: 'ticketMech', label: 'Ticket Mech', x: player.x + 60, y: player.y,
      w: 60, h: 52, currentHp: 0, maxHp: 3250, hp: 3250, exp: 1000, mojicoins: 0,
      atk: 1, def: 0, speed: 0, level: 31 };
    game.monsters.push(m);           // killMonster bails on indexOf(m) < 0
    try { killMonster(m); } catch (e) {}
    return player.exp;
  };
  out.expSolo    = expFor(0);
  out.expDuo     = expFor(1);
  out.expFullPq  = expFor(4);

  // The PQ pin should say so out loud.
  setParty(2, 'clockworkUnderpassLobby');
  player.quests = player.quests || {}; player.quests.active = player.quests.active || {};
  player.quests.active.q_clockwork_underpass = { progress: 10, targetCount: 150 };
  try { _renderPqObjectivePin(); } catch (e) {}
  const pinEl = document.getElementById('pq-objective-pin');
  out.pinText = pinEl ? (pinEl.textContent || '').trim() : '';

  net.connected = false; net.peers = {};
  game.monsters.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('allies 0..5, normal map:', JSON.stringify(r.normalMap));
console.log('allies 0..5, PQ map    :', JSON.stringify(r.pqMap));
console.log('EXP through a real kill — solo', r.expSolo, '| duo', r.expDuo, '| party of 5 in the PQ', r.expFullPq);
console.log('pin:', r.pinText.slice(0, 140));

const N = r.normalMap || [], P = r.pqMap || [];
ok('solo is unchanged — no party, no bonus', N[0] === 1 && P[0] === 1, { normal: N[0], pq: P[0] });
ok('one ally still pays exactly x2 (v0.28.7 untouched)', N[1] === 2 && P[1] === 2, { normal: N[1], pq: P[1] });
ok('a bigger party pays more, everywhere — the reported gap',
   N[2] > N[1] && N[3] > N[2] && N[4] > N[3], { curve: N });
ok('a PQ rewards the party harder than an ordinary map',
   P[2] > N[2] && P[3] > N[3] && P[4] > N[4], { pq: P, normal: N });
ok('a full five-player PQ party is x5', P[4] === 5, { pq4: P[4] });
ok('the bonus is capped — a sixth body adds nothing',
   N[5] === N[4] && P[5] === P[4], { normal5: N[5], pq5: P[5] });
ok('stale peers buy no bonus', r.stalePeersIgnored === 1, { mul: r.stalePeersIgnored });
ok('a peer on another map is not in the party', r.offMapIgnored === 1, { mul: r.offMapIgnored });
ok('a peer across the map is not in the party', r.farAwayIgnored === 1, { mul: r.farAwayIgnored });
ok('the multiplier reaches the wallet: a duo out-earns a solo on a real kill',
   r.expDuo > r.expSolo * 1.5, { solo: r.expSolo, duo: r.expDuo });
ok('...and a full PQ party out-earns the duo again',
   r.expFullPq > r.expDuo * 1.5, { duo: r.expDuo, party: r.expFullPq });
ok('the PQ pin tells the player what their party is worth',
   /Party of 3/.test(r.pinText) && /×3/.test(r.pinText), { pin: r.pinText.slice(0, 140) });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
