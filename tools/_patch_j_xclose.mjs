// v0.26.948 J: universal mobile modal-close button. Key-toggle-only modals
// (Codex/Y, wardrobe) trapped phone players once the deck auto-hid.
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

// J1 — body-level button (outside .game-wrapper so it escapes the
// transform stacking context that traps in-wrapper modals).
rep(`<button id="fullscreen-btn" onclick="toggleFullscreenDesktop()"`,
`<!-- v0.26.948 — Universal modal close for touch. Several modals (Codex/Y,
     wardrobe/Q) are key-toggle-only; with the deck hidden under
     forced-modal a phone player had no way out. Shown only while a
     DISMISSIBLE modal is up (body.forced-modal-closable). -->
<button id="mc-modal-close" onclick="if (typeof closeAllModals === 'function') closeAllModals();" aria-label="Close window">✕</button>
<button id="fullscreen-btn" onclick="toggleFullscreenDesktop()"`, 'J1 close button DOM');

// J2 — closable flag: forced-modal minus the mandatory-decision modals.
rep(`    document.body.classList.toggle('forced-modal', anyOpen);
  };`,
`    document.body.classList.toggle('forced-modal', anyOpen);
    // v0.26.948 — the universal ✕ shows only for dismissible modals
    // (class-select / advancement / tutorial are mandatory decisions).
    let _mandatoryOpen = false;
    try {
      _mandatoryOpen = ['class-select-modal', 'advancement-modal', 'tutorial-modal'].some((id) => {
        const el = document.getElementById(id);
        return el && el.style.display === 'flex';
      });
    } catch (e) {}
    document.body.classList.toggle('forced-modal-closable', anyOpen && !_mandatoryOpen);
  };`, 'J2 closable flag');

// J3 — CSS in the clarity block.
rep(`  /* Background sprite-loading pill (created lazily by _lxSpritePillTick). */`,
`  /* Universal modal ✕ — body-level, above everything (z 220). */
  #mc-modal-close {
    display: none;
    position: fixed;
    top: calc(10px + env(safe-area-inset-top));
    right: calc(10px + env(safe-area-inset-right));
    width: 48px; height: 48px;
    z-index: 220;
    border-radius: 50%;
    border: 2px solid rgba(255, 160, 170, 0.9);
    background: rgba(40, 12, 20, 0.85);
    color: #ffdde2; font-size: 22px; line-height: 1;
    align-items: center; justify-content: center;
    cursor: pointer;
    pointer-events: auto;
  }
  body.forced-modal-closable #mc-modal-close { display: flex !important; }

  /* Background sprite-loading pill (created lazily by _lxSpritePillTick). */`, 'J3 close CSS');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v948_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v948_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpj', s, 'utf8');
await rename(FILE + '.tmpj', FILE);
console.log('J DONE');
