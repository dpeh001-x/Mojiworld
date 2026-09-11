// v0.30.x — Economy and progression findings from a parallel audit.
//   node scripts/economy_ladders_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11285);
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
await page.fill('#hero-name-input', 'Eco');
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
  // B5: price ladder monotonic across T4 -> T5 -> T6
  const _all = Object.values(ITEM_POOL).flat();   // ITEM_POOL is keyed by category
  const byTier = (t) => _all.find((it) => it && it.tier === t && it.price);
  const t4 = byTier(4), t5 = byTier(5), t6 = byTier(6);
  out.p4 = t4 ? _lxGearMarketPrice(t4) : null; out.p5 = t5 ? _lxGearMarketPrice(t5) : null; out.p6 = t6 ? _lxGearMarketPrice(t6) : null;
  out.ladderMonotonic = !!(out.p4 && out.p5 && out.p6 && out.p5 > out.p4 && out.p6 > out.p5);
  // B6: the first rung reads the table
  out.firstRung = (typeof _lxFirstRungExp === 'function') ? _lxFirstRungExp() : null;
  out.tableRung = _lxLevelCost(1);
  // B10 (corrected): Virgo keeps her deliberately halved DEF
  const z = (typeof LX_MONSTER_STATS !== 'undefined') ? LX_MONSTER_STATS : null;
  out.virgoDef = z && z.zodiac_virgo ? z.zodiac_virgo.def : null; out.leoDef = z && z.zodiac_leo ? z.zodiac_leo.def : null;
  // B11: the Duo Trial diminishes on repeat
  game._bossKills = game._bossKills || {}; delete game._bossKills['duo_testboss'];
  const s0 = player.setshards || 0;
  const a = _duoTrialReward(100, 'testboss'); const b = _duoTrialReward(100, 'testboss');
  out.duoFirst = a; out.duoSecond = b; player.setshards = s0; delete game._bossKills['duo_testboss'];
  return out;
});
const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const bravoBound = html.includes('game.expedition._bravoOffer = { floor: game.expedition._floorClearedFor');
const floorsKept = html.includes("game.expedition._clearedFloors[game.expedition.floor]");
const haircut = html.includes('const lostMojicoins = (_diedInExpedition || _netWorth < 2000)');
console.log(JSON.stringify({ ...r, bravoBound, floorsKept, haircut }));
const checks = [
  ['gear price ladder is monotonic through tier 5', r.ladderMonotonic === true, `T4 ${r.p4} T5 ${r.p5} T6 ${r.p6}`],
  ['the first level costs what the table says', r.firstRung != null && r.firstRung === r.tableRung && r.tableRung > 1000, `${r.firstRung} vs ${r.tableRung}`],
  ["Bravo's offer is bound to the floor it was earned on", bravoBound === true],
  ['a cleared floor does not respawn on reload', floorsKept === true],
  ['a tower death waives the coin haircut the snapshot restore was meant to wipe', haircut === true],
  // v0.30.x — corrected: v0.30.369 halved Virgo's DEF ON PURPOSE (1441 -> 720, 'Virgo heal rate lower still, DEF halved';
  // scripts/virgo_ritual_test.mjs pins it). v0.30.524 read that as a data slip and undid it. It stays halved.
  ["Virgo keeps the halved DEF v0.30.369 gave her", r.virgoDef === 720 && r.leoDef === 1441, `virgo ${r.virgoDef} leo ${r.leoDef}`],
  ['the Duo Trial diminishes on a repeat kill', r.duoFirst > 0 && r.duoSecond < r.duoFirst, `${r.duoFirst} -> ${r.duoSecond}`],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
