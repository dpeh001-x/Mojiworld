// A controller can spend stat points in the U panel and travel from the W map.
//
// Per user: "controller needs to be able to select stats from the U tab, and
// controller should be able to toggle the different available nodes in the W
// world [map]".
//
// This drives the REAL pad path — _lxPadMenuNav with a synthetic gamepad —
// rather than checking that a CSS selector matches something. D-pad presses
// move the focus ring; the A button activates. What is asserted is the
// OUTCOME: skill points actually leave the pool and the lane actually goes up,
// and the map node actually starts a travel.
//
// Two things the naive version of this test got wrong:
//   • SVGElement has no .click() method (it is undefined, not a no-op), so a
//     world-map node cannot be activated the way every other control is. The
//     activation assertion below is what proves the dispatch path works.
//   • The map's 80 nodes are nearly all undiscovered dead ends. Only nodes
//     that really are travellable may hold the ring, so the test unlocks a
//     couple of maps and checks the ring lands on one of THOSE.
// Run: node scripts/pad_u_stats_worldmap_test.mjs [file.html]
// Negative control: a pre-fix build never lets the ring reach either.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxPadMenuNav === 'function'
  && typeof openLevelUpPanel === 'function' && typeof toggleWorldMap === 'function', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.waitForTimeout(4500);

const r = await page.evaluate(async () => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const out = {};

  // Synthetic gamepad. _lxPadMenuNav reads pad.buttons[i].pressed and edges
  // them against its own previous-state map, so every press is delivered as
  // down-then-up.
  const mkPad = (idx) => ({
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === idx, value: i === idx ? 1 : 0 })),
    axes: [0, 0, 0, 0],
  });
  const tap = async (root, idx) => {
    try { _lxPadMenuNav(root, mkPad(idx)); } catch (e) {}
    await frame();
    try { _lxPadMenuNav(root, mkPad(-1)); } catch (e) {}
    await frame();
  };
  const focused = (root) => root.querySelector('.pad-focus');

  // ================= U PANEL — spend a stat point =================
  player.level = 40; player.skillPoints = 40;
  game._uTab = 'lp';
  openLevelUpPanel();
  for (let i = 0; i < 8; i++) await frame();
  const uRoot = document.getElementById('attributes-modal');
  out.uCardsPresent = uRoot.querySelectorAll('.lu-card').length;
  out.uAffordable = uRoot.querySelectorAll('.lu-card.affordable').length;

  // Walk the ring until it lands on a stat card (bounded).
  let uHit = null, uSteps = 0;
  for (let i = 0; i < 40 && !uHit; i++) {
    await tap(uRoot, 13);           // D-pad down
    uSteps++;
    const f = focused(uRoot);
    if (f && f.classList.contains('lu-card')) uHit = f;
  }
  if (!uHit) {
    for (let i = 0; i < 40 && !uHit; i++) {
      await tap(uRoot, 15);         // D-pad right
      uSteps++;
      const f = focused(uRoot);
      if (f && f.classList.contains('lu-card')) uHit = f;
    }
  }
  out.uReached = !!uHit;
  out.uSteps = uSteps;
  out.uFocusLabel = uHit ? (uHit.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 26) : null;
  if (uHit) {
    out.uCardAffordable = uHit.classList.contains('affordable');
    const spBefore = player.skillPoints;
    const spentBefore = JSON.stringify(player._levelUpSpent || {});
    await tap(uRoot, 0);            // A
    for (let i = 0; i < 6; i++) await frame();
    out.spBefore = spBefore;
    out.spAfter = player.skillPoints;
    out.spSpent = spBefore - player.skillPoints;
    out.laneChanged = JSON.stringify(player._levelUpSpent || {}) !== spentBefore;
  }
  try { closeAllModals(); } catch (e) {}
  for (let i = 0; i < 6; i++) await frame();

  // ================= W WORLD MAP — travel to a node =================
  // A node is travellable only if the map has been visited.
  game.visitedMaps = game.visitedMaps || {};
  let unlocked = 0;
  for (const id of Object.keys(MAPS)) {
    const md = MAPS[id];
    if (!md || md.isBossArena) continue;
    game.visitedMaps[id] = true;
    if (++unlocked >= 12) break;
  }
  const loadCalls = [];
  const origLoad = window.loadMap;
  window.loadMap = function (id) { loadCalls.push(id); return origLoad.apply(this, arguments); };

  toggleWorldMap();
  for (let i = 0; i < 12; i++) await frame();
  const wRoot = document.getElementById('worldmap-modal');
  out.wOpen = !!(wRoot && getComputedStyle(wRoot).display !== 'none');
  out.wNodesTotal = wRoot ? wRoot.querySelectorAll('[data-map-id]').length : 0;
  out.wNodesPickable = wRoot ? wRoot.querySelectorAll('[data-wm-pick]').length : 0;

  let wHit = null, wSteps = 0;
  for (const dir of [15, 13, 14, 12]) {          // right, down, left, up
    for (let i = 0; i < 30 && !wHit; i++) {
      await tap(wRoot, dir);
      wSteps++;
      const f = focused(wRoot);
      if (f && f.hasAttribute && f.hasAttribute('data-wm-pick')) wHit = f;
    }
    if (wHit) break;
  }
  out.wReached = !!wHit;
  out.wSteps = wSteps;
  out.wFocusId = wHit ? wHit.getAttribute('data-map-id') : null;
  out.wFocusIsSvg = wHit ? (wHit instanceof SVGElement) : null;
  out.wFocusHasClickFn = wHit ? (typeof wHit.click === 'function') : null;
  if (wHit) {
    loadCalls.length = 0;
    const mapBefore = game.currentMap;
    await tap(wRoot, 0);            // A
    for (let i = 0; i < 20; i++) await frame();
    out.travelCalls = loadCalls.slice(0, 3);
    out.travelFired = loadCalls.length > 0 || game.currentMap !== mapBefore;
  }
  window.loadMap = origLoad;
  try { closeAllModals(); } catch (e) {}
  return out;
});
await browser.close();

