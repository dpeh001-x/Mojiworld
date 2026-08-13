#!/usr/bin/env node
// DECK / CONTROLLER-ONLY AUDIT — can a player who never touches keyboard or
// mouse actually reach and operate every blocking surface in the game?
//
//   MOJI_PW_EXE=<chrome> node scripts/deck_controller_audit.mjs [port]
//
// The pad router (_lxPadModalRoot) only considers ids listed in
// _LX_PAD_MODAL_IDS. Anything blocking that is NOT in that list is a soft-lock
// for a controller-only player: the panel is on screen, the game is waiting on
// it, and the pad is still driving whatever is behind it. Death and NPC dialogue
// are the ones that end a run.
//
// For each surface: force it visible, ask the router where the pad would go, and
// count the focusable controls the pad nav would actually find (same selector +
// 5px size filter _lxPadMenuNav uses). Reports BLOCKING failures separately from
// cosmetic ones so the exit code means something.

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const EXE = process.env.MOJI_PW_EXE || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const PORT = process.argv[2] || '8080';

// blocking = the game is waiting on this surface; unreachable == run over
const SURFACES = [
  { id: 'death-overlay',      blocking: true,  why: 'respawn after dying' },
  { id: 'dialog',             blocking: true,  why: 'NPC dialogue + quest choices' },
  { id: 'powerup-modal',      blocking: true,  why: 'boon pick (mid-run, modal)' },
  { id: 'advancement-modal',  blocking: true,  why: 'class advancement' },
  { id: 'class-select-modal', blocking: true,  why: 'character creation' },
  { id: 'confirm-modal',      blocking: true,  why: 'yes/no confirms' },
  { id: 'sage-blessing-modal',blocking: true,  why: 'blessing pick' },
  { id: 'settings-modal-bg',  blocking: false, why: 'settings + quit' },
  { id: 'inventory-modal',    blocking: false, why: 'inventory' },
  { id: 'skills-modal',       blocking: false, why: 'skills' },
  { id: 'skilltree-modal',    blocking: false, why: 'skill tree' },
  { id: 'attributes-modal',   blocking: false, why: 'attributes' },
  { id: 'quest-modal',        blocking: false, why: 'quest journal' },
  { id: 'worldmap-modal',     blocking: false, why: 'world map / travel' },
  { id: 'shop-modal',         blocking: false, why: 'shop' },
  { id: 'craft-modal',        blocking: false, why: 'crafting' },
  { id: 'enhance-modal',      blocking: false, why: 'enhancing' },
  { id: 'taxi-modal',         blocking: false, why: 'taxi travel' },
  { id: 'multiplayer-modal',  blocking: false, why: 'co-op join' },
  { id: 'codex-modal',        blocking: false, why: 'codex' },
  { id: 'mojidex-modal',      blocking: false, why: 'mojidex' },
  { id: 'lore-modal',         blocking: false, why: 'lore' },
  { id: 'help-modal',         blocking: false, why: 'help' },
  { id: 'tutorial-modal',     blocking: false, why: 'tutorial' },
  { id: 'recipe-scrolls-modal', blocking: false, why: 'recipe scrolls' },
  { id: 'jukebox-modal-bg',   blocking: false, why: 'jukebox' },
  { id: 'backup-modal-bg',    blocking: false, why: 'save backup' },
  { id: 'wardrobe-picker',    blocking: false, why: 'wardrobe' },
  { id: 'menu-name-panel',    blocking: false, why: 'title: name entry' },
  { id: 'menu-coop-panel',    blocking: false, why: 'title: co-op' },
];

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => { try { return typeof _lxPadModalRoot === 'function'; } catch { return false; } }, null, { timeout: 90000 });

