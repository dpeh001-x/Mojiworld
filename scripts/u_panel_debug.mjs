// U-PANEL AUDIT — drives the character panel the U key opens and reports
// defects. `attributes-modal` is a SHARED container: openLevelUpPanel hosts a
// five-tab panel (lp / boons / skills / items / mojimon) and openAttributes is
// a separate sibling that writes the same node's innerHTML. v0.29.372 records
// what that costs when it goes wrong — one bad order left the Character Sheet
// dead for the whole session with no way back short of a reload — so ordering
// and re-entry are audited here rather than assumed.
//
// Read-only: it restores every field it touches.
// Run: node scripts/u_panel_debug.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof openLevelUpPanel === 'function' && typeof toggleSharedModal === 'function', { timeout: 60000 });

const out = await page.evaluate(() => {
  const F = [];
  const bug = (sev, area, what, detail) => F.push({ sev, area, what, detail });
  const ok = [];
  const TABS = ['lp', 'boons', 'skills', 'items', 'mojimon'];
  const PANE = { lp: 'u-pane-lp', boons: 'u-pane-boons', skills: 'u-pane-skills', items: 'u-pane-items', mojimon: 'u-pane-mojimon' };

  // The panel refuses to open without a class, and pauses the sim. Snapshot
  // everything we are about to write so the page is left as we found it.
  const SAVE = {
    cls: player.cls, level: player.level, paused: game.paused, uTab: game._uTab,
    hp: player.hp, inv: player.inventory, mojimon: JSON.parse(JSON.stringify(player.mojimon || {})),
  };
  // Dismiss the class gate the way a player does — by clicking a card. Setting
  // player.cls directly leaves #class-select-modal on screen, and because
  // closeAllModals ends with `game.paused = _anyOtherModalOpen()` and
  // deliberately preserves gate modals (v0.27.1), every close-path check then
  // reports "leaves the game paused" against perfectly correct code.
  const card = document.querySelector('#class-select-modal .cls-card');
  if (card && !player.cls) { try { card.click(); } catch (e) { /* fall through */ } }
  if (!player.cls) player.cls = 'warrior';
  const gate = document.getElementById('class-select-modal');
  if (gate && gate.style.display !== 'none') gate.style.display = 'none';
  if (!(player.hp > 0)) player.hp = Math.max(1, player.maxHp || 100);

  const modal = () => document.getElementById('attributes-modal');
  const isOpen = () => { const m = modal(); return !!m && m.style.display === 'flex'; };
  const close = () => { try { closeAllModals(); } catch (e) { /* reported by caller */ } };

  // Every call the panel makes is wrapped: a throw inside a render is the
  // single most damaging failure here (it aborts before the display flip and
  // strands the panel), so it must be caught and attributed, not propagated.
  const attempt = (label, fn) => {
    try { fn(); return null; }
    catch (e) { return `${label}: ${String(e && e.message || e).slice(0, 120)}`; }
  };

  const openTab = (tab) => {
    game._uTab = tab;
    return attempt(`open(${tab})`, () => openLevelUpPanel());
  };

  // ---- 1. cold open of every tab ----------------------------------------
  for (const t of TABS) {
    close();
    const err = openTab(t);
    if (err) { bug('HIGH', 'tabs', `the ${t} tab throws on a cold open`, err); continue; }
    if (!isOpen()) { bug('HIGH', 'tabs', `the ${t} tab does not display`, 'openLevelUpPanel returned but display !== flex'); continue; }
    const pane = document.getElementById(PANE[t]);
    if (!pane) { bug('MED', 'tabs', `the ${t} pane node is missing`, `#${PANE[t]} not in the DOM after open`); continue; }
    if (!(pane.textContent || '').trim()) bug('MED', 'tabs', `the ${t} pane renders empty`, `#${PANE[t]} has no text content`);
  }
  if (!F.length) ok.push(`all ${TABS.length} tabs open cold`);

  // ---- 2. every ordered transition (5x5) --------------------------------
  // A tab that renders fine cold can still break when it inherits a sibling's
  // DOM, which is exactly the v0.29.372 failure mode.
  let transBad = 0, transRun = 0;
  for (const from of TABS) for (const to of TABS) {
    if (from === to) continue;
    close();
    const e1 = openTab(from);
    if (e1) continue;                                   // already reported in part 1
    transRun++;
    const btn = modal().querySelector(`.inv-tab[data-utab="${to}"]`);
    if (!btn) { bug('MED', 'tabs', `no tab button for ${to}`, `visible while ${from} is active; the tab is unreachable by click`); transBad++; continue; }
    const e2 = attempt(`${from}->${to}`, () => btn.click());
    if (e2) { bug('HIGH', 'tabs', `switching ${from} -> ${to} throws`, e2); transBad++; continue; }
    const pane = document.getElementById(PANE[to]);
    if (!pane || pane.style.display === 'none') { bug('HIGH', 'tabs', `switching ${from} -> ${to} shows no pane`, `#${PANE[to]} ${pane ? 'display:none' : 'missing'} after the click`); transBad++; continue; }
    // scoped to #u-tabs on purpose: the items pane carries its own
    // .inv-tab equip/use/etc buttons, so an unscoped query reads those
    // and reports a wrong highlight against correct code.
    const active = modal().querySelector('#u-tabs .inv-tab.active');
    if (active && active.dataset.utab !== to) bug('LOW', 'tabs', `the active tab highlight is wrong after ${from} -> ${to}`, `highlight sits on ${active.dataset.utab}, content is ${to}`);
  }
  if (transRun && !transBad) ok.push(`${transRun} tab transitions clean`);

  // ---- 3. the shared-container hazard (v0.29.372's failure mode) --------
  // openAttributes and openLevelUpPanel both own `#attributes-modal .modal`
  // and both rewrite its innerHTML. Whichever runs second must restore what
  // it needs. Drive both orders, repeatedly, and check each panel's OWN
  // marker node survives — a panel that opens but renders the sibling's DOM
  // is the silent half of this bug.
  if (typeof openAttributes === 'function') {
    const seqs = [
      ['attr', 'lp', 'attr'], ['lp', 'attr', 'lp'],
      ['attr', 'lp', 'lp', 'attr'], ['lp', 'attr', 'attr', 'lp'],
    ];
    let bad = 0;
    for (const seq of seqs) {
      close();
      for (let i = 0; i < seq.length; i++) {
        const step = seq[i];
        const err = step === 'attr' ? attempt(`attr@${i}`, () => openAttributes()) : openTab('lp');
        if (err) { bug('HIGH', 'shared-container', `${seq.join('->')} throws at step ${i + 1} (${step})`, err); bad++; break; }
        if (!isOpen()) { bug('HIGH', 'shared-container', `${seq.join('->')} leaves the panel closed at step ${i + 1}`, `${step} ran without throwing but display !== flex`); bad++; break; }
        // marker node unique to each panel
        const marker = step === 'attr' ? 'attr-derived' : 'u-tabs';
        if (!document.getElementById(marker)) { bug('HIGH', 'shared-container', `${seq.join('->')} shows the wrong panel at step ${i + 1}`, `opened ${step} but #${marker} is absent — the sibling's DOM is still mounted`); bad++; break; }
      }
    }
    if (!bad) ok.push(`${seqs.length} attributes<->levelup interleavings keep their own DOM`);
  } else bug('LOW', 'shared-container', 'openAttributes is not a function', 'the sibling panel could not be audited');

  // ---- 4. the same panel under varied player state ----------------------
  // Every pane above rendered against a fresh level-1 character: no points to
  // spend, no boons, no items, no mon. Those are the branches LEAST likely to
  // break. Re-run each tab with the panel actually holding data.
  const states = [
    ['level 1, nothing owned', () => { player.level = 1; }],
    ['level 200, points banked', () => { player.level = 200; }],
    ['a full inventory', () => {
      player.inventory = [];
      for (let i = 0; i < 60; i++) player.inventory.push({ name: 'probe_' + i, type: i % 3 === 0 ? 'weapon' : (i % 3 === 1 ? 'use' : 'etc'), qty: 1 });
    }],
    ['a bound mojimon', () => {
      if (typeof _mojimonEnsure === 'function') _mojimonEnsure().roster.slime = { upg: { hp: 2, atk: 1, def: 1 }, at: 1 };
    }],
  ];
  let stateBad = 0;
  for (const [label, setup] of states) {
    attempt('setup ' + label, setup);
    for (const t of TABS) {
      close();
      const err = openTab(t);
      if (err) { bug('HIGH', 'state', `the ${t} tab throws with ${label}`, err); stateBad++; continue; }
      const pane = document.getElementById(PANE[t]);
      if (!pane || !(pane.textContent || '').trim()) { bug('MED', 'state', `the ${t} tab renders empty with ${label}`, `#${PANE[t]} ${pane ? 'has no text' : 'missing'}`); stateBad++; }
    }
  }
  if (!stateBad) ok.push(`all 5 tabs survive ${states.length} player states (${states.length * TABS.length} renders)`);

  // ---- 5. an unknown tab from a save ------------------------------------
  // game._uTab persists. A save written by a build with a tab this build does
  // not have (or a hand-edited save) must not strand the panel blank.
  close();
  const e5 = openTab('a_tab_that_does_not_exist');
  if (e5) bug('MED', 'robustness', 'an unknown _uTab throws', e5);
  else if (!isOpen()) bug('MED', 'robustness', 'an unknown _uTab leaves the panel closed', 'a stale save value makes U appear to do nothing');
  else {
    const anyPane = TABS.some((t) => { const p = document.getElementById(PANE[t]); return p && p.style.display !== 'none' && (p.textContent || '').trim(); });
    if (!anyPane) bug('MED', 'robustness', 'an unknown _uTab opens a blank panel', 'no pane is shown and no fallback to lp; the player sees an empty sheet');
  }

  // ---- 6. close paths and the pause flag --------------------------------
  // The panel sets game.paused = true on open. Every close route must give it
  // back, or the player is left frozen with no modal to explain why.
  for (const [label, closer] of [
    ['closeAllModals', () => closeAllModals()],
    ['the X button', () => { const b = modal().querySelector('.close-btn,.close'); if (b) b.click(); else throw new Error('no close button in the panel'); }],
    ['Escape', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))],
  ]) {
    close();
    game.paused = false;
    const eo = openTab('lp');
    if (eo) { bug('HIGH', 'close', `could not open to test ${label}`, eo); continue; }
    const ec = attempt(label, closer);
    if (ec) { bug('HIGH', 'close', `${label} throws`, ec); continue; }
    if (isOpen()) bug('HIGH', 'close', `${label} does not close the panel`, 'display is still flex afterwards');
    else if (game.paused) bug('HIGH', 'close', `${label} leaves the game paused`, 'panel closed but game.paused stayed true — the player is frozen with nothing on screen');
  }

  // ---- 7. the real U key, not the function behind it ---------------------
  // Everything above called openLevelUpPanel directly. The keybind adds the
  // class gate, the hp>0 gate and the toggle, none of which are covered yet.
  close();
  const press = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }));
  const ek = attempt('U keydown', press);
  if (ek) bug('HIGH', 'keybind', 'pressing U throws', ek);
  else if (!isOpen()) bug('HIGH', 'keybind', 'pressing U does not open the panel', 'no modal after a real keydown, though openLevelUpPanel works directly');
  else {
    attempt('U keydown again', press);
    if (isOpen()) bug('MED', 'keybind', 'pressing U again does not close the panel', 'toggleSharedModal should close on a repeat press of the same variant');
  }
  // dead player: the panel must stay shut
  close();
  const hpWas = player.hp;
  player.hp = 0;
  attempt('U while dead', press);
  if (isOpen()) bug('MED', 'keybind', 'U opens the panel while dead', 'the hp>0 gate did not hold; spending points mid-death screen');
  player.hp = hpWas;

  // ---- 8. every control in every pane is clickable without throwing ------
  // A render that succeeds can still wire a handler that throws on use. Click
  // everything the panel offers, except controls that would leave the panel or
  // mutate the save in a way this audit cannot undo.
  const SKIP = /prestige|ascend|reset|delete|release|sell|confirm|close|logout|save/i;
  let clicked = 0, clickBad = 0;
  for (const t of TABS) {
    close();
    if (openTab(t)) continue;
    const controls = [...modal().querySelectorAll('button,[role="button"],.u-btn')]
      .filter((b) => !SKIP.test((b.textContent || '') + ' ' + (b.className || '') + ' ' + (b.id || '')));
    for (const b of controls.slice(0, 40)) {
      const e = attempt(`${t}:${(b.textContent || b.id || '?').trim().slice(0, 24)}`, () => b.click());
      clicked++;
      if (e) { bug('MED', 'controls', `a control in the ${t} tab throws when clicked`, e); clickBad++; }
    }
  }
  if (clicked && !clickBad) ok.push(`${clicked} panel controls clicked, none threw`);

  // ---- 9. re-opening must not duplicate nodes ----------------------------
  // openLevelUpPanel rewrites the container's innerHTML each time. If any pane
  // is appended rather than replaced, ids duplicate — getElementById then
  // silently returns the stale first copy and later renders update a node the
  // player cannot see.
  close();
  for (let i = 0; i < 5; i++) { close(); openTab('lp'); }
  const dupes = [];
  for (const t of TABS) {
    const n = modal().querySelectorAll('#' + PANE[t]).length;
    if (n > 1) dupes.push(`${PANE[t]} x${n}`);
  }
  const tabCount = modal().querySelectorAll('#u-tabs .inv-tab').length;
  if (dupes.length) bug('MED', 'leak', 'panes duplicate after repeated opens', `${dupes.join(', ')} — getElementById returns the stale copy`);
  else if (tabCount !== TABS.length) bug('MED', 'leak', 'the tab bar duplicated after repeated opens', `${tabCount} tab buttons after 5 opens, expected ${TABS.length}`);
  else ok.push(`5 open/close cycles leave exactly ${tabCount} tabs and 1 node per pane`);

  // ---- restore ----------------------------------------------------------
  close();
  player.cls = SAVE.cls; player.level = SAVE.level; player.hp = SAVE.hp;
  player.inventory = SAVE.inv; player.mojimon = SAVE.mojimon;
  game._uTab = SAVE.uTab; game.paused = SAVE.paused;

  return { F, ok };
});

console.log(`U-PANEL AUDIT — ${out.F.length} finding(s)\n`);
for (const s of ['HIGH', 'MED', 'LOW']) {
  const g = out.F.filter((f) => f.sev === s);
  if (!g.length) continue;
  console.log(`${s}:`);
  for (const f of g) console.log(`  [${f.area}] ${f.what}\n      ${f.detail}`);
}
if (out.ok.length) console.log('\nclean:');
for (const o of out.ok) console.log('  - ' + o);
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 3).join(' | ') : '\nno page errors');
await browser.close();
process.exit(out.F.some((f) => f.sev === 'HIGH') || errs.length ? 1 : 0);
