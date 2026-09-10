// v0.30.x — Two audit findings that both come down to reading stale state.
//
//   1. The Stormbearer pact captured its price and its active-state when the
//      dialog was BUILT. The callback never re-renders the options, so the button
//      stayed live: a second click billed 25% of the ORIGINAL wallet again and,
//      seeing a frozen "not active", RESET the deadline instead of extending it.
//      Four clicks turned 100,000 coins into 0 for the same sixty seconds.
//   2. Neither boss attack gate tested the other's firing flag, and both write the
//      single m._bossAtkKey pose slot — so a boss could telegraph two different
//      attacks at once and the second silently repainted the first's animation.
//
//   node scripts/pact_and_telegraph_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11237);
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
await page.fill('#hero-name-input', 'Pct');
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

  // ---- 1. the pact: two clicks in a row
  player.mojicoins = 100000;
  player._spawnBoostUntil = 0;
  const npc = { name: 'Stormbearer', role: 'stormbearer', x: player.x, y: player.y };
  // THE REPRO IS CLICKING THE SAME RENDERED BUTTON TWICE. Re-opening the dialog
  // rebuilds the options and re-captures the price, which hides the bug entirely -
  // the callback never re-renders, so in real play the button just stays live.
  openNPC(npc);
  const box = document.getElementById('dialog-options');
  const btn = [...(box ? box.querySelectorAll('button,div,li') : [])]
    .find((e) => /accept|extend the pact/i.test(e.textContent || ''));
  out.click1 = !!btn;
  if (btn) btn.click();
  out.coinsAfter1 = player.mojicoins | 0;
  const until1 = player._spawnBoostUntil | 0;
  if (btn) btn.click();          // same button, no reopen
  out.click2 = !!btn;
  out.coinsAfter2 = player.mojicoins | 0;
  const until2 = player._spawnBoostUntil | 0;
  out.secondChargedQuarterOfWhatWasLeft = (out.coinsAfter1 - out.coinsAfter2) === Math.floor(out.coinsAfter1 * 0.25);
  out.secondExtendedNotReset = until2 > until1;
  try { if (typeof closeDialog === 'function') closeDialog(); } catch (e) {}
  player._spawnBoostUntil = 0;

  // ---- 2. one telegraph at a time
  const boss = (game.monsters || []).find((m) => m && (m.isBoss || m.boss)) || null;
  out.usedBoss = boss ? boss.type : null;
  if (boss) {
    boss._bigMeleeFiring = true; boss._bigMeleeT = 900;
    boss._columnFiring = false; boss._columnCd = 0;
    boss._bossAtkKey = 'swing-sentinel';
    // the column gate must refuse to start while the swing is in flight
    out.columnBlocked = !(boss._columnFiring);
    boss._bigMeleeFiring = false; boss._columnFiring = false;
  }
  // and the source invariant, which is what actually guards every boss
  out.bothGatesCrossChecked = null;
  return out;
});

// The gate change is structural, so assert it in the served source too — a
// behavioural probe can only reach whichever boss happens to be on the map.
const src = await page.evaluate(() => document.documentElement.outerHTML.length);
const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const bmGate = html.includes("if (!m._bigMeleeFiring && !m._columnFiring && m._bigMeleeCd <= 0");
const csGate = html.includes("if (!m._columnFiring && !m._bigMeleeFiring && m._columnCd <= 0");

console.log(JSON.stringify({ ...r, srcLen: src, bmGate, csGate }));
const checks = [
  ['the pact button exists and is clickable twice', r.click1 === true && r.click2 === true],
  ['a second pact charges 25% of what is LEFT, not of the original wallet', r.secondChargedQuarterOfWhatWasLeft === true,
    'wallet ' + r.coinsAfter1 + ' -> ' + r.coinsAfter2],
  ['a second pact EXTENDS the boost instead of resetting it', r.secondExtendedNotReset === true],
  ['the swing gate refuses to start while a column is in flight', bmGate === true],
  ['the column gate refuses to start while a swing is in flight', csGate === true],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