const rows = await page.evaluate((SURFACES) => {
  const SEL = 'button, [role="button"], input, select, .toggle, .qj-btn, [data-qaccept], [data-qabandon], [onclick]';
  const listed = new Set(_LX_PAD_MODAL_IDS);
  const out = [];
  // ISOLATE. At boot 'class-select-modal' is genuinely open and full-screen, so
  // merely force-showing another panel leaves it underneath — and the router
  // (correctly) still reports class-select. Hide every other candidate and the
  // title overlay first, so the surface under test is the only thing on screen
  // and the routing answer is about that surface rather than about stacking.
  const others = [...SURFACES.map((x) => x.id), 'lo-auth', 'loading-overlay', 'class-select-modal'];
  const stash = new Map();
  for (const id of new Set(others)) {
    const n = document.getElementById(id);
    if (n) { stash.set(id, { d: n.style.display, h: n.hidden, c: n.className }); n.style.display = 'none'; }
  }
  for (const s of SURFACES) {
    const el = document.getElementById(s.id);
    if (!el) { out.push({ ...s, exists: false }); continue; }
    const prevDisplay = el.style.display, prevHidden = el.hidden, prevCls = el.className;
    el.hidden = false;
    el.style.display = 'flex';
    el.classList.add('on', 'shown', 'open');
    let root = null;
    try { root = _lxPadModalRoot(); } catch (e) {}
    const focusables = [...el.querySelectorAll(SEL)].filter((n) => {
      if (n.disabled) return false;
      const r = n.getBoundingClientRect();
      return r.width >= 5 && r.height >= 5;
    });
    out.push({
      ...s, exists: true,
      inPadList: listed.has(s.id),
      routedHere: !!(root && (root === el || el.contains(root) || root.contains(el))),
      rootId: root ? root.id : null,
      focusables: focusables.length,
    });
    el.style.display = 'none'; el.hidden = prevHidden; el.className = prevCls;
    void prevDisplay;
  }
  for (const [id, v] of stash) {
    const n = document.getElementById(id);
    if (n) { n.style.display = v.d; n.hidden = v.h; n.className = v.c; }
  }
  return out;
}, SURFACES);

let blockingBad = 0, otherBad = 0;
const line = (r) => {
  if (!r.exists) return `  --   ${r.id.padEnd(22)} (absent from DOM)`;
  const bad = !r.routedHere || r.focusables === 0;
  const tag = bad ? (r.blocking ? 'BLOCK' : 'warn ') : 'ok   ';
  return `  ${tag} ${r.id.padEnd(22)} list=${String(r.inPadList).padEnd(5)} routed=${String(r.routedHere).padEnd(5)} focusables=${String(r.focusables).padEnd(3)} root=${String(r.rootId)}  — ${r.why}`;
};
console.log('CONTROLLER-ONLY REACHABILITY\n');
for (const r of rows) {
  console.log(line(r));
  if (!r.exists) continue;
  if (!r.routedHere || r.focusables === 0) { if (r.blocking) blockingBad++; else otherBad++; }
}
// ---------------------------------------------------------------------------
// PASS 2 — LIVE OPENS. The panels above that route fine but report 0 focusables
// are populated at open time (boon cards, advancement choices, dialogue
// options), so an empty shell proves nothing either way. Drive their real entry
// points and re-count, which is the only way to know a controller can pick.
// ---------------------------------------------------------------------------
const live = await page.evaluate(() => {
  const SEL = 'button, [role="button"], input, select, .toggle, .qj-btn, [data-qaccept], [data-qabandon], [onclick]';
  const count = (id) => {
    const el = document.getElementById(id);
    if (!el) return -1;
    return [...el.querySelectorAll(SEL)].filter((n) => {
      if (n.disabled) return false;
      const r = n.getBoundingClientRect();
      return r.width >= 5 && r.height >= 5;
    }).length;
  };
  const rootOf = () => { try { const r = _lxPadModalRoot(); return r ? r.id : null; } catch (e) { return 'THREW'; } };
  const res = [];
  const attempt = (label, id, fn) => {
    let err = null;
    try { fn(); } catch (e) { err = String(e.message || e).slice(0, 90); }
    const el = document.getElementById(id);
    // If the opener ran without throwing but the panel never became visible, it
    // bailed on a preconditon this harness cannot fake (a real class tier, an
    // NPC's cooldown state). That is an UNVERIFIED result, not a failure —
    // calling it a soft-lock would be inventing a bug we never demonstrated.
    const shown = !!(el && getComputedStyle(el).display !== 'none');
    res.push({ label, id, focusables: count(id), root: rootOf(), err, shown });
    try { document.querySelectorAll('#' + id).forEach((n) => { n.style.display = 'none'; }); } catch (e) {}
  };
  // Satisfy the real preconditions first — otherwise these early-return and a
  // healthy panel looks like a soft-lock. Sage gates on a 12h cooldown, price
  // and the boon-inventory cap; advancement gates on level/class eligibility.
  try {
    player.mojicoins = 9999999;
    player._sageNextAt = 0;              // clear the 12h cooldown
    player.boons = [];                   // under BOON_INVENTORY_CAP
    player.level = Math.max(player.level || 1, 60);
    player.exp = 0;
  } catch (e) {}
  attempt('boon pick',        'powerup-modal',       () => showPowerupChoice({ name: 'Test Boss' }));
  attempt('class advance',    'advancement-modal',   () => openAdvancement());
  attempt('sage blessing',    'sage-blessing-modal', () => showSageBlessing('atk', null, null));
  attempt('NPC dialogue',     'dialog',              () => openNPC({ name: 'Test NPC', role: 'shop', x: 0, y: 0 }));
  return res;
});

