// v0.26.953 P: BAG/SKILL deep-link into U-panel tabs; settings modal fits
// landscape phones; boot gate covers worn gear + props/items registries
// with a longer cap (the "partially loaded sprites" report).
import { readFile, writeFile, rename } from 'node:fs/promises';
import { execSync } from 'node:child_process';
const FILE = 'C:/Users/Xenon/Desktop/Mojiworld/mojiworld_game.html';
let s = await readFile(FILE, 'utf8');
function rep(old, neu, label) {
  let o = old, n = neu, c = s.split(o).length - 1;
  if (c !== 1) { o = old.replace(/\n/g, '\r\n'); n = neu.replace(/\n/g, '\r\n'); c = s.split(o).length - 1; }
  if (c !== 1) { console.error(`FAIL ${label}: ${c}`); process.exit(2); }
  s = s.split(o).join(n); console.log('ok: ' + label);
}

// P1a — BAG / SKILL buttons stop dispatching dead keys ('b' is the ult,
// 'i' never reached the U panel); they deep-link into the U-panel tabs.
rep(`      <button class="mc-btn mc-menu" data-mkey="b" aria-label="Inventory" title="Inventory"><span class="mc-ico">🎒</span><span class="mc-lbl">BAG</span></button>`,
`      <button class="mc-btn mc-menu" data-dynamic="utab" data-utab-target="items" aria-label="Inventory — opens the U panel Items tab" title="Inventory"><span class="mc-ico">🎒</span><span class="mc-lbl">BAG</span></button>`, 'P1a BAG button');
rep(`      <button class="mc-btn mc-menu" data-mkey="i" aria-label="Skills reference" title="Skills reference"><span class="mc-ico">📖</span><span class="mc-lbl">SKILL</span></button>`,
`      <button class="mc-btn mc-menu" data-dynamic="utab" data-utab-target="skills" aria-label="Skills — opens the U panel Skills tab" title="Skills"><span class="mc-ico">📖</span><span class="mc-lbl">SKILL</span></button>`, 'P1b SKILL button');

// P1c — opener + wiring.
rep(`function _initMobileControls() {`,
`// v0.26.953 — BAG / SKILL menu buttons open the U panel pre-switched to
// the right tab (Items / Skills). If the panel is already open, just
// click the in-panel tab; same-tab second tap closes via the shared
// toggle, matching the U key's feel.
function _lxOpenUPanelTab(tab) {
  try {
    if (typeof player === 'undefined' || !player.cls) {
      if (typeof showToast === 'function') showToast('Pick a class first', 'common');
      return;
    }
    const m = document.getElementById('attributes-modal');
    if (m && m.style.display === 'flex') {
      if (game._uTab === tab) { closeAllModals(); return; }
      const btn = m.querySelector('.inv-tab[data-utab="' + tab + '"]');
      if (btn) { btn.click(); return; }
    }
    game._uTab = tab;
    if (typeof toggleSharedModal === 'function' && typeof openLevelUpPanel === 'function') {
      toggleSharedModal('attributes-modal', 'lp', openLevelUpPanel);
    }
  } catch (e) {}
}
function _initMobileControls() {`, 'P1c opener fn');
rep(`  _wireSmartDpad();
  _wireDynamicFButton();`,
`  _wireSmartDpad();
  _wireDynamicFButton();
  // v0.26.953 — U-panel tab deep-links (BAG -> Items, SKILL -> Skills).
  document.querySelectorAll('.mobile-ctrl [data-dynamic="utab"]').forEach((btn) => {
    if (btn._utabWired) return;
    btn._utabWired = true;
    btn.addEventListener('pointerdown', (ev) => ev.preventDefault(), { passive: false });
    btn.addEventListener('pointerup', (ev) => {
      ev.preventDefault();
      _lxOpenUPanelTab(btn.dataset.utabTarget);
    }, { passive: false });
  });`, 'P1d wiring');

