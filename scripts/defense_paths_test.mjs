// v0.30.x — Defence-path findings from the audit backlog: Mana Shield after the floors,
// the co-op follower DR stack, and the save-version recovery copy.
//   node scripts/defense_paths_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11295);
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
await page.fill('#hero-name-input', 'Def');
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
  { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; } }
  game.paused = true;   // freeze the sim while we poke the helpers
  // C13: the shared Mana Shield trade — 2 MP : 1 HP on whatever it is handed
  player.tree = player.tree || {}; player.tree.manaShield = true; player.mp = 50;
  out.msOut = (typeof _lxManaShieldAbsorb === 'function') ? _lxManaShieldAbsorb(100) : null;
  out.msMp = player.mp;
  player.tree.manaShield = false;
  // C18: the follower DR stack honours a block
  player.blockTimer = 500;
  out.blockOut = (typeof _lxContactDrStack === 'function') ? _lxContactDrStack({ atk: 100, level: 1, type: 'probe' }, 100) : null;
  player.blockTimer = 0;
  // C20: a save the game refuses on version is preserved under _recover
  const K = SAVE_KEY;
  const _live = localStorage.getItem(K);
  localStorage.removeItem(K + '_recover');
  const _stale = JSON.stringify({ v: -999, player: { cls: 'warrior', name: 'Old' } });
  localStorage.setItem(K, _stale);
  let loaded = null; try { loaded = loadState(); } catch (e) { loaded = 'threw ' + e.message; }
  out.staleLoaded = loaded;
  out.recover = localStorage.getItem(K + '_recover') === _stale;
  localStorage.removeItem(K + '_recover');
  if (_live == null) localStorage.removeItem(K); else localStorage.setItem(K, _live);
  return out;
});
const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const iHost = html.indexOf('_shownDmg = _lxManaShieldAbsorb(_shownDmg);');
const iFloor = html.indexOf('_lxBossHpFloor(m.type, _shownDmg);');
const hostAfterFloors = iHost > 0 && iFloor > 0 && iHost > iFloor;
const followerStack = html.includes('dmg = _lxContactDrStack(m, dmg);');
console.log(JSON.stringify({ ...r, hostAfterFloors, followerStack }));
const checks = [
  ['Mana Shield trades 2 MP for 1 HP through the shared helper', r.msOut === 75 && r.msMp === 0, `out ${r.msOut} mp ${r.msMp}`],
  ['the host site runs the Mana Shield AFTER the boss floors', hostAfterFloors],
  ['the co-op follower path runs the contact DR stack', followerStack],
  ['the follower stack honours an active block', r.blockOut != null && r.blockOut <= 30, `block ${r.blockOut}`],
  ['a version-mismatched save is refused', r.staleLoaded === false, String(r.staleLoaded)],
  ['... and preserved under _recover', r.recover === true],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
