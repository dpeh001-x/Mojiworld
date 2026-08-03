// v0.26.948 H: mobile clarity — labeled menu row (+Codex/Y), potion dock by
// the d-pad, sprite-loading pill, char-studio modal trap fix.
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

// H1 — top cluster: menu-only, every button labeled, Codex (Y) added,
// potions moved out (to the new dock by the d-pad).
rep(`    <div class="mc-pots">
      <button class="mc-btn mc-pot mc-hp" data-mkey="pageup" aria-label="HP potion">♥</button>
      <button class="mc-btn mc-pot mc-mp" data-mkey="pagedown" aria-label="MP potion">◆</button>
      <button class="mc-btn mc-menu" data-mkey="u" aria-label="Level up">↑</button>
      <button class="mc-btn mc-menu" data-mkey="i" aria-label="Skills reference">📖</button>
      <button class="mc-btn mc-menu" data-mkey="b" aria-label="Inventory">🎒</button>
      <button class="mc-btn mc-menu" data-mkey="n" aria-label="Interact — chest / NPC / Codex" title="Open chest · Talk to NPC">💬</button>
      <!-- v0.26.016 — three new menu buttons added for full keyboard parity. -->
      <button class="mc-btn mc-menu" data-mkey="w" aria-label="World map" title="World map">🗺</button>
      <button class="mc-btn mc-menu" data-mkey="e" aria-label="Quest journal" title="Quest journal">📜</button>
      <button class="mc-btn mc-menu" data-mkey="q" aria-label="Wardrobe / Character Studio" title="Wardrobe / Character Studio">👗</button>
    </div>`,
`    <!-- v0.26.948 — Menu row clarity pass: every button carries a tiny text
         label (icons alone weren't self-explanatory), the Codex (Y) gets its
         own button, and the HP/MP potions moved to a labeled dock beside the
         d-pad (.mc-pot-dock in #mobile-deck) at thumb reach. -->
    <div class="mc-pots">
      <button class="mc-btn mc-menu" data-mkey="w" aria-label="World map" title="World map"><span class="mc-ico">🗺</span><span class="mc-lbl">MAP</span></button>
      <button class="mc-btn mc-menu" data-mkey="e" aria-label="Quest journal" title="Quest journal"><span class="mc-ico">📜</span><span class="mc-lbl">QUEST</span></button>
      <button class="mc-btn mc-menu" data-mkey="b" aria-label="Inventory" title="Inventory"><span class="mc-ico">🎒</span><span class="mc-lbl">BAG</span></button>
      <button class="mc-btn mc-menu" data-mkey="u" aria-label="Level up / attributes" title="Level up"><span class="mc-ico">↑</span><span class="mc-lbl">LV UP</span></button>
      <button class="mc-btn mc-menu" data-mkey="i" aria-label="Skills reference" title="Skills reference"><span class="mc-ico">📖</span><span class="mc-lbl">SKILL</span></button>
      <button class="mc-btn mc-menu" data-mkey="y" aria-label="Codex — world lore map" title="Codex"><span class="mc-ico">📔</span><span class="mc-lbl">CODEX</span></button>
      <button class="mc-btn mc-menu" data-mkey="q" aria-label="Wardrobe / Character Studio" title="Wardrobe"><span class="mc-ico">👗</span><span class="mc-lbl">STYLE</span></button>
      <button class="mc-btn mc-menu" data-mkey="n" aria-label="Interact — chest / NPC" title="Open chest · Talk to NPC"><span class="mc-ico">💬</span><span class="mc-lbl">TALK</span></button>
    </div>`, 'H1 menu row relabel');

// H2 — potion dock markup inside #mobile-deck (inherits hide/forced rules).
rep(`  <!-- Block (A) — lives OUTSIDE .mc-actions so it can be positioned`,
`  <!-- v0.26.948 — Potion dock: HP/MP moved from the top menu row to the
       thumb's reach beside the d-pad, with explicit labels. Lives inside
       #mobile-deck so hide-mobile-ctrl / forced-modal rules apply. -->
  <div class="mc-pot-dock">
    <button class="mc-btn mc-pot mc-hp" data-mkey="pageup" aria-label="HP potion"><span class="mc-ico">♥</span><span class="mc-lbl">HP</span></button>
    <button class="mc-btn mc-pot mc-mp" data-mkey="pagedown" aria-label="MP potion"><span class="mc-ico">◆</span><span class="mc-lbl">MP</span></button>
  </div>
  <!-- Block (A) — lives OUTSIDE .mc-actions so it can be positioned`, 'H2 potion dock DOM');

