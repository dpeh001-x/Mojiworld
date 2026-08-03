// v0.26.957 Q: prologue (Gravitos flash-forward) moves AFTER character
// creation — sprites are loaded by then, and the battle uses the player's
// chosen design (look + matching apex class chain).
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

// Q1 — boot: fresh save goes straight to creation; prologue armed for after.
rep(`    loadMap('void', 260);
    window._prologuePending = true;
    // Defensive fallback for builds without the loader/login gate. MUST be
    // deferred: this boot block executes during parsing, BEFORE the
    // #loading-overlay element further down the document exists — an
    // immediate getElementById here is always null and would start the
    // cinematic under the gate again (the very bug being fixed). After the
    // DOM settles, a present overlay means _finishHide() owns the start.
    setTimeout(() => {
      if (window._prologuePending && !document.getElementById('loading-overlay')) {
        window._prologuePending = false;
        _startPrologue();
      }
    }, 1500);`,
`    // v0.26.957 — Prologue moved AFTER character creation (per user): at
    // boot time the boss/arena sprites hadn't loaded yet, and playing it
    // post-creation lets the flash-forward use the player's chosen design.
    // applyClass (the real player pick) starts the cinematic once the
    // arena's sprites are preloaded; _prologuePending is no longer armed.
    loadMap('void', 260);
    window._prologueAfterCreation = true;
    openClassSelect();`, 'Q1 boot rewire');

// Q2 — applyClass: fresh save -> preload arena, then prologue (tutorial
// hand-off moves into _prologueFinish).
rep(`    setTimeout(() => {
      if (window._prologueActive) return;   // v0.26.x — apex class apply is not the player's class pick
      if (typeof _wireTutorialButtons === 'function') _wireTutorialButtons();
      if (typeof startTutorial === 'function') startTutorial();
    }, 600);`,
`    setTimeout(() => {
      if (window._prologueActive) return;   // v0.26.x — apex class apply is not the player's class pick
      // v0.26.957 — fresh save: the flash-forward prologue plays HERE, after
      // creation, wearing the player's chosen design. The arena's sprites
      // preload first (15s cap; usually instant — the post-auth heavy decode
      // has been running since the login form). Tutorial moves to
      // _prologueFinish so it still fires after the cinematic.
      if (window._prologueAfterCreation) {
        window._prologueAfterCreation = false;
        const _go = () => { try { if (typeof _startPrologue === 'function') _startPrologue(); } catch (e) {} };
        try {
          Promise.race([
            Promise.allSettled([
              (typeof _lxPreloadMapAssets === 'function') ? _lxPreloadMapAssets('gravitosArena') : null,
              (typeof _warmDecodeRegistries === 'function') ? _warmDecodeRegistries(true) : null,
            ]),
            new Promise((r) => setTimeout(r, 15000)),
          ]).then(_go, _go);
        } catch (e) { _go(); }
        return;
      }
      if (typeof _wireTutorialButtons === 'function') _wireTutorialButtons();
      if (typeof startTutorial === 'function') startTutorial();
    }, 600);`, 'Q2 applyClass hook');

// Q3 — apex form follows the chosen class.
rep(`    if (typeof devSetMasterChain === 'function') devSetMasterChain('rogue', 'ninja', 'shinobi');`,
`    // v0.26.957 — the apex form follows the class the player just chose,
    // so the flash-forward stars THEIR character design (look persists via
    // player.lookCustom; the snapshot/restore returns them to Lv.1 after).
    const _apexByClass = {
      warrior: ['warrior', 'berserker', 'warlord'],
      rogue:   ['rogue',   'ninja',     'shinobi'],
      mage:    ['mage',    'archmage',  'sage'],
      archer:  ['archer',  'sniper',    'marksman'],
    };
    const _apex = _apexByClass[player.cls] || _apexByClass.rogue;
    if (typeof devSetMasterChain === 'function') devSetMasterChain(_apex[0], _apex[1], _apex[2]);`, 'Q3 apex per class');

// Q4 — finish: hand off to the tutorial (creation already happened).
rep(`  if (!skipped && typeof showToast === 'function') {
    showToast('✦ You will get back there. Your legend begins at Lv.1.', 'epic');
  }
  openClassSelect();
}`,
`  if (!skipped && typeof showToast === 'function') {
    showToast('✦ You will get back there. Your legend begins at Lv.1.', 'epic');
  }
  // v0.26.957 — the prologue now plays AFTER creation: hand off to the
  // tutorial instead of re-opening character creation. The creation call
  // stays as a fallback for any legacy pre-creation entry path.
  if (typeof player !== 'undefined' && player && player.cls) {
    let _seenTut = false;
    try { _seenTut = localStorage.getItem('mojiworld_tutorial_seen') === '1'; } catch (e) {}
    if (!_seenTut) {
      setTimeout(() => {
        if (typeof _wireTutorialButtons === 'function') _wireTutorialButtons();
        if (typeof startTutorial === 'function') startTutorial();
      }, 600);
    }
  } else {
    openClassSelect();
  }
}`, 'Q4 finish handoff');

rep(`const GAME_VERSION = 'v0.26.956';`, `const GAME_VERSION = 'v0.26.957';`, 'Q5 version');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v957_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v957_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpq2', s, 'utf8');
await rename(FILE + '.tmpq2', FILE);
console.log('Q DONE');
