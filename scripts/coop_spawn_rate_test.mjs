// CO-OP SPAWN PRESSURE — respawn rate +10% per additional player in the map.
// ============================================================================
// Per user: "ensure multiplayer works well and spawn rate is faster by 10% for
// each additional person in the map". Rate +10% per extra player means the
// respawn DELAY divides by (1 + 0.10 x extras): solo exactly x1, duo ~9%
// sooner, capped at 8 extras (x1.8 rate) so a stress room cannot spin the
// drip into a spam cannon.
//
// Leg 1 (deterministic): Math.random pinned + setTimeout captured, a real
// killMonster on a real spawned mob, fake same-map peers planted in net.
// Delays are asserted as RATIOS against the solo capture, so map/boost
// multipliers cancel and the test cannot rot when a map retunes.
// Leg 2 (live wire): two real clients through the real relay — the host's
// _lxCoopSameMapCount() reads 2 from actual peer broadcasts, and drops to 1
// when the guest leaves the map. That is the input the drip trusts.
// Run: node scripts/coop_spawn_rate_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = 0;
for (let p = 8811; p <= 8899 && !PORT; p++) if (await free(p)) PORT = p;
const PAGE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
// mp/server.mjs serves the repo root AND the ws relay on one port
const server = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')],
  { stdio: 'ignore', env: { ...process.env, PORT: String(PORT) }, cwd: path.join(ROOT, 'mp') });
await new Promise((r) => setTimeout(r, 2000));

// Prefer a real Chrome like the co-op cert does - repeated context creation
// under the msedge channel proved crashy on this machine (browser died
// mid-run on three baseline attempts, never on Chrome).
import('node:fs').then(() => {});
const { existsSync: _ex } = await import('node:fs');
const _EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && _ex(p));
const browser = await chromium.launch({
  channel: _EXE ? undefined : 'msedge',
  executablePath: _EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 190) });

async function boot(name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
  page._errs = errs;
  await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function', null, { timeout: 120000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
  await page.fill('#hero-name-input', name);
  await page.evaluate(() => {
    const m = document.getElementById('class-select-modal');
    for (const el of m.querySelectorAll('button,div,li')) {
      if (el.children.length > 3) continue;
      if (getComputedStyle(el).display === 'none') continue;
      if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
    }
  });
  await page.click('#cs-nav-next').catch(() => {});
  await page.waitForTimeout(2500);
  return page;
}