// H3 — sprite-loading pill: global counters + the pill renderer.
rep(`function _lxPreloadMapAssets(id, onProgress) {`,
`// v0.26.948 — Top-left pill showing background sprite loading while playing.
// The boot gate already blocks on the start map's set; this makes the
// DEFERRED rest (later maps, heavy boss sets) visible as it streams in.
function _lxSpritePillTick() {
  if (!document.body) return;
  let p = document.getElementById('sprite-load-pill');
  if (!p) {
    p = document.createElement('div');
    p.id = 'sprite-load-pill';
    document.body.appendChild(p);
  }
  const t = window._lxSpriteTotal || 0;
  const d = window._lxSpriteDone || 0;
  if (t > 0 && d < t) {
    p.textContent = '⏳ Loading sprites ' + d + '/' + t;
    p.style.display = 'block';
    if (window._lxSpritePillHideT) { clearTimeout(window._lxSpritePillHideT); window._lxSpritePillHideT = 0; }
  } else if (t > 0 && !window._lxSpritePillHideT) {
    p.textContent = '✓ All sprites loaded';
    p.style.display = 'block';
    window._lxSpritePillHideT = setTimeout(() => {
      p.style.display = 'none';
      window._lxSpritePillHideT = 0;
    }, 1800);
  }
}
function _lxPreloadMapAssets(id, onProgress) {`, 'H3a pill fn');
rep(`  const total = jobs.length;
  let done = 0;
  const tick = () => { done++; if (onProgress) { try { onProgress(done, total); } catch (e) {} } };`,
`  const total = jobs.length;
  let done = 0;
  window._lxSpriteTotal = (window._lxSpriteTotal || 0) + total;   // v0.26.948 — feeds the progress pill
  const tick = () => {
    done++;
    window._lxSpriteDone = (window._lxSpriteDone || 0) + 1;
    try { _lxSpritePillTick(); } catch (e) {}
    if (onProgress) { try { onProgress(done, total); } catch (e) {} }
  };`, 'H3b pill counters');

// H4 — Character Studio (Q) signals open via a class, not display:flex —
// it was missed by the modal trap, so deck buttons ate taps over it.
rep(`    if (!anyOpen) {
      try {
        anyOpen = Array.prototype.some.call(
          document.querySelectorAll('.modal-overlay'),
          (el) => el.style.display === 'flex'
        );
      } catch (e) {}
    }`,
`    if (!anyOpen) {
      try {
        anyOpen = Array.prototype.some.call(
          document.querySelectorAll('.modal-overlay'),
          (el) => el.style.display === 'flex'
        );
      } catch (e) {}
    }
    // v0.26.948 — Character Studio opens via classList 'on', not display.
    if (!anyOpen) {
      try {
        const _cs = document.getElementById('char-studio-overlay');
        if (_cs && (_cs.classList.contains('on') || _cs.classList.contains('open'))) anyOpen = true;
      } catch (e) {}
    }`, 'H4a charstudio trap');
rep(`  // v0.26.946 — observe every modal overlay for the generalized check.
  try {
    document.querySelectorAll('.modal-overlay').forEach((el) => {
      const obs = new MutationObserver(_syncForcedModal);
      obs.observe(el, { attributes: true, attributeFilter: ['style'] });
      window._forcedModalObservers.push(obs);
    });
  } catch (e) {}`,
`  // v0.26.946 — observe every modal overlay for the generalized check.
  try {
    document.querySelectorAll('.modal-overlay').forEach((el) => {
      const obs = new MutationObserver(_syncForcedModal);
      obs.observe(el, { attributes: true, attributeFilter: ['style'] });
      window._forcedModalObservers.push(obs);
    });
  } catch (e) {}
  // v0.26.948 — char-studio toggles via class.
  try {
    const _csEl = document.getElementById('char-studio-overlay');
    if (_csEl) {
      const obs = new MutationObserver(_syncForcedModal);
      obs.observe(_csEl, { attributes: true, attributeFilter: ['class', 'style'] });
      window._forcedModalObservers.push(obs);
    }
  } catch (e) {}`, 'H4b charstudio observer');

rep(`const GAME_VERSION = 'v0.26.946';`, `const GAME_VERSION = 'v0.26.948';`, 'H5 version');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v948_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v948_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmph', s, 'utf8');
await rename(FILE + '.tmph', FILE);
console.log('H DONE');