// P2 — settings modal fits short landscape viewports.
rep(`  /* Universal modal ✕ — body-level, above everything (z 220). */`,
`  /* Settings modal — fit short landscape phones (was min-width 440px,
     fixed padding, no scroll: the volume rows overflowed the screen). */
  @media (pointer: coarse), (max-width: 900px) {
    #settings-modal {
      min-width: 0 !important;
      width: min(440px, 92vw) !important;
      max-height: calc(100dvh - 20px) !important;
      overflow-y: auto !important;
      padding: 12px 16px !important;
    }
  }

  /* Universal modal ✕ — body-level, above everything (z 220). */`, 'P2 settings CSS');

// P3a — props / items / B-ult projectiles / equip-layer registries join
// the warm decode (they were invisible to it — props + gear popped in).
rep(`    try { _regs.push(typeof _NPC_SPRITES     !== 'undefined' ? _NPC_SPRITES     : null); } catch (e) {}`,
`    try { _regs.push(typeof _NPC_SPRITES     !== 'undefined' ? _NPC_SPRITES     : null); } catch (e) {}
    // v0.26.953 — these were missing: map props, item icons, B-ult
    // projectiles, and the seven worn-equipment layer registries.
    try { _regs.push(typeof LX_OBJECTS       !== 'undefined' ? LX_OBJECTS       : null); } catch (e) {}
    try { _regs.push(typeof LX_ITEMS         !== 'undefined' ? LX_ITEMS         : null); } catch (e) {}
    try { _regs.push(typeof LX_BULT_PROJ     !== 'undefined' ? LX_BULT_PROJ     : null); } catch (e) {}
    try { _regs.push(typeof LX_EQ_REGISTRIES !== 'undefined' ? LX_EQ_REGISTRIES : null); } catch (e) {}`, 'P3a registries');

// P3b — the player's WORN gear was lazy (first-draw) — the character
// revealed half-dressed on slow links ("Sprite still loading…" toast).
rep(`    // Active-deck skill icons (~250KB total) — boot-critical for the mobile HUD.`,
`    // v0.26.953 — preload the player's WORN gear overlays (weapon/armor)
    // via the same spriteId resolution the renderer uses.
    try {
      const eq = (typeof player !== 'undefined' && player && player.equipped) ? player.equipped : null;
      if (eq && typeof _lxEquipSprite === 'function') {
        for (const slot in eq) {
          const item = eq[slot];
          if (!item) continue;
          const sid = item.spriteId ||
            ((typeof _lxAutoEquipSpriteId === 'function') ? _lxAutoEquipSpriteId(slot, item) : null);
          if (!sid || typeof sid !== 'string') continue;
          if (sid.indexOf('wpn:') === 0)      track(_lxEquipSprite('weapons', sid.slice(4)));
          else if (sid.indexOf('arm:') === 0) track(_lxEquipSprite('armors',  sid.slice(4)));
        }
      }
    } catch (e) {}
    // Active-deck skill icons (~250KB total) — boot-critical for the mobile HUD.`, 'P3b worn gear');

// P3c — the 12s caps released slow connections into a half-loaded world;
// 30s gate / 25s preloader keeps "everything loaded" honest while the
// live counter shows it working.
rep(`      setTimeout(_proceed, 12000);`, `      setTimeout(_proceed, 30000);`, 'P3c gate cap');
rep(`  return Promise.race([all, new Promise((res) => setTimeout(res, 12000))]).then(() => total);`,
`  return Promise.race([all, new Promise((res) => setTimeout(res, 25000))]).then(() => total);`, 'P3d preload cap');

rep(`const GAME_VERSION = 'v0.26.952';`, `const GAME_VERSION = 'v0.26.953';`, 'P4 version');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v953_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v953_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpP', s, 'utf8');
await rename(FILE + '.tmpP', FILE);
console.log('P DONE');
