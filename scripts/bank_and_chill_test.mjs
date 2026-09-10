// v0.30.x — Two silent state bugs, both found by audit, both invisible in play
// until the damage is already done.
//
//   1. The banker's dialog read `_interestEarned`, an identifier declared nowhere
//      in the codebase. Reading it throws, openNPC is called unguarded, so the
//      whole banker interaction died before Deposit/Withdraw were pushed — coins
//      paid into the Mojibank could never be withdrawn, while the death haircut
//      and the respec fee kept billing that balance.
//   2. player.freezeTimer was written (Octobaby's Eight Moods) and never ticked:
//      every `-= dt` on a freeze timer was on the MONSTER field. The chill icon
//      stuck for the rest of the run and the next cure press burned a Remedy.
//
//   node scripts/bank_and_chill_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11223);
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
await page.fill('#hero-name-input', 'Bnk');
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

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {};

  // ---- 1. the banker must open, and must offer a way back out of the bank
  player.mojicoins = 50000;
  player.bankBalance = 400000;
  player.bankAccrueMs = 0;
  const banker = { name: 'Felina', role: 'banker', x: player.x, y: player.y };
  out.bankThrew = null;
  try {
    openNPC(banker);
    out.bankThrew = false;
  } catch (e) {
    out.bankThrew = true;
    out.bankErr = String(e && e.message).slice(0, 120);
  }
  // read the option list the dialog actually rendered
  const txt = (document.getElementById('dialog-options') || document.body).textContent || '';
  out.hasWithdraw = /withdraw/i.test(txt);
  out.hasDeposit  = /deposit/i.test(txt);
  try { if (typeof closeDialog === 'function') closeDialog(); } catch (e) {}

  // ---- 2. a chill must wear off on its own
  player.freezeTimer = 1400;
  const before = player.freezeTimer;
  await wait(2500);                      // comfortably longer than 1400 ms
  out.chillBefore = before;
  out.chillAfter = player.freezeTimer | 0;
  out.ailmentStillActive = (typeof _hasActiveAilment === 'function') ? !!_hasActiveAilment() : null;
  player.freezeTimer = 0;
  return out;
});

console.log(JSON.stringify(r));
const checks = [
  ['the banker dialog opens without throwing', r.bankThrew === false, r.bankErr || ''],
  ['...and offers Withdraw, so banked coins can come back out', r.hasWithdraw === true],
  ['...and still offers Deposit', r.hasDeposit === true],
  ['a chill wears off by itself', r.chillBefore === 1400 && r.chillAfter === 0, 'after=' + r.chillAfter],
  ['...and the ailment flag clears with it', r.ailmentStillActive === false],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
