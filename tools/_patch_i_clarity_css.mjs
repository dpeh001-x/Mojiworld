// v0.26.948 I: clarity CSS — 44px modal close buttons, icon+label menu
// buttons, potion dock by the d-pad, sprite-loading pill.
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

rep(`  /* ---- MOBILE HUD STACK ------------------------------------------`,
`  /* ===== v0.26.948 — MOBILE CLARITY PASS =========================== */
  @media (pointer: coarse), (max-width: 900px) {
    /* Modal close buttons were 21px — untappable. 44px touch floor. */
    .modal-overlay .close-btn, .modal .close-btn {
      min-width: 44px !important; min-height: 44px !important;
      font-size: 22px !important;
      display: inline-flex !important;
      align-items: center !important; justify-content: center !important;
    }
    /* Menu buttons: icon + tiny label so each function is self-evident. */
    .mobile-ctrl .mc-menu {
      display: inline-flex !important; flex-direction: column !important;
      align-items: center !important; justify-content: center !important;
      gap: 1px !important;
    }
    .mobile-ctrl .mc-menu .mc-ico { font-size: 15px; line-height: 1; }
    .mobile-ctrl .mc-menu .mc-lbl {
      font-size: 7px; line-height: 1;
      letter-spacing: 0.4px; font-weight: 700; opacity: 0.92;
    }
    /* Potion dock — beside the d-pad at thumb reach, clearly labeled. */
    .mc-pot-dock {
      position: fixed !important; z-index: 71;
      left: calc(198px + env(safe-area-inset-left));
      bottom: calc(20px + env(safe-area-inset-bottom));
      display: flex; flex-direction: column; gap: 8px;
      pointer-events: none !important;
    }
    .mc-pot-dock .mc-btn {
      pointer-events: auto !important;
      width: 52px !important; height: 52px !important;
      border-radius: 50% !important;
      display: inline-flex !important; flex-direction: column !important;
      align-items: center !important; justify-content: center !important;
      gap: 1px !important;
    }
    .mc-pot-dock .mc-ico { font-size: 17px; line-height: 1; }
    .mc-pot-dock .mc-lbl { font-size: 8px; line-height: 1; font-weight: 700; letter-spacing: 0.4px; }
    .mc-pot-dock .mc-hp { border-color: rgba(255,140,160,0.9) !important; color: #ffeef0 !important; background: rgba(255,120,140,0.3) !important; }
    .mc-pot-dock .mc-mp { border-color: rgba(140,180,255,0.9) !important; color: #eef2ff !important; background: rgba(120,160,255,0.3) !important; }
  }
  @media (pointer: coarse) and (orientation: portrait),
         (max-width: 900px) and (orientation: portrait) {
    .mc-pot-dock {
      left: calc(156px + env(safe-area-inset-left));
      bottom: calc(86px + env(safe-area-inset-bottom));
    }
  }
  /* Background sprite-loading pill (created lazily by _lxSpritePillTick). */
  #sprite-load-pill {
    position: fixed;
    top: calc(24px + env(safe-area-inset-top));
    left: calc(6px + env(safe-area-inset-left));
    z-index: 60; display: none;
    font: 700 10px/1.5 'Segoe UI', system-ui, sans-serif;
    color: #d8f5e2;
    background: rgba(10, 30, 22, 0.74);
    border: 1px solid rgba(110, 231, 168, 0.55);
    border-radius: 12px; padding: 3px 10px;
    pointer-events: none;
  }

  /* ---- MOBILE HUD STACK ------------------------------------------`, 'I1 clarity CSS block');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v948_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v948_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpi', s, 'utf8');
await rename(FILE + '.tmpi', FILE);
console.log('I DONE');