console.log(`  U panel: ${r.uCardsPresent} stat cards (${r.uAffordable} affordable)`);
console.log(`    ring reached a card: ${r.uReached} after ${r.uSteps} presses — "${r.uFocusLabel}"`);
console.log(`    A pressed: skillPoints ${r.spBefore} -> ${r.spAfter} (spent ${r.spSpent}), lane changed ${r.laneChanged}`);
console.log(`  World map: ${r.wNodesTotal} nodes, ${r.wNodesPickable} travellable`);
console.log(`    ring reached a node: ${r.wReached} after ${r.wSteps} presses — "${r.wFocusId}" (svg=${r.wFocusIsSvg}, has .click()=${r.wFocusHasClickFn})`);
console.log(`    A pressed: travel fired ${r.travelFired}, loadMap ${JSON.stringify(r.travelCalls)}`);

check(r.uCardsPresent >= 4 && r.uAffordable >= 1, 'the U panel has affordable stat cards to select', { cards: r.uCardsPresent, affordable: r.uAffordable });
check(r.uReached, 'the pad ring can reach a stat card in the U panel', { steps: r.uSteps });
check(r.uCardAffordable === true, 'and it lands on an affordable one, not a locked/MAXED lane', r.uFocusLabel);
check(r.spSpent > 0, 'pressing A actually spends skill points', { before: r.spBefore, after: r.spAfter });
check(r.laneChanged === true, 'and the stat lane actually goes up', r.laneChanged);
check(r.wOpen && r.wNodesTotal > 10, 'the world map opened with its node graph', { open: r.wOpen, nodes: r.wNodesTotal });
check(r.wNodesPickable >= 1 && r.wNodesPickable < r.wNodesTotal,
      'only the travellable nodes are marked — not all 80, and not none', { pickable: r.wNodesPickable, total: r.wNodesTotal });
check(r.wReached, 'the pad ring can reach a travellable map node', { steps: r.wSteps });
// The whole reason the node case needed more than a selector change.
check(r.wFocusIsSvg === true && r.wFocusHasClickFn === false,
      'the node is an SVG element with NO .click() method — so activation cannot rely on one', { svg: r.wFocusIsSvg, hasClick: r.wFocusHasClickFn });
check(r.travelFired === true, 'and pressing A on it actually starts a travel', { calls: r.travelCalls });
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
