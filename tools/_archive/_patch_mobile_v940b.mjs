// Mobile v0.26.940 patch B: MapleStory-M-style face cluster.
// Big corner attack circle, skills fanned in two arcs, jump inset left.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { execSync } from 'node:child_process';
const FILE = 'C:/Users/Xenon/Desktop/Mojiworld/mojiworld_game.html';
let s = await readFile(FILE, 'utf8');

function rep(old, neu, label) {
  let o = old, n = neu;
  let c = s.split(o).length - 1;
  if (c !== 1) { o = old.replace(/\n/g, '\r\n'); n = neu.replace(/\n/g, '\r\n'); c = s.split(o).length - 1; }
  if (c !== 1) { console.error(`FAIL ${label}: ${c} matches`); process.exit(2); }
  s = s.split(o).join(n);
  console.log(`ok: ${label}`);
}

// B1 — landscape cluster: grid -> MapleStory-M corner arc.
rep(`    .mc-actions {
      display: grid !important;
      position: fixed !important;
      grid-template-columns: 58px 58px 58px;
      grid-template-rows: 58px 58px 58px;
      width: 200px; height: 200px;
      gap: 13px;
      flex-direction: unset !important;
      align-items: unset !important;
      pointer-events: none;
    }
    .mc-jump {
      grid-column: 2; grid-row: 1;
      width: 58px !important; height: 58px !important;
      font-size: 26px !important;
      border-radius: 50% !important;
      /* Amber accent — stays visually loud even on translucent theme */
      background: rgba(255,170,80,0.32) !important;
      border-color: rgba(255,220,140,0.75) !important;
      color: #fff6cc !important;
    }
    .mc-defense-row .mc-basic {
      grid-column: 2 / span 1;
      grid-row: 2 / span 1;
      width: 60px !important; height: 60px !important;
      font-size: 20px !important;
      border-radius: 50% !important;
      /* Crimson accent — primary attack reads first */
      background: rgba(255,80,100,0.32) !important;
      border-color: rgba(255,180,200,0.8) !important;
      color: #ffeef0 !important;
      justify-self: center;
      align-self: center;
      z-index: 2;
    }
    .mc-skill-grid { display: contents !important; }
    .mc-skill-grid .mc-btn {
      width: 58px !important; height: 58px !important;
      border-radius: 50% !important;
      font-size: 16px !important;
    }
    .mc-skill-grid .mc-btn:nth-child(1) { grid-column: 3; grid-row: 2; } /* X key → right  */
    .mc-skill-grid .mc-btn:nth-child(2) { grid-column: 1; grid-row: 2; } /* S key → left   */
    .mc-skill-grid .mc-btn:nth-child(3) { grid-column: 2; grid-row: 3; } /* C key → bottom */
    .mc-skill-grid .mc-btn:nth-child(4) { grid-column: 1; grid-row: 1; } /* D key → top-L  */
    .mc-skill-grid .mc-btn:nth-child(5) { grid-column: 3; grid-row: 3; } /* F key → bot-R  */
    .mc-skill-grid .mc-btn:nth-child(6) { grid-column: 3; grid-row: 1; } /* V key → top-R  */
    .mc-skill-grid .mc-btn:nth-child(7) { grid-column: 1; grid-row: 3; } /* G key → bot-L  */`,
`    /* v0.26.940 — MapleStory-M-style face cluster. One big attack
       thumb-circle anchored in the corner, skills fanned around it in
       two arcs (inner r=95: X/S/C/D primaries at 180/150/120/90 deg,
       outer r=150: F/V/G utility + ults at 165/135/105 deg), jump
       inset to the left at the thumb's resting reach. */
    .mc-actions {
      display: block !important;
      position: fixed !important;
      width: 320px; height: 230px;
      flex-direction: unset !important;
      align-items: unset !important;
      pointer-events: none;
    }
    .mc-actions .mc-btn { position: absolute !important; }
    .mc-jump {
      right: 250px; bottom: 8px;
      width: 60px !important; height: 60px !important;
      font-size: 26px !important;
      border-radius: 50% !important;
      /* Amber accent — stays visually loud even on translucent theme */
      background: rgba(255,170,80,0.32) !important;
      border-color: rgba(255,220,140,0.75) !important;
      color: #fff6cc !important;
    }
    .mc-defense-row .mc-basic {
      right: 12px; bottom: 10px;
      width: 86px !important; height: 86px !important;
      font-size: 30px !important;
      border-radius: 50% !important;
      /* Crimson accent — primary attack reads first */
      background: rgba(255,80,100,0.38) !important;
      border-color: rgba(255,180,200,0.85) !important;
      color: #ffeef0 !important;
      z-index: 2;
    }
    .mc-skill-grid { display: contents !important; }
    .mc-skill-grid .mc-btn {
      width: 46px !important; height: 46px !important;
      border-radius: 50% !important;
      font-size: 15px !important;
    }
    .mc-skill-grid .mc-btn:nth-child(1) { right: 127px; bottom: 30px;  } /* X — closest to thumb */
    .mc-skill-grid .mc-btn:nth-child(2) { right: 114px; bottom: 78px;  } /* S */
    .mc-skill-grid .mc-btn:nth-child(3) { right: 80px;  bottom: 112px; } /* C */
    .mc-skill-grid .mc-btn:nth-child(4) { right: 32px;  bottom: 125px; } /* D — above attack */
    .mc-skill-grid .mc-btn:nth-child(5) { right: 179px; bottom: 71px;  width: 42px !important; height: 42px !important; } /* F */
    .mc-skill-grid .mc-btn:nth-child(6) { right: 140px; bottom: 138px; width: 42px !important; height: 42px !important; } /* V */
    .mc-skill-grid .mc-btn:nth-child(7) { right: 73px;  bottom: 177px; width: 42px !important; height: 42px !important; } /* G */`,
  'B1 landscape arc');

// B2 — portrait: scale the whole cluster instead of re-gridding it.
rep(`    .mc-actions {
      grid-template-columns: 48px 48px 48px !important;
      grid-template-rows: 48px 48px 48px !important;
      width: 160px !important; height: 160px !important;
      gap: 8px !important;
    }
    .mc-jump, .mc-defense-row .mc-basic, .mc-skill-grid .mc-btn {
      width: 48px !important; height: 48px !important;
    }
    .mc-jump                    { font-size: 22px !important; }
    .mc-defense-row .mc-basic   { font-size: 16px !important; width: 52px !important; height: 52px !important; }
    .mc-skill-grid .mc-btn      { font-size: 14px !important; }`,
`    /* v0.26.940 — arc cluster scales down as one unit in portrait. */
    .mc-actions {
      transform: scale(0.78);
      transform-origin: bottom right;
    }`,
  'B2 portrait scale');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
const chk = 'C:/Users/Xenon/Desktop/Mojiworld/tools/_v940_check.js';
await writeFile(chk, big, 'utf8');
execSync(`node --check "${chk}"`, { stdio: 'inherit' });
console.log('syntax OK ' + big.length + ' chars');
await writeFile(FILE + '.tmpb', s, 'utf8');
const back = await readFile(FILE + '.tmpb', 'utf8');
if (back.length !== s.length) { console.error('size mismatch'); process.exit(4); }
await rename(FILE + '.tmpb', FILE);
console.log('PATCH B DONE — size ' + s.length);
