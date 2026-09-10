// v0.30.x — THE EDICTS PANEL IS A SURFACE LIKE ANY OTHER.
// openEdictsPanel builds a full-viewport overlay at z-index 520 on the BODY and
// was in none of the registries that manage surfaces: it never set game.paused,
// so the sim ticked underneath it; Esc did nothing; no controller could reach its
// close button; and the death overlay (z-index 90, inside the game wrapper)
// painted UNDER it, so dying behind the panel left the player guessing where the
// backdrop was.
//
//   node scripts/edicts_surface_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11231);
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
await page.fill('#hero-name-input', 'Edi');
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
  const gone = () => !document.getElementById('edicts-modal');

  game.paused = false;
  openEdictsPanel();
  out.openedOk = !gone();
  out.pausedWhileOpen = !!game.paused;
  out.isPauseOwner = (typeof _anyOtherModalOpen === 'function') ? !!_anyOtherModalOpen() : null;
  out.inPadList = (typeof _LX_PAD_MODAL_IDS !== 'undefined') ? _LX_PAD_MODAL_IDS.indexOf('edicts-modal') >= 0 : null;

  // What ELSE owns the pause in this harness? Closing the panel must release the
  // panel's own claim; it must NOT force the world to resume when another surface
  // is still up (closing a panel opened on top of a modal used to do exactly that).
  out.otherOwners = (typeof _lxPauseOwners === 'function')
    ? _lxPauseOwners().map(e => e.id || e.className || '?').filter(id => id !== 'edicts-modal')
    : [];

  // Esc path
  if (typeof closeAllModals === 'function') closeAllModals();
  out.closedByEsc = gone();
  out.pauseConsistentAfter = (game.paused === ((typeof _anyOtherModalOpen==='function') ? !!_anyOtherModalOpen() : false));

  // its own close button must still work, and must not unfreeze a modal underneath
  openEdictsPanel();
  const btn = document.getElementById('edicts-close');
  out.hasCloseButton = !!btn;
  if (btn) btn.onclick();
  out.closedByButton = gone();
  out.pauseConsistentAfterButton = (game.paused === ((typeof _anyOtherModalOpen==='function') ? !!_anyOtherModalOpen() : false));
  return out;
});

console.log(JSON.stringify(r));
const checks = [
  ['the panel opens', r.openedOk === true],
  ['the world stops while it is up', r.pausedWhileOpen === true],
  ['it registers as a pause owner', r.isPauseOwner === true],
  ['a controller can reach it', r.inPadList === true],
  ['Esc closes it', r.closedByEsc === true],
  ['...and the pause reconciles to whatever else is open', r.pauseConsistentAfter === true, 'other owners: ' + (r.otherOwners||[]).join(',')],
  ['its own close button still works', r.hasCloseButton === true && r.closedByButton === true],
  ['...and its own close button reconciles too', r.pauseConsistentAfterButton === true],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
