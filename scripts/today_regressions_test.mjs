// v0.30.x — Four regressions found by a review of the same day's fix commits.
//   1. _lxSteamNavPad folded the stick with the browser convention; Steam Input reports +Y UP.
//   2. _lxOnHitProcs returned the monster's TOTAL timers, which the host had already mirrored
//      onto the guest - so every guest hit echoed the host's freeze back and re-maxed it.
//   3. The Duo Trial payout required a fresh presence packet on the exact kill frame.
//   4. _lxRestoreUltCd restored the raw cd, ignoring cooldown reduction.
//   node scripts/today_regressions_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11281);
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
await page.fill('#hero-name-input', 'Rg');
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
  // 1. Steam stick: +Y is UP
  if (typeof _lxSteamNavPad === 'function') {
    const up = _lxSteamNavPad({ _moveY: 0.9 }), dn = _lxSteamNavPad({ _moveY: -0.9 });
    out.stickUpIsUp = !!(up && _lxPadBtn(up, 12) && !_lxPadBtn(up, 13));
    out.stickDownIsDown = !!(dn && _lxPadBtn(dn, 13) && !_lxPadBtn(dn, 12));
  }
  // 2. procs report the delta, not the mirrored total
  const m = { freezeTimer: 900, stunTimer: 400, currentHp: 100, x: 0, y: 0, w: 10, h: 10 };
  const pr = (typeof _lxOnHitProcs === 'function') ? _lxOnHitProcs(m, 1, 'slash') : null;
  out.procDeltaOnly = !!(pr && pr.fz === 0 && pr.st === 0);
  // 4. restored cd honours cooldown reduction
  const def = SKILLS.marksman_oneshot;
  player.skillCooldowns = player.skillCooldowns || {};
  player.skillCooldowns.marksman_oneshot = 450; player._deadeyeUntil = performance.now() + 5000;
  _lxRestoreUltCd();
  const want = def.cd * getCdrMult() * JOB_CD_MUL;
  out.restoredCd = player.skillCooldowns.marksman_oneshot; out.wantCd = want;
  out.cdHonoursCdr = Math.abs(out.restoredCd - want) < 0.5;
  player._deadeyeUntil = 0; player.skillCooldowns.marksman_oneshot = 0;
  return out;
});
const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const seenLatch = html.includes('m._duoPartnerSeen = true') && html.includes('m._duoPartnerSeen || typeof _coopPeerAliveOnMyMap');
console.log(JSON.stringify({ ...r, seenLatch }));
const checks = [
  ['Steam stick up moves the menu UP', r.stickUpIsUp === true],
  ['Steam stick down moves the menu DOWN', r.stickDownIsDown === true],
  ['a hit with no proc reports zero status, not the mirrored total', r.procDeltaOnly === true],
  ['a partner who hit the boss counts at kill time', seenLatch === true],
  ['a restored ultimate cooldown honours cooldown reduction', r.cdHonoursCdr === true, r.restoredCd + ' vs ' + r.wantCd],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