// ---- Leg 1: deterministic delay capture ------------------------------------
const A = await boot('SpawnRate');
const leg1 = await A.evaluate(async () => {
  const out = { haveHelper: typeof _lxCoopSameMapCount === 'function',
    dripPatched: typeof killMonster === 'function' && killMonster.toString().includes('_coopSpawnMul') };
  if (!out.haveHelper) return out;
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1500));
  game.paused = false;
  player.level = 60; player._god = true;

  const measure = (fakePeerCount) => {
    // plant same-map peers the way the wire would
    const now = performance.now();
    const peers = {};
    for (let i = 0; i < fakePeerCount; i++) peers['fp' + i] = { map: game.currentMap, _last: now };
    const netBak = { connected: net.connected, peers: net.peers, isHost: net.isHost };
    net.connected = fakePeerCount > 0; net.peers = peers; net.isHost = false;
    // pin RNG + TRANSPARENTLY record timers scheduled during the synchronous
    // killMonster call only — unrelated repeaters (pumps, toasts elsewhere)
    // schedule constantly and polluted a global capture in the first draft.
    const rndBak = Math.random; Math.random = () => 0.5;
    const stBak = window.setTimeout;
    const cntBak = window._lxCoopSameMapCount;
    const captured = [];
    let inKill = false, markIdx = -1;
    // the drip is the ONE schedule whose delay is computed from the same-map
    // count: the wrapper marks the moment the drip reads the count, and the
    // first timer scheduled after that mark is the drip - no magnitude
    // guessing against unrelated timers that collide under a pinned RNG.
    window._lxCoopSameMapCount = function () { if (inKill) markIdx = captured.length; return cntBak(); };
    window.setTimeout = function (fn, d) { if (inKill) captured.push(d); return stBak(fn, d); };
    let delay = null, cnt = null;
    try {
      const _type = (game.mapData && game.mapData.spawns && game.mapData.spawns.find((sp) => sp && sp.type && !sp.boss) || {}).type
        || Object.keys(monsterTypes)[0];
      spawnMonster(500, 400, _type, false);
      const mm = game.monsters[game.monsters.length - 1];
      mm.currentHp = 1; mm.exp = 0; mm.mojicoins = 0;
      inKill = true; killMonster(mm); inKill = false;
      cnt = cntBak();
      delay = (markIdx >= 0 && markIdx < captured.length) ? captured[markIdx] : null;
    } finally {
      inKill = false;
      window.setTimeout = stBak; Math.random = rndBak; window._lxCoopSameMapCount = cntBak;
      net.connected = netBak.connected; net.peers = netBak.peers; net.isHost = netBak.isHost;
    }
    return { delay, cnt, all: captured.slice(0, 20) };
  };
  const r0 = measure(0), r1 = measure(1), r3 = measure(3), r20 = measure(20), r0b = measure(0);
  out.solo = r0.delay; out.duo = r1.delay; out.four = r3.delay; out.storm = r20.delay; out.soloAgain = r0b.delay;
  out.counts = [r0.cnt, r1.cnt, r3.cnt, r20.cnt, r0b.cnt];
  out.allDelays = { solo: r0.all, duo: r1.all, storm: r20.all };
  return out;
});
ok('the same-map counter exists', leg1.haveHelper);
if (leg1.haveHelper) {
  const near = (a, b, tol) => a != null && b != null && Math.abs(a / b - 1) < (tol || 0.02);
  ok('a respawn delay was captured for every scenario',
    [leg1.solo, leg1.duo, leg1.four, leg1.storm, leg1.soloAgain].every((d) => d != null),
    JSON.stringify(leg1));
  ok('solo is the unmodified baseline (repeatable)', near(leg1.solo, leg1.soloAgain),
    `solo ${leg1.solo} vs again ${leg1.soloAgain}`);
  ok('one extra player: delay / 1.1 (rate +10%)', near(leg1.duo, leg1.solo / 1.1),
    `duo ${leg1.duo}, expected ${(leg1.solo / 1.1).toFixed(1)}`);
  ok('three extra players: delay / 1.3 (rate +30%)', near(leg1.four, leg1.solo / 1.3),
    `four ${leg1.four}, expected ${(leg1.solo / 1.3).toFixed(1)}`);
  ok('twenty peers cap at 8 extras: delay / 1.8, not / 3.0', near(leg1.storm, leg1.solo / 1.8),
    `storm ${leg1.storm}, expected ${(leg1.solo / 1.8).toFixed(1)}`);
}

// ---- Leg 2: the live wire feeds the counter --------------------------------
const B = await boot('SpawnRateB');
const ROOM = 'spawnrate' + Math.floor(Math.random() * 1e6);
const join = (page, nm) => page.evaluate(({ ws, room, name }) => {
  try { mpConnect(ws, name, room); } catch (e) { return String(e); }   // signature: (url, name, room)
  return null;
}, { ws: `ws://localhost:${PORT}`, room: ROOM, name: nm });
await join(A, 'HostP'); await join(B, 'GuestP');
await A.waitForTimeout(1500); await B.waitForTimeout(1500);
// both to the same map; drive the outbound tick like the cert does (headless rAF throttling)
for (const pg of [A, B]) {
  await pg.evaluate(() => {
    loadMap('forest', 300);
    if (!window.__pump) window.__pump = setInterval(() => { try { if (typeof _mpTick === 'function') _mpTick(); } catch (e) {} }, 100);
  });
}
await A.waitForTimeout(2500);
const wire = await A.evaluate(() => ({
  connected: !!net.connected, peers: Object.keys(net.peers || {}).length,
  count: (typeof _lxCoopSameMapCount === 'function') ? _lxCoopSameMapCount() : -1,
  map: game.currentMap,
}));
ok('two clients connected over the real relay', wire.connected && wire.peers >= 1, JSON.stringify(wire));
ok('the host counts 2 players in its map from live peer broadcasts', wire.count === 2, JSON.stringify(wire));
await B.evaluate(() => loadMap('town', 300));
await A.waitForTimeout(2500);
const wire2 = await A.evaluate(() => ({ count: (typeof _lxCoopSameMapCount === 'function') ? _lxCoopSameMapCount() : -1 }));
ok('the guest leaving the map drops the count back to 1', wire2.count === 1, JSON.stringify(wire2));
ok('no page errors on either client', A._errs.length === 0 && B._errs.length === 0,
  (A._errs[0] || '') + ' ' + (B._errs[0] || ''));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
