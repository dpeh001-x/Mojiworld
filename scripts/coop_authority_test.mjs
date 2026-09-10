// v0.30.x — THE HOST JUDGES THE FIGHT THE SAME WAY FOR EVERYONE.
// Five co-op findings from a parallel audit, all "guests play by a different rulebook":
//   1. _coopHostApplyDamage had no ward gate (the only "ward" in it was the word
//      "forward" in a comment), so a guest's hit went through a raised ward at 100%.
//   2. The guest branch of hitMonster returned before the on-hit procs, so a guest's
//      freeze / chain / stun affixes did nothing. They now ride the damage packet.
//   3. A partner going down on ANY map failed the Duo Trial (only the toast was map-gated).
//   4. _coopMirror was never cleared, so a promoted host's Shadow Dance skipped the boss.
//   5. The Duo Trial counted every peer in the room, on any map, stale ones included.
// Exercised on ONE client posing as host, with a fake live peer on its map.
//
//   node scripts/coop_authority_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11247);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Coop');
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

const r = await page.evaluate(() => {
  const out = {};
  // the boot map has no mobs: stand in a boss arena and spawn a real boss, the way
  // arbiter_attack_sets_test does, BEFORE posing as host (loadMap resets the roster)
  try { loadMap('tower_b5', 300); } catch (e) {}
  const m = (typeof spawnMonster === 'function') ? spawnMonster(player.x + 300, player.y, 'towerArbiter', true) : null;
  if (m) { m._bigMeleeCd = 99999; m._columnCd = 99999; }   // keep his live AI out of the measurements

  // pose as host with one live partner on this map
  net.myId = 5; net.connected = true; net.ws = { readyState: 1, send() {} };
  net.peers = { '9': { id: 9, _last: performance.now(), map: game.currentMap, hp: 100 } };
  net.isHost = true; net.hostId = 5;
  out.coopActive = (typeof _coopActive === 'function') ? _coopActive() : null;
  out.partnerOnMap = (typeof _coopPeerAliveOnMyMap === 'function') ? _coopPeerAliveOnMyMap() : null;

  out.hasMonster = !!(m && m.currentHp > 0);
  if (m) {
    m.uid = 777; m.isBoss = true; m.maxHp = 100000; m.currentHp = 100000;
    m.zodiacSign = null; m._cancerShellClosed = false; m._virgoChanneling = false; m._libraShield = false;
    m.invulnerable = 0; m._burrowed = false; m._underground = false; m._shroudUntil = 0; m._stagger = 0; m._dirOpenT = 0;

    // 1) a raised ward: the host lands the guest's hit for 1 and feeds the break gauge
    m._wardUntil = (game.time | 0) + 600; m._wardGauge = 0; m._wardBreakUntil = 0;
    let hp0 = m.currentHp;
    _coopHostApplyDamage(777, 5000, false, 'slash');
    out.wardedDrop = hp0 - m.currentHp;
    out.gaugeFed = (m._wardGauge || 0) > 0;

    // ...and no ward: the full number lands
    m._wardUntil = 0; m._wardGauge = 0; m._wardBreakUntil = 0;
    hp0 = m.currentHp;
    _coopHostApplyDamage(777, 5000, false, 'slash');
    out.unwardedDrop = hp0 - m.currentHp;

    // 2) the guest's affix procs arrive in the packet and are applied by the host
    m.freezeTimer = 0; m.stunTimer = 0;
    _coopHostApplyDamage(777, 10, false, 'slash', { fz: 900, st: 400 });
    out.freezeApplied = (m.freezeTimer | 0) >= 900;
    out.stunApplied = (m.stunTimer | 0) >= 400;
    out.procHelper = (typeof _lxOnHitProcs === 'function');
    if (out.procHelper) { m.stunTimer = 0; const pr = _lxOnHitProcs(m, 100, 'power'); out.powerStuns = !!(pr && pr.st >= 400); }

    // 3) shared fate is shared on THIS map only
    m._duoTrial = true; m._duoTrialFailed = false;
    _coopApplyDown({ id: 9, map: '__elsewhere__', x: 0, y: 0, rev: 1 });
    out.failedCrossMap = !!m._duoTrialFailed;
    net.peers['9']._downed = false;
    _coopApplyDown({ id: 9, map: game.currentMap, x: 0, y: 0, rev: 1 });
    out.failedSameMap = !!m._duoTrialFailed;
    m._duoTrial = false; m._duoTrialFailed = false; net.peers['9']._downed = false;

    // 4) becoming host sheds the mirror flag
    m._coopMirror = true; net.isHost = false; net.hostId = 9;
    _coopRecomputeHost();                  // id 5 < 9: we are elected
    out.becameHost = !!net.isHost;
    out.mirrorCleared = !m._coopMirror;
    delete m.uid; m.isBoss = false;
  }
  // put the world back
  net.isHost = true; net.hostId = null; net.peers = {}; net.connected = false; net.ws = null; net.myId = null;
  return out;
});

// 5) the summon gate and the status mirror are structural - assert them in the served source
const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const summonGated = html.includes("_coopActive() && typeof _coopPeerAliveOnMyMap === 'function' && _coopPeerAliveOnMyMap()) {");
const statusMirrored = html.includes('_e.fz = Math.min(3000, m.freezeTimer | 0)') && html.includes('m.freezeTimer = (e.fz > 0)');

console.log(JSON.stringify({ ...r, summonGated, statusMirrored }));
const checks = [
  ['harness: co-op posed as active with a live partner on this map', r.coopActive === true && r.partnerOnMap === true && r.hasMonster === true],
  ['a warded boss takes 1 from a guest, not the full hit', r.wardedDrop === 1, 'dropped ' + r.wardedDrop],
  ['...and the guest\'s hit feeds the break gauge', r.gaugeFed === true],
  ['an unwarded boss still takes the full hit', r.unwardedDrop === 5000, 'dropped ' + r.unwardedDrop],
  ['a guest\'s freeze and stun procs land through the packet', r.freezeApplied === true && r.stunApplied === true],
  ['the lifted proc helper exists and Power Strike stuns', r.procHelper === true && r.powerStuns === true],
  ['a partner downed on ANOTHER map does not fail the Duo Trial', r.failedCrossMap === false],
  ['...but a partner downed on THIS map still does', r.failedSameMap === true],
  ['being elected host sheds the mirror flag', r.becameHost === true && r.mirrorCleared === true],
  ['the Duo Trial summon needs a live partner on this map', summonGated === true],
  ['freeze / stun are mirrored host -> guest', statusMirrored === true],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
