// Co-op and skills findings from the second audit round.
//   1. %-of-maxHp boss attacks read player.maxHp (the raw class base) rather than getMaxHp(),
//      so a guest took roughly half the share the host modelled.
//   2. A socket drop clears net.peers, which makes _coopActive() false, which skipped the
//      orphan-mirror purge — the host's mirrors then ran under full local AI and paid a
//      complete solo boss reward to a guest who did not tank it.
//   3. Quickening could zero Elemental Apotheosis's cooldown on its last charge, doubling it.
//   4. The compact rank row printed a hardcoded 5%/rank curve for skills not on that curve.
//
//   node scripts/coop_skills_audit_test.mjs      MOJI_SERVE_ROOT / PORT override
//
// Negative control: all four fail on v0.30.511.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10961); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof getMaxHp === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(700);
    game.paused = false;
    const o = {};

    // ---- 1. a fraction hit costs the same share of the REAL pool ------------
    applyClass('warrior');
    player.level = 50; player._god = false;
    // _coopApplyBossHit fails CLOSED behind five guards. Stand up a guest that satisfies them,
    // or the handler returns early and the measurement is a vacuous zero.
    const _realFollow = window._coopFollowingHost;
    const fracHit = async (bonusHp) => {
      player.mods = player.mods || {}; player.mods.maxHp = bonusHp;
      if (typeof invalidateEquipBonusCache === 'function') invalidateEquipBonusCache();
      if (typeof refreshGearCache === 'function') refreshGearCache();
      const real = getMaxHp();
      player.hp = real;
      player._god = false; player.invulnerable = 0; player.blockTimer = 0; player.lastHitTime = -9999;
      net.isHost = false; net.hostId = 7; net.myId = 8; net.connected = true;
      net.peers = { 7: { map: game.currentMap }, 8: {} };
      try { window._coopFollowingHost = () => true; } catch (e) {}
      const before = player.hp;
      let err = null;
      try { _coopApplyBossHit({ fr: 0.5, id: 7, map: game.currentMap, d: 0, r: 0 }); }
      catch (e) { err = String(e.message).slice(0, 80); }
      await sleep(60);
      try { window._coopFollowingHost = _realFollow; } catch (e) {}
      net.isHost = true; net.hostId = null; net.connected = false; net.peers = {};
      return { base: player.maxHp, real, lost: before - player.hp, err };
    };
    // Same build, two different REAL pools and one identical base pool. A fraction read off the
    // base cannot tell these apart; a fraction read off getMaxHp scales between them.
    o.small = await fracHit(0);
    o.big = await fracHit(3000);
    o.pools = { base: o.small.base, real: o.small.real, real2: o.big.real, diverge: o.big.real > o.small.real * 2 };
    o.scaled = o.small.lost > 0 ? +(o.big.lost / o.small.lost).toFixed(2) : 0;
    o.lost = o.big.lost;
    player.mods.maxHp = 0;
    if (typeof invalidateEquipBonusCache === 'function') invalidateEquipBonusCache();
    if (typeof refreshGearCache === 'function') refreshGearCache();
    player.hp = getMaxHp();

    // ---- 2. a disconnect drops the host's mirrors ---------------------------
    game.monsters.length = 0;
    for (let i = 0; i < 3; i++) {
      const m = spawnMonster(player.x + 120 + i * 40, player.y, 'slime', false);
      if (m) m._coopMirror = true;
    }
    o.mirrorsBefore = (game.monsters || []).filter((m) => m && m._coopMirror).length;
    // the exact shape of a drop: connection gone, peers cleared
    try {
      net.connected = false; net.peers = {};
      if (typeof _lxCoopDropMirrors === 'function') _lxCoopDropMirrors();
    } catch (e) {}
    o.mirrorsAfterFlagsOnly = (game.monsters || []).filter((m) => m && m._coopMirror).length;
    game.monsters.length = 0;
    return o;
  });

  // The onclose handler cannot be invoked without a live socket, so the disconnect purge and the
  // two skill fixes are asserted on the served source — the behavioural half above pins the
  // fraction maths, which is the one that changes a number a player can feel.
  const src = await (await fetch(`http://localhost:${PORT}/mojiworld_game.html`)).text();
  const fracBase = (src.match(/isFrac \? Math\.floor\(player\.maxHp \*/g) || []).length;
  const fracReal = (src.match(/isFrac \? Math\.floor\(\(typeof getMaxHp/g) || []).length;
  const dropOnClose = /_mm\._coopMirror/.test(src);
  const apoExcluded = /id !== 'shinobi_seal' && id !== 'elementalist_ult'/.test(src);
  const rankCurve = /const dmgPct = \(typeof _formatRankPct === 'function'\)/.test(src);

  console.log(JSON.stringify(r, null, 1).slice(0, 900));
  console.log(`static: fracOnBase=${fracBase} fracOnReal=${fracReal} dropOnClose=${dropOnClose} apoExcluded=${apoExcluded} rankCurve=${rankCurve}\n`);

  ok('the two runs really do differ in REAL pool but not in base', r.pools.diverge === true, JSON.stringify(r.pools));
  ok('the fraction hit actually landed (the guards were satisfied)', r.lost > 0, 'lost=' + r.lost + (r.small.err ? ' err=' + r.small.err : ''));
  // The discriminator: raising getMaxHp while leaving player.maxHp alone must raise the hit. A
  // fraction taken off the base pool is blind to that and returns the same number both times —
  // which is what v0.30.511 does. "lost > base pool" does NOT discriminate, because _diffDmg
  // amplifies by up to 6x at this level and half the base pool clears that bar on either build.
  ok('a %-maxHp hit scales with the REAL pool, not the base', r.scaled >= 2,
    `x${r.scaled} (small pool ${r.small.real} -> ${r.small.lost}, big pool ${r.big.real} -> ${r.big.lost})`);
  ok('no fraction site still reads the raw base pool', fracBase === 0, fracBase + ' site(s)');
  ok('both fraction sites read getMaxHp', fracReal === 2, fracReal + ' site(s)');
  ok('a socket drop purges the host mirrors', dropOnClose === true);
  ok('Elemental Apotheosis is excluded from Quickening', apoExcluded === true);
  ok('the rank row asks the curve instead of restating it', rankCurve === true);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
