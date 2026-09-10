// v0.30.x — STEAM-INPUT-ONLY PLAYERS GET MENU NAVIGATION.
// _lxPadPoll carries on when only the Steam snapshot exists, but the whole modal branch
// was gated on a browser Gamepad object - so with a Steam config that keeps the device out
// of navigator.getGamepads(), every press bypassed the pad registry and the nav ring and
// went to gameplay dispatch. Panels closed on Start; nothing inside them could be pressed.
// Reproduced headlessly: no gamepad, a stubbed Steam snapshot, an open listed modal.
//
//   node scripts/steam_input_nav_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11265);
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
await page.fill('#hero-name-input', 'Stm');
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
  // no browser gamepad in a headless run - confirm, so the Steam path is the only path
  out.browserPads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean).length;
  // a Steam Input snapshot, and nothing else
  window.__snap = {};
  window.SteamAPI = { available: true, input: { snapshot: () => window.__snap } };
  try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}

  // the harness boots with a story-beat overlay live; it outranks the Journal in the
  // topmost-wins resolver and has NO navigable controls, so put it away first
  { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; } }
  // open a listed, blocking surface
  const qm = document.getElementById('quest-modal');
  if (typeof toggleQuestJournal === 'function') toggleQuestJournal();
  await wait(200);
  out.journalOpen = !!(qm && qm.style.display === 'flex');
  // topmost-wins: this harness boots with a story-beat overlay live, which outranks the
  // journal - so assert that SOME listed surface is the root, and record which
  const _root = (typeof _lxPadModalRoot === 'function') ? _lxPadModalRoot() : null;
  out.modalRootId = _root ? (_root.id || _root.className) : null;
  out.modalRootIsJournal = (_root === qm);

  // press D-pad down on Steam Input only, poll as the loop would
  const focusIn = () => !!document.querySelector('.pad-focus');   // wherever the root is
  window.__snap = { moveDown: true };
  for (let i = 0; i < 6; i++) { _lxPadPoll(); await wait(40); }
  out.focusRingAfterDown = focusIn();
  out.modeAfterDown = (typeof _lxPadMode !== 'undefined') ? _lxPadMode : null;
  window.__snap = {};
  for (let i = 0; i < 3; i++) { _lxPadPoll(); await wait(40); }

  // the synthetic pad reads like a standard one
  out.synthHelper = (typeof _lxSteamNavPad === 'function');
  if (out.synthHelper) {
    const sp = _lxSteamNavPad({ jump: true, moveLeft: true, _moveX: -0.9, _moveY: 0.1 });
    out.synthAccept = !!(sp && _lxPadBtn(sp, 0));
    out.synthDpadLeft = !!(sp && _lxPadBtn(sp, 14));
    // the stick is folded into the D-pad (raw axes are drift-guarded and would read 0)
    const stick = _lxSteamNavPad({ _moveX: -0.9, _moveY: 0.8 });
    out.stickLeftIsDpadLeft = !!(stick && _lxPadBtn(stick, 14));
    out.stickDownIsDpadDown = !!(stick && _lxPadBtn(stick, 13));
    const contra = _lxSteamNavPad({ moveLeft: true, moveRight: true });
    out.synthContradictionDropped = !!(contra && !_lxPadBtn(contra, 14) && !_lxPadBtn(contra, 15));
  }

  // put the world back
  try { if (typeof closeAllModals === 'function') closeAllModals(); } catch (e) {}
  delete window.SteamAPI; delete window.__snap;
  return out;
});

console.log(JSON.stringify(r));
const checks = [
  ['harness: no browser gamepad is present', r.browserPads === 0],
  ['harness: the Journal is open and is the pad modal root', r.journalOpen === true && r.modalRootIsJournal === true, 'root=' + r.modalRootId],
  ['a Steam-only D-pad press drives the menu (focus ring appears)', r.focusRingAfterDown === true],
  ['...and the router enters menu mode', r.modeAfterDown === 'menu'],
  ['the synthetic pad exposes accept / D-pad / stick like a standard pad', r.synthHelper === true && r.synthAccept === true && r.synthDpadLeft === true && r.stickLeftIsDpadLeft === true && r.stickDownIsDpadDown === true],
  ['contradictory digital directions are dropped, as in gameplay', r.synthContradictionDropped === true],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
