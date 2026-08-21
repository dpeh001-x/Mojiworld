// The game does not commence until every sprite the first gameplay frame
// draws has finished loading (v0.29.738 commence gate).
// Throttled boot (25 Mbps CDP emulation): the gate must HOLD the overlay at
// the Continue click, re-kick starved loads, and release only at zero
// pending. Unthrottled boot: no added latency (<800ms click-to-fade).
// Run: node scripts/boot_commence_gate_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire('C:/Users/dpeh0/Mojiworld/package.json');
const { chromium } = require('playwright-core');
process.chdir('C:/Users/dpeh0/Mojiworld');
const PORT = 9186;
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const srv = spawn(process.execPath, ['serve.js', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const b = await chromium.launch({ channel: 'msedge', headless: true });
const res = []; const ok = (n, c, x) => res.push({ n, pass: !!c, x: String(x ?? '') });

// ── save blob (fast) ────────────────────────────────────────────────────────
let saveBlob;
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(11000);
  saveBlob = await p.evaluate(() => {
    player.cls = 'warrior'; player.job = 'berserker'; player.master = 'warlord';
    player.level = 85; player.hp = getMaxHp();
    player.look = player.look || {}; player.look.hair = 'ponytail'; player.look.name = 'ProbeHero';
    window._prologuePending = false; window._prologueActive = false; game._resetting = false;
    _flushSaveStateNow();
    return localStorage.getItem('levelx_save_v1');
  });
  await p.close();
  if (!saveBlob) throw new Error('no save blob');
}

const boot = async (mbps) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.addInitScript((blob) => { try { localStorage.setItem('levelx_save_v1', blob); } catch (e) {} }, saveBlob);
  if (mbps) {
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 40,
      downloadThroughput: mbps * 1024 * 1024 / 8, uploadThroughput: 2 * 1024 * 1024 / 8,
    });
  }
  const logs = [];
  p.on('console', (m) => { const t = m.text(); if (/\[boot\]|\[BootGate\]/i.test(t)) logs.push(t); });
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await p.waitForFunction(() => {
    const a = document.getElementById('lo-auth');
    return a && !a.hidden;
  }, null, { timeout: 140000 });
  const clickT = Date.now();
  const atClick = await p.evaluate(() => {
    const pend = (window._lxSpriteWatch || []).filter(im => im && im.src && !im.complete).length;
    const total = (window._lxSpriteWatch || []).length;
    const bs = [...document.querySelectorAll('#lo-auth button')];
    (bs.find(x => /continue/i.test(x.textContent)) || bs[0]).click();
    return { pend, total };
  });
  // wait for the overlay to actually go (game commences)
  await p.waitForFunction(() => !document.getElementById('loading-overlay')
    || document.getElementById('loading-overlay').classList.contains('fade'), null, { timeout: 260000 });
  const holdMs = Date.now() - clickT;
  const atFade = await p.evaluate(() => {
    const watch = window._lxSpriteWatch || [];
    const pend = watch.filter(im => im && im.src && !im.complete).length;
    let hairReady = null, crestOk = null;
    try {
      const hid = _migrateHairId(player.look && player.look.hair);
      hairReady = _lxHairReady(LX_HAIR && LX_HAIR[hid]);
    } catch (e) { hairReady = 'err:' + e.message; }
    try {
      const ci = document.getElementById('hud-class-icon');
      crestOk = !!(ci && ci.complete && ci.naturalWidth > 0);
    } catch (e) { crestOk = 'err:' + e.message; }
    return { pend, total: watch.length, hairReady, crestOk };
  });
  await p.close(); await ctx.close();
  return { atClick, holdMs, atFade, logs };
};

// ── throttled: the gate must hold, then release at zero pending ─────────────
const slow = await boot(25);
console.log('THROTTLED 25 Mbps:', JSON.stringify(slow));
ok('throttled boot has sprites still pending at the Continue click', slow.atClick.pend > 0,
   slow.atClick.pend + '/' + slow.atClick.total + ' pending');
ok('the gate HELD the overlay (game did not commence immediately)', slow.holdMs > 800, slow.holdMs + 'ms hold');
ok('at commence, ZERO watched sprites are unfinished', slow.atFade.pend === 0, slow.atFade.pend + ' left of ' + slow.atFade.total);
ok('the hero hair sprite is render-ready at commence', slow.atFade.hairReady === true, slow.atFade.hairReady);
ok('the HUD class crest is loaded at commence', slow.atFade.crestOk === true, slow.atFade.crestOk);
ok('the gate logged its release', slow.logs.some(l => /commence gate/.test(l)),
   slow.logs.filter(l => /commence gate/.test(l)).join(' | '));
ok('the BootGate rescue never force-faded under the hold', !slow.logs.some(l => /BootGate/.test(l)),
   slow.logs.filter(l => /BootGate/.test(l)).join(' | ') || 'no rescue fired');

// ── unthrottled: no added latency ───────────────────────────────────────────
const fast = await boot(0);
console.log('UNTHROTTLED:', JSON.stringify(fast));
ok('fast boot commences without a hold (<800ms click-to-fade)', fast.holdMs < 800, fast.holdMs + 'ms');
ok('fast boot also commences with zero unfinished sprites', fast.atFade.pend === 0,
   fast.atFade.pend + ' left of ' + fast.atFade.total);

for (const r of res) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.x ? '  (' + r.x + ')' : ''}`);
console.log(`${res.filter(r => r.pass).length}/${res.length} passed`);
await b.close(); srv.kill();
process.exit(res.some(r => !r.pass) ? 1 : 0);
