// The Steam review failure, as a test. Reviewer: "We could not connect to any
// of the available servers. After entering the Host code, the joined remain on
// the Multiplayer window and is unable to join the host."
//
// Root cause, measured 2026-08-13: the shipped default relay
// (wss://mojiworld-mp.onrender.com, Render free tier) took 61s to answer HTTP
// from cold and never completed a WebSocket handshake within 120s. The
// Cloudflare Worker relay answered in 1.4s. This test drives the game's OWN
// mpConnect in two real browser pages against the REAL shipped-default relay —
// host and joiner sharing a party code — and asserts what the reviewer needed:
// both connect, each sees the other, and the Multiplayer window gets out of
// the way. Static checks pin every config surface to the same healthy host.
//   node scripts/steam_coop_review_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const WORKER = 'wss://mojiworld-mp.dpeh001.workers.dev';

// --- static: every surface that names a relay names the healthy one ---------
const game = readFileSync('mojiworld_game.html', 'utf8');
const fb = (game.match(/const MP_FALLBACK_URL = '([^']+)'/) || [])[1];
ok('the game ships the Worker relay as its default', fb === WORKER, { fb });
const steamCfg = JSON.parse(readFileSync('steam/relay.config.json', 'utf8'));
ok('the Steam build bakes the same relay', steamCfg.relay === WORKER, { relay: steamCfg.relay });
const wf = readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
ok('the Pages workflow override matches the in-file literal (sed must find it)',
   wf.includes(`DEFAULT_RELAY="${WORKER}"`), {});
const api = (game.match(/return 'https:\/\/([^']+)';\s*\n\}\)\(\);/) || [])[1];
ok('the auth/save API base is the same host (one server to keep alive)',
   api === 'mojiworld-mp.dpeh001.workers.dev', { api });
ok('no Render URL remains anywhere in the game file', !game.includes('onrender.com'), {});

// --- live: host + joiner through the game's own connect path ----------------
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const CODE = 'RV' + Math.random().toString(36).slice(2, 7).toUpperCase();

const boot = async (who) => {
  const page = await (await b.newContext()).newPage();
  page._errs = []; page.on('pageerror', e => page._errs.push(who + ': ' + String(e).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof mpConnect === 'function' && typeof net === 'object', { timeout: 120000 });
  return page;
};
const host = await boot('host');
const guest = await boot('guest');

// The host opens the Multiplayer window and connects on the DEFAULT url —
// exactly the reviewer's path, minus the mouse.
const connect = (page, name, code) => page.evaluate(async ({ name, code }) => {
  const modal = document.getElementById('multiplayer-modal');
  if (modal) { modal.style.display = 'flex'; game.paused = true; }
  mpConnect(MP_DEFAULT_URL, name, code);
  const t0 = Date.now();
  while (!net.connected && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 100));
  return {
    connected: net.connected,
    ms: Date.now() - t0,
    room: net.roomId,
    modalOpen: modal ? modal.style.display !== 'none' : null,
    paused: game.paused,
    // A fresh headless profile still shows the mandatory class-select gate, and
    // the close path DELIBERATELY refuses to unpause under any open modal. The
    // contract under test is "unpaused unless something else is legitimately
    // open", so report what the reconciliation saw.
    otherModalOpen: (typeof _anyOtherModalOpen === 'function') ? !!_anyOtherModalOpen() : false,
  };
}, { name, code });

const h = await connect(host, 'ReviewHost', CODE);
const g = await connect(guest, 'ReviewGuest', CODE);
// Give presence a moment to propagate, then read each side's peer list.
await new Promise(r => setTimeout(r, 2500));
const peersOf = (page) => page.evaluate(() =>
  Object.values(net.peers).map(p => ({ name: p.name })).slice(0, 8));
const hPeers = await peersOf(host);
const gPeers = await peersOf(guest);
const errs = [...host._errs, ...guest._errs];
await b.close(); try { srv.kill(); } catch (e) {}

console.log('host  :', JSON.stringify(h));
console.log('guest :', JSON.stringify(g));
console.log('host sees :', JSON.stringify(hPeers));
console.log('guest sees:', JSON.stringify(gPeers));

ok('the HOST connects to the shipped default relay', h.connected === true, h);
ok('...in seconds, not a 90s cold-start wait', h.ms < 15000, { ms: h.ms });
ok('the GUEST entering the same party code joins the host', g.connected === true, g);
ok('...also in seconds', g.ms < 15000, { ms: g.ms });
ok('both landed in the same room', h.room === g.room && /rv/i.test(h.room || ''), { h: h.room, g: g.room });
ok('the host SEES the guest', hPeers.some(p => p.name === 'ReviewGuest'), hPeers);
ok('the guest SEES the host', gPeers.some(p => p.name === 'ReviewHost'), gPeers);
ok('the Multiplayer window closes itself on a successful join (the reviewer stayed stuck on it)',
   h.modalOpen === false && g.modalOpen === false, { host: h.modalOpen, guest: g.modalOpen });
ok('...and the game unpauses into play (unless another modal is legitimately open)',
   (h.paused === h.otherModalOpen) && (g.paused === g.otherModalOpen),
   { host: { paused: h.paused, otherOpen: h.otherModalOpen }, guest: { paused: g.paused, otherOpen: g.otherModalOpen } });
ok('no page errors on either side', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
