// v0.30.414 test: live-save signature + verdicts, and co-op guest boss shards.
//   node scripts/save_guard_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || FILE;
const PORT = Number(process.argv[3] || process.env.PORT || 11071);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Guard');
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

const res = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const ok = (n, c, extra) => out.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 160) });
  window._prologueActive = false; window._prologuePending = false;
  player.level = 60; player._god = true;
  player.setshards = 1234; player.mojicoins = 55555; player.bankBalance = 777;

  // ---- 1. flush signs; verify ok; cost ----
  const t0 = performance.now();
  _flushSaveStateNow();
  const flushMs = performance.now() - t0;
  const raw = localStorage.getItem(SAVE_KEY);
  const s = JSON.parse(raw);
  ok('flush writes a signature', typeof s.sig === 'string' && s.sig.length === 64, s.sig && s.sig.slice(0, 12));
  ok('signature verifies', _lxLocalSaveVerdict(s) === 'ok', _lxLocalSaveVerdict(s));
  ok('flush cost under 12 ms (size ' + raw.length + ')', flushMs < 12, flushMs.toFixed(2) + ' ms');
  const mark = JSON.parse(localStorage.getItem(SAVE_KEY + '_verified'));
  ok('verified marker records the money', mark && mark.setshards === 1234 && mark.mojicoins === 55555 && mark.bankBalance === 777, JSON.stringify(mark));

  // ---- 1b. a 1.5 MB cosmetic blob in the save must not slow the signature ----
  const _lookBak = player.look;
  player.look = Object.assign({}, player.look || {}, { _bigPaint: 'x'.repeat(1500000) });
  const t1 = performance.now(); _flushSaveStateNow(); const bigMs = performance.now() - t1;
  const bigLen = (localStorage.getItem(SAVE_KEY) || '').length;
  ok('signing ignores a 1.5 MB cosmetic blob: flush under 25 ms (size ' + bigLen + ')', bigLen > 1500000 && bigMs < 25, bigMs.toFixed(1) + ' ms');
  ok('blob save still verifies', _lxLocalSaveVerdict(JSON.parse(localStorage.getItem(SAVE_KEY))) === 'ok');
  player.look = _lookBak; _flushSaveStateNow();
  localStorage.setItem(SAVE_KEY, raw);
  // ---- 2. edited save -> rolled back to the verified copy in the marker (anticheat; was: currencies reset, edits kept) ----
  const edited = JSON.parse(raw); edited.player.setshards = 999999; edited.player.mojicoins = 5e9;
  ok('edited save fails verification', _lxLocalSaveVerdict(edited) === 'bad', _lxLocalSaveVerdict(edited));
  localStorage.setItem(SAVE_KEY, JSON.stringify(edited));
  player.setshards = -1; player.mojicoins = -1; player.level = 1;
  const l1 = loadState();
  ok('edited save still loads, rolled back to the verified copy', l1 === true && player.level === 60, `loaded=${l1} lv=${player.level}`);
  ok('edited save: the money is the last verified, not the edit (a login bonus may land on top)', player.setshards === 1234 && player.mojicoins >= 55555 && player.mojicoins < 60000 && (player.bankBalance || 0) === 777, `${player.setshards}/${player.mojicoins}/${player.bankBalance}`);
  ok('verdict recorded', game._saveVerdict === 'restored', game._saveVerdict);

  // ---- 3. stripped signature -> rolled back to the verified copy (anticheat; was: money capped at the last verified) ----
  const stripped = JSON.parse(raw); delete stripped.sig; stripped.player.setshards = 50000; stripped.player.mojicoins = 90000;
  localStorage.setItem(SAVE_KEY, JSON.stringify(stripped));
  loadState();
  ok('stripped signature: shards back to the last verified 1234', player.setshards === 1234 && game._saveVerdict === 'restored', player.setshards + ' ' + game._saveVerdict);
  ok('stripped signature: coins back to the last verified 55555', player.mojicoins >= 55555 && player.mojicoins < 60000, player.mojicoins);
  ok('stripped signature: a lowered value is rolled back too (a stripped save is an edited save)', (() => {
    const low = JSON.parse(raw); delete low.sig; low.player.setshards = 100;
    localStorage.setItem(SAVE_KEY, JSON.stringify(low)); loadState(); return player.setshards === 1234;
  })(), player.setshards);

  // ---- 4. unsigned, no marker: NOT loaded (bughunt D2 closed the legacy allowance: it let delete-sig + delete-marker + delete-_cdCarry pass an edited save) ----
  localStorage.removeItem(SAVE_KEY + '_verified');
  const legacy = JSON.parse(raw); delete legacy.sig; delete legacy.player._cdCarry; legacy.player.setshards = 4321;
  localStorage.setItem(SAVE_KEY, JSON.stringify(legacy));
  const legacyLoaded = loadState();
  ok('legacy unsigned save (no marker, older than signing) is refused: it cannot be told from an edited one (bughunt D2)', legacyLoaded === false && player.setshards !== 4321, `${legacyLoaded} ${player.setshards} ${game._saveVerdict}`);
  const modern = JSON.parse(raw); delete modern.sig; modern.player.setshards = 4321; localStorage.removeItem(SAVE_KEY + '_verified');
  localStorage.setItem(SAVE_KEY, JSON.stringify(modern));
  ok('a stripped MODERN save with the marker deleted is not loaded (anticheat)', loadState() === false, 'loaded');

  // ---- 5. good save round-trips through the secure export payload ----
  localStorage.setItem(SAVE_KEY, raw);
  const payload = JSON.parse(_lxSecureSavePayload(raw, Date.now()));
  ok('secure export wraps the signed save intact', _lxLocalSaveVerdict(JSON.parse(payload.data)) === 'ok');
  loadState();
  ok('good save reloads with money intact', player.setshards === 1234 && player.mojicoins === 55555, `${player.setshards}/${player.mojicoins}`);

  // ---- 6. co-op guest boss shards ----
  loadMap('krookThrone'); await wait(1000); game.paused = false;
  game._bossKills = {};
  // `net` is a script-scoped binding, not a window property: mutate the real
  // object's fields and restore them afterwards.
  const _saved = { isHost: net.isHost, hostId: net.hostId, connected: net.connected, myId: net.myId, ws: net.ws, peers: net.peers };
  net.isHost = false; net.hostId = 1; net.connected = true; net.myId = 2; net.ws = { readyState: 1, send() {} }; net.peers = net.peers || {};
  // v0.30.862 co-op kill trust: a guest pays only for a monster it mirrored itself, of the same type. Each frame below names
  // a boss the guest has mirrored, so every 0 here comes from the rule that check is about, not from a missing mirror.
  const mirror = (u, tp) => { if (_coopFindByUid(u)) return; const m = spawnMonster(700, 300, tp, true, false); if (m) { m.uid = u; m._coopMirror = true; } };
  const send = (u, extra) => {
    mirror(u, (extra && extra.tp) || 'kingKrook');
    net._bossPaid = null;   // bughunt coop-6: the same boss is not paid twice inside 30 s (checked in bughunt_coop_trust_test); these kills come back to back to read the LADDER, so forget the clock
    const before = player.setshards | 0;
    _coopApplyKill(Object.assign({ t: 'kill', id: 1, u, e: 0, c: 0, x: 700, y: 300, map: game.currentMap, tp: 'kingKrook', b: 1, bl: 50 }, extra || {}));
    return (player.setshards | 0) - before;
  };
  // v0.30.1612 a guest kill now counts toward the early milestones (_lxCoopKillCredit); this Lv 50 test hero has never been checked, so settle them first or the first kill pays all of their Setshards at once
  if (typeof _checkEarlyHooks === 'function') _checkEarlyHooks();
  const g1 = send(9001), g2 = send(9002), g3 = send(9002), g4 = send(9003, { bx: 1 }), g5 = send(9004, { il: 1 }), g6 = send(9005, { id: 7 }), g7 = send(9006, { map: 'town' });
  ok('guest: first boss kill pays level-squared', g1 === 2500, g1);
  ok('guest: second kill pays the 40% ladder step', g2 === 1000, g2);
  ok('guest: redelivered frame pays nothing', g3 === 0, g3);
  ok('guest: bx=1 (echo/expedition/twin) pays nothing', g4 === 0, g4);
  ok('guest: illusion kill pays nothing', g5 === 0, g5);
  ok('guest: non-host sender ignored', g6 === 0, g6);
  ok('guest: other-map kill ignored', g7 === 0, g7);
  const z1 = send(9101, { tp: 'zodiac_aries', zs: 'aries', bl: 70 }), z2 = send(9102, { tp: 'zodiac_aries', zs: 'aries', bl: 70 });
  ok('guest: zodiac ladder 100% then 50%', z1 === 4900 && z2 === 2450, `${z1}/${z2}`);
  Object.assign(net, _saved);
  return out;
});
await browser.close(); server.kill();
let fails = 0;
for (const r of res) { console.log((r.pass ? 'PASS ' : 'FAIL ') + r.n + (r.extra ? '  [' + r.extra + ']' : '')); if (!r.pass) fails++; }
console.log(`${res.length - fails}/${res.length} passed`);
process.exit(fails ? 1 : 0);
