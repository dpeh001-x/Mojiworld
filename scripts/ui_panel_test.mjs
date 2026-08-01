// UI panel integrity test (v0.29.372). Opens every player-reachable panel
// through its REAL open function and asserts the invariants a panel must hold:
//   - opening never throws, in any order (the shared-container trap below)
//   - the panel actually becomes visible
//   - closeAllModals() closes it (no soft-lock)
//   - repeated open/close does not leak DOM nodes
//   - opening a second panel closes the first (no stacked live overlays)
//
// The shared-container trap this exists for: #attributes-modal hosts THREE
// panels (Character Sheet, Level Up, Skills Reference). Level Up does
// `body.innerHTML = ...`, destroying the nodes the Character Sheet renders
// into — so opening Level Up and then the Character Sheet threw
// `Cannot set properties of null`, before the display flip, leaving the sheet
// dead for the whole session. Order-dependent, so a single-open test misses it.
//   node scripts/ui_panel_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8930)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8930;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const o = await page.evaluate(() => {
  const out = {};
  // Dismiss the mandatory first-session gates; they legitimately pause the
  // game and legitimately refuse to close, so they would poison every check.
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  // Cutscene overlays use an `.on` CLASS, not inline display, and are
  // deliberately excluded from closeAllModals — they are pause-owners by
  // design. Entering a map can start one, which would make every
  // "returns to play" check fail for a reason that is not a bug.
  for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'game-complete-overlay']) {
    const el = document.getElementById(id); if (el && el.classList) el.classList.remove('on');
  }
  player.cls = player.cls || 'warrior';
  player.level = 50; player.maxHp = 5000; player.hp = 5000; player.mojicoins = 100000;
  const arena = Object.entries(MAPS).find(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).length);
  if (arena) loadMap(arena[0]);
  const flex = (id) => { const el = document.getElementById(id); return !!el && el.style.display === 'flex'; };

  // ---- A. every ORDERED PAIR of the shared-container siblings -------------
  // The bug was order-dependent: A-then-B threw while B-then-A did not.
  const SHARED = ['openAttributes', 'openLevelUpPanel', 'openSkillsReference'];
  const orderThrows = [];
  for (const a of SHARED) for (const b of SHARED) {
    try { closeAllModals(); window[a](); } catch (e) { orderThrows.push(`${a} (first): ${String(e).slice(0, 80)}`); continue; }
    try { window[b](); } catch (e) { orderThrows.push(`${a} -> ${b}: ${String(e).slice(0, 80)}`); }
    if (!flex('attributes-modal')) orderThrows.push(`${a} -> ${b}: panel not visible`);
  }
  out.orderThrows = orderThrows;

  // ---- B. open / visible / closes / no leak, per panel --------------------
  const PANELS = [
    ['openSkillsModal', 'skills-modal'], ['openSkillTree', 'skilltree-modal'],
    ['openAttributes', 'attributes-modal'], ['openLevelUpPanel', 'attributes-modal'],
    ['openSkillsReference', 'attributes-modal'], ['openCodex', 'codex-modal'],
    ['openMojidex', 'mojidex-modal'], ['openCraftingModal', 'craft-modal'],
    ['openEnhancementModal', 'enhance-modal'], ['openMultiplayer', 'multiplayer-modal'],
    ['toggleQuestJournal', 'quest-modal'], ['toggleWorldMap', 'worldmap-modal'],
    ['openLoreMap', 'lore-modal'],
  ];
  const panels = [];
  for (const [fn, id] of PANELS) {
    if (typeof window[fn] !== 'function' || !document.getElementById(id)) {
      panels.push({ fn, id, missing: true }); continue;
    }
    const rec = { fn, id };
    try { closeAllModals(); window[fn](); rec.openThrew = null; } catch (e) { rec.openThrew = String(e).slice(0, 100); }
    rec.visible = flex(id);
    try { closeAllModals(); } catch (e) {}
    rec.closed = !flex(id);
    // leak: compare node count after 5 warm cycles vs after 25
    try {
      for (let i = 0; i < 5; i++) { window[fn](); closeAllModals(); }
      const n5 = document.getElementsByTagName('*').length;
      for (let i = 0; i < 20; i++) { window[fn](); closeAllModals(); }
      rec.growth = document.getElementsByTagName('*').length - n5;
    } catch (e) { rec.growth = -1; rec.cycleThrew = String(e).slice(0, 100); }
    panels.push(rec);
  }
  out.panels = panels;

  // ---- C. no two panels live at once, via PLAYER-REACHABLE entry points ---
  // Only the togglers players actually invoke. The raw openers (openCodex /
  // openMojidex / openLoreMap) are internal: every path that reaches them —
  // toggleLoreMap for the L key, _codexOpenDossier for a dossier click —
  // fronts them with closeAllModals(), so testing them directly would assert
  // a convention the codebase deliberately keeps at the call site.
  const PAIRS = [
    ['toggleQuestJournal', 'quest-modal', 'toggleWorldMap', 'worldmap-modal'],
    ['toggleWorldMap', 'worldmap-modal', 'toggleQuestJournal', 'quest-modal'],
    ['toggleQuestJournal', 'quest-modal', 'toggleLoreMap', 'lore-modal'],
    ['toggleWorldMap', 'worldmap-modal', 'toggleLoreMap', 'lore-modal'],
    ['toggleLoreMap', 'lore-modal', 'toggleQuestJournal', 'quest-modal'],
  ];
  const stacked = [];
  for (const [fa, ia, fb, ib] of PAIRS) {
    if (typeof window[fa] !== 'function' || typeof window[fb] !== 'function') continue;
    try {
      closeAllModals(); window[fa]();
      const aWas = flex(ia);
      window[fb]();
      if (aWas && flex(ia) && flex(ib)) stacked.push(`${ia} stays live under ${ib}`);
    } catch (e) { stacked.push(`${ia} -> ${ib} threw: ${String(e).slice(0, 80)}`); }
  }
  out.stacked = stacked;

  // ---- D. closing everything returns to play ------------------------------
  // Clear cutscene overlays HERE, not just at setup: a story beat can arm
  // itself again while the test runs, and it is a legitimate pause-owner that
  // closeAllModals deliberately does not touch.
  for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'game-complete-overlay']) {
    const el = document.getElementById(id); if (el && el.classList) el.classList.remove('on');
  }
  closeAllModals();
  out.pausedAfterClose = !!game.paused;
  if (out.pausedAfterClose) {
    // name the pause owner rather than just failing
    out.pauseOwners = ['shop-modal','inventory-modal','skills-modal','powerup-modal','help-modal',
      'enhance-modal','skilltree-modal','attributes-modal','dev-modal','taxi-modal','codex-modal',
      'mojidex-modal','multiplayer-modal','quest-modal','worldmap-modal','confirm-modal','craft-modal',
      'class-select-modal','advancement-modal','tutorial-modal','bravo-boon-modal','lore-modal','dialog']
      .filter(id => { const el = document.getElementById(id);
        return el && (el.style.display === 'flex' || el.style.display === 'block'); });
  }
  return out;
});

const results = [];
const ok = (n, c, e) => results.push({ n, pass: !!c, e });
ok('shared-container panels open in any order without throwing',
   o.orderThrows.length === 0, o.orderThrows.join(' | '));
for (const p of o.panels) {
  if (p.missing) { ok(`${p.fn}: reachable`, false, 'function or element missing'); continue; }
  ok(`${p.fn}: opens without throwing`, !p.openThrew, p.openThrew);
  ok(`${p.fn}: becomes visible`, p.visible);
  ok(`${p.id}: closeAllModals closes it`, p.closed);
  ok(`${p.id}: no DOM leak over 20 cycles`, p.growth === 0, `+${p.growth} nodes`);
}
ok('no two panels are live at once', o.stacked.length === 0, o.stacked.join(' | '));
ok('closing every panel returns to play', !o.pausedAfterClose,
   o.pauseOwners ? 'still open: ' + (o.pauseOwners.join(', ') || 'nothing — a non-modal owner') : '');

for (const t of results) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}${t.e ? '  (' + t.e + ')' : ''}`);
const failed = results.filter(t => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} UI assertions pass`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
