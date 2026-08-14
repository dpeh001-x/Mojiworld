// TWO-CLIENT CO-OP E2E against the LIVE relay, through the real UI — the exact
// path Steam review walks: host connects, gets a party code; a second client
// types that code and presses Connect. Asserts the two findings from the
// BuildID 24546122 rejection stay fixed:
//   "could not connect to any of the available servers"  -> both clients connect
//   "the joined remain on the Multiplayer window"        -> the modal dismisses itself
// plus mutual roster visibility, same-room landing, and the retired-Render-URL
// localStorage migration. Run BEFORE every depot push, next to
// relay_health_check.mjs:   node scripts/coop_join_e2e.mjs
import { createRequire } from 'node:module';
import path from 'node:path'; import { spawn } from 'node:child_process';
const require = createRequire('C:/Users/dpeh0/Mojiworld/package.json');
const { chromium } = require('playwright-core');
process.chdir('C:/Users/dpeh0/Mojiworld');
const PORT = 9195;
const srv = spawn(process.execPath, ['serve.js', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const b = await chromium.launch({ channel: 'msedge', headless: true });
const mk = async (name) => {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(9000);
  await p.evaluate((nm) => {
    const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
    player.cls = player.cls || 'warrior'; player.name = nm; game.paused = false;
  }, name);
  return p;
};
const CODE = 'steamqa' + Math.floor(Math.random() * 9000 + 1000);
const res = []; const ok = (n, c, x) => res.push({ n, pass: !!c, x: String(x ?? '') });

const A = await mk('HostQA');
// A. the retired-URL migration fires
const mig = await A.evaluate((code) => {
  localStorage.setItem('levelx_mp_url', 'wss://mojiworld-mp.onrender.com');   // poison like a stale tester machine
  openMultiplayer();
  return { field: document.getElementById('mp-url').value, saved: localStorage.getItem('levelx_mp_url') };
}, CODE);
ok('retired Render URL migrated to the shipped default', /workers\.dev/.test(mig.field) && /workers\.dev/.test(mig.saved), mig.field);
// B. HOST connects through the real button
await A.evaluate((code) => {
  document.getElementById('mp-name').value = 'HostQA';
  document.getElementById('mp-room').value = code;
  document.getElementById('mp-connect-btn').onclick ? document.getElementById('mp-connect-btn').click() : mpConnect(document.getElementById('mp-url').value, 'HostQA', code);
}, CODE);
await A.waitForFunction(() => net && net.connected, { timeout: 30000 }).catch(() => {});
const aState = await A.evaluate(() => ({ connected: net.connected, room: net.roomId, modal: document.getElementById('multiplayer-modal').style.display }));
ok('host connects to the live relay', aState.connected, JSON.stringify(aState));
ok("host's multiplayer window dismisses itself on success", aState.modal === 'none', 'display=' + aState.modal);

// C. JOINER enters the code the way the reviewer did
const B2 = await mk('JoinQA');
await B2.evaluate((code) => {
  openMultiplayer();
  document.getElementById('mp-name').value = 'JoinQA';
  document.getElementById('mp-room').value = code;
  document.getElementById('mp-connect-btn').click();
}, CODE);
await B2.waitForFunction(() => net && net.connected && Object.keys(net.peers||{}).length >= 1, { timeout: 30000 }).catch(() => {});
const bState = await B2.evaluate(() => ({ connected: net.connected, room: net.roomId,
  modal: document.getElementById('multiplayer-modal').style.display,
  players: Object.values(net.peers||{}).map(p=>p.name||'?') }));
ok('joiner connects with the host code', bState.connected, JSON.stringify(bState));
ok('JOINER DOES NOT REMAIN ON THE MULTIPLAYER WINDOW', bState.modal === 'none', 'display=' + bState.modal);
ok('joiner sees the host in the room', JSON.stringify(bState.players).includes('HostQA'), JSON.stringify(bState.players));
// D. host sees the joiner arrive
await A.waitForFunction(() => Object.keys(net.peers||{}).length >= 1, { timeout: 15000 }).catch(() => {});
const aPlayers = await A.evaluate(() => Object.values(net.peers||{}).map(p=>p.name||'?'));
ok('host sees the joiner arrive', JSON.stringify(aPlayers).includes('JoinQA'), JSON.stringify(aPlayers));
// E. same room id both sides
ok('both clients landed in the same room', aState.room && (aState.room === bState.room), aState.room + ' vs ' + bState.room);

for (const r of res) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.x ? '  (' + r.x + ')' : ''}`);
console.log(`${res.filter(r => r.pass).length}/${res.length} passed`);
await b.close(); srv.kill();
process.exit(res.some(r => !r.pass) ? 1 : 0);
