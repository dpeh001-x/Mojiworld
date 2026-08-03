// v0.26.950 M: B (master ult) button joins the arc; Void boss-rush portal
// removed (Echoes lives at the Interdimensional tower base now); sprite
// bar moved to top-left + shown at world reveal.
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

// M1 — B button DOM (8th skill in the grid).
rep(`<button class="mc-btn mc-skill" data-mkey="g" aria-label="Skill G (master)" data-empty="1"><span class="mc-icon"></span><span class="mc-key">G</span><span class="mc-cd"></span></button>`,
`<button class="mc-btn mc-skill" data-mkey="g" aria-label="Skill G (master)" data-empty="1"><span class="mc-icon"></span><span class="mc-key">G</span><span class="mc-cd"></span></button>
      <button class="mc-btn mc-skill" data-mkey="b" aria-label="Skill B (master ultimate)" data-empty="1"><span class="mc-icon"></span><span class="mc-key">B</span><span class="mc-cd"></span></button>`, 'M1 B button DOM');

// M2 — outer arc re-fanned for 4 buttons (F/V/G/B at 170/140/110/80 deg, r=150).
rep(`    .mc-skill-grid .mc-btn:nth-child(5) { right: 179px; bottom: 71px;  width: 42px !important; height: 42px !important; } /* F */
    .mc-skill-grid .mc-btn:nth-child(6) { right: 140px; bottom: 138px; width: 42px !important; height: 42px !important; } /* V */
    .mc-skill-grid .mc-btn:nth-child(7) { right: 73px;  bottom: 177px; width: 42px !important; height: 42px !important; } /* G */`,
`    /* v0.26.950 — outer arc re-fanned for FOUR buttons (B master-ult joins). */
    .mc-skill-grid .mc-btn:nth-child(5) { right: 182px; bottom: 58px;  width: 42px !important; height: 42px !important; } /* F */
    .mc-skill-grid .mc-btn:nth-child(6) { right: 149px; bottom: 128px; width: 42px !important; height: 42px !important; } /* V */
    .mc-skill-grid .mc-btn:nth-child(7) { right: 85px;  bottom: 173px; width: 42px !important; height: 42px !important; } /* G */
    .mc-skill-grid .mc-btn:nth-child(8) { right: 8px;   bottom: 180px; width: 42px !important; height: 42px !important; } /* B — master ult */`, 'M2 arc re-fan');

// M3 — Void boss-rush portal removed (per user; tower-base entry remains).
rep(`      { x:400, y:420, dest:'town', name:'⭐ Everdawn Central', iconStar:true },
      { x:620, y:420, dest:'boss_rush', name:'⚔ Hall of Echoes', iconStar:true },   // v0.26.x — Boss Rush entry
    ],`,
`      { x:400, y:420, dest:'town', name:'⭐ Everdawn Central', iconStar:true },
      // v0.26.950 — Hall of Echoes portal removed from The Void (per user);
      // the boss-rush entry now lives at the BASE of the Interdimensional
      // Ascension (x680, beside the Wayfarer's Lantern exit — v0.26.949).
    ],`, 'M3 void portal removed');

// M4 — codex text updated to the new location.
rep(`the ⭐ star portal leads to town, and the <b>⚔ Hall of Echoes</b> beside it is a boss-rush arena that replays bosses you\\'ve already faced — it wakes once you\\'ve met your first boss.`,
`the ⭐ star portal leads to town. The <b>⚔ Hall of Echoes</b> — a boss-rush arena that replays bosses you\\'ve already faced — stands at the base of the Interdimensional Ascension; it wakes once you\\'ve met your first boss.`, 'M4 codex text');

// M5 — sprite bar to the top-LEFT (under the version tag), above the deck.
rep(`    top: calc(6px + env(safe-area-inset-top));
    left: 50%; transform: translateX(-50%);   /* v0.26.949 — top centre */
    min-width: 210px; text-align: center;
    z-index: 60; display: none;`,
`    top: calc(24px + env(safe-area-inset-top));   /* v0.26.950 — top-left, under the version tag */
    left: calc(6px + env(safe-area-inset-left));
    min-width: 190px; text-align: left;
    z-index: 80; display: none;`, 'M5 bar top-left');

// M6 — surface the bar at world reveal so its state is always seen once.
rep(`    // v0.25.233 — Start the looping BGM the moment the world reveals.
    startBgm();`,
`    // v0.25.233 — Start the looping BGM the moment the world reveals.
    startBgm();
    // v0.26.950 — flash the sprite-load bar at reveal ("✓ All sprites
    // loaded" for 1.8s, or live progress if anything is still streaming).
    try { if (typeof _lxSpritePillTick === 'function') _lxSpritePillTick(); } catch (e) {}`, 'M6 reveal tick');

rep(`const GAME_VERSION = 'v0.26.949';`, `const GAME_VERSION = 'v0.26.950';`, 'M7 version');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v950_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v950_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpm', s, 'utf8');
await rename(FILE + '.tmpm', FILE);
console.log('M DONE');