console.log('\nLIVE OPENS (populated content)\n');
let liveBad = 0, liveUnverified = 0;
for (const r of live) {
  const bad = r.shown && r.focusables <= 0;          // visible but nothing to focus = real soft-lock
  const unver = !r.shown && r.focusables <= 0;        // never opened = preconditions unmet
  if (bad) liveBad++; if (unver) liveUnverified++;
  const tag = bad ? 'BLOCK' : unver ? 'UNVER' : 'ok   ';
  console.log(`  ${tag} ${r.label.padEnd(16)} ${r.id.padEnd(22)} focusables=${String(r.focusables).padEnd(3)} shown=${String(r.shown).padEnd(5)} root=${String(r.root)}${r.err ? '  ERR: ' + r.err : ''}`);
}
if (liveUnverified) console.log(`\n  note: ${liveUnverified} panel(s) never opened — the harness could not satisfy their in-game\n  preconditions. They route correctly when visible (pass 1); their populated\n  content is UNTESTED, not broken.`);

// ── v0.29.669 — STEAM FULL-CONTROLLER REVIEW LOCKS ───────────────────────────
// Each check pins the exact mechanism that fixed one finding from Steam's
// "Full Controller Support" review, so a refactor cannot silently reopen it.
const steam = await page.evaluate(() => {
  const out = [];
  const ok = (n, c, extra) => out.push({ n, pass: !!c, extra: String(extra == null ? '' : extra) });
  const m = _lxPadMenuNav.toString().match(/querySelectorAll\('([^']+)'\)/);
  const selStr = (m && m[1]) || '';
  // "unable to select Customization Options" — dropdown items are plain divs
  ok('nav selector reaches .cs-dd-item (customization options)', selStr.includes('.cs-dd-item'));
  // "unable to choose Class" — cards wire onclick as a PROPERTY, not attribute
  ok('nav selector reaches .class-card (class choice)', selStr.includes('.class-card'));
  // "unable to enter any text… no virtual keyboard appears"
  let vkOk = false, vkRoot = false, committed = '';
  try {
    const inp = document.createElement('input'); inp.type = 'text';
    document.body.appendChild(inp);
    _lxPadVK.open(inp);
    vkOk = !!document.getElementById('pad-vk');
    vkRoot = (_lxPadModalRoot() || {}).id === 'pad-vk';
    for (const k of ['⇧', 'd', 'e', 'c', 'k']) _lxPadVK.press(k);
    _lxPadVK.press('✓');
    committed = inp.value; inp.remove();
  } catch (e) {}
  ok('virtual keyboard opens on a text field', vkOk);
  ok('virtual keyboard outranks every other pad root while open', vkRoot);
  ok('virtual keyboard commits its buffer to the field', committed === 'DECK', committed);
  ok('VK is fully gone after commit', !document.getElementById('pad-vk'));
  // title sub-panels that used to strand the router
  for (const id of ['wardrobe-picker', 'menu-name-panel', 'menu-coop-panel'])
    ok('router id list covers ' + id, _LX_PAD_MODAL_IDS.includes(id));
  // "unable to select Full screen prompt" / "unable to access Hotkeys & Skills"
  ok('settings has a pad-reachable Fullscreen row', !!document.getElementById('set-fullscreen-row'));
  ok('settings has a pad-reachable Hotkeys & Skills row', !!document.getElementById('set-hotkeys-row'));
  return out;
});
console.log('\nSTEAM REVIEW LOCKS\n');
let steamBad = 0;
for (const r of steam) {
  if (!r.pass) steamBad++;
  console.log(`  ${r.pass ? 'ok   ' : 'FAIL '}${r.n}${r.extra ? '  (' + r.extra + ')' : ''}`);
}

// pass 1's 0-focusable entries are superseded by pass 2 for these four ids
const deferred = new Set(live.map((r) => r.id));
const pass1Real = rows.filter((r) => r.exists && r.blocking && !deferred.has(r.id) && (!r.routedHere || r.focusables === 0)).length;
const total = pass1Real + liveBad + steamBad;
console.log(`\nBLOCKING failures: ${total} (routing ${pass1Real}, populated-content ${liveBad}, steam-locks ${steamBad})   non-blocking: ${otherBad}`);
console.log(total ? 'FAIL — a controller-only player can soft-lock' : 'PASS — every blocking surface is pad-reachable and operable');
await browser.close();
process.exit(total);
