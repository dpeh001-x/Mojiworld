// v0.26.945 C2: auth gate joins start-map preload; warm-decode awaits
// in-flight images; boss/zodiac decode deferred out of the gate.
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

// C2a — gate: warm decode AND start-map preload, 12s cap, live progress.
rep(`      if (status) status.innerHTML = '<span class="pct">100%</span> · <span class="pulse">Decoding world…</span>';
      setTimeout(_proceed, 10000);
      _warmDecodeRegistries().then(_proceed, _proceed);`,
`      if (status) status.innerHTML = '<span class="pct">100%</span> · <span class="pulse">Decoding world…</span>';
      setTimeout(_proceed, 12000);
      // v0.26.945 — the gate now ALSO preloads the start map's monster/NPC
      // frames + deck skill icons, so nothing pops in at reveal. The saved
      // map is read straight from the save blob; 'town' is the fresh default.
      const _startId = (() => {
        try {
          const raw = localStorage.getItem(SAVE_KEY);
          const sv = raw ? JSON.parse(raw) : null;
          return (sv && sv.currentMap && typeof MAPS !== 'undefined' && MAPS[sv.currentMap]) ? sv.currentMap : 'town';
        } catch (e) { return 'town'; }
      })();
      try { (window._lxMapPreloaded = window._lxMapPreloaded || {})[_startId] = 1; } catch (e) {}
      const _mapPre = (typeof _lxPreloadMapAssets === 'function')
        ? _lxPreloadMapAssets(_startId, (d, t) => {
            if (status) status.innerHTML = '<span class="pct">100%</span> · <span class="pulse">Decoding world… ' + d + '/' + t + '</span>';
          })
        : Promise.resolve(0);
      Promise.allSettled([_warmDecodeRegistries(), _mapPre]).then(_proceed, _proceed);`, 'C2a gate join');

// C2b — warm decode: await images still in flight (8s cap each).
rep(`        if (img.complete && img.naturalWidth && img.decode) jobs.push(img.decode().catch(() => {}));`,
`        if (!img.src) return;
        if (img.complete && img.naturalWidth) {
          if (img.decode) jobs.push(img.decode().catch(() => {}));
        } else {
          // v0.26.945 — image still downloading: await load (8s cap) THEN
          // decode, instead of silently skipping it into a gameplay stutter.
          jobs.push(new Promise((res) => {
            const t = setTimeout(res, 8000);
            const fin = () => { clearTimeout(t); (img.decode ? img.decode() : Promise.resolve()).then(res, res); };
            img.addEventListener('load', fin, { once: true });
            img.addEventListener('error', () => { clearTimeout(t); res(); }, { once: true });
          }));
        }`, 'C2b in-flight await');

// C2c — heavy registries leave the gate (decoded post-auth instead).
rep(`  function _warmDecodeRegistries() {`,
`  function _warmDecodeRegistries(includeHeavy) {`, 'C2c-sig');
rep(`    try { _regs.push(typeof BOSS_ATTACK_FRAMES !== 'undefined' ? BOSS_ATTACK_FRAMES : null); } catch (e) {}
    try { _regs.push(typeof BOSS_IDLE_FRAMES   !== 'undefined' ? BOSS_IDLE_FRAMES   : null); } catch (e) {}
    try { _regs.push(typeof BOSS_WALK_FRAMES   !== 'undefined' ? BOSS_WALK_FRAMES   : null); } catch (e) {}
    try { _regs.push(typeof ZODIAC_SPRITES     !== 'undefined' ? ZODIAC_SPRITES     : null); } catch (e) {}`,
`    // v0.26.945 — boss anim frames + zodiac sprites (hundreds of big webps)
    // no longer hold the auth form hostage; a second includeHeavy pass runs
    // fire-and-forget once the form is up (see _showAuthGate).
    if (includeHeavy) {
      try { _regs.push(typeof BOSS_ATTACK_FRAMES !== 'undefined' ? BOSS_ATTACK_FRAMES : null); } catch (e) {}
      try { _regs.push(typeof BOSS_IDLE_FRAMES   !== 'undefined' ? BOSS_IDLE_FRAMES   : null); } catch (e) {}
      try { _regs.push(typeof BOSS_WALK_FRAMES   !== 'undefined' ? BOSS_WALK_FRAMES   : null); } catch (e) {}
      try { _regs.push(typeof ZODIAC_SPRITES     !== 'undefined' ? ZODIAC_SPRITES     : null); } catch (e) {}
    }`, 'C2c heavy split');

// C2d — fire-and-forget heavy decode once the auth form is interactive.
rep(`    const stack = overlay.querySelector('.lo-stack');
    const auth  = document.getElementById('lo-auth');
    if (!stack || !auth) { _finishHide(); return; }`,
`    const stack = overlay.querySelector('.lo-stack');
    const auth  = document.getElementById('lo-auth');
    if (!stack || !auth) { _finishHide(); return; }
    // v0.26.945 — decode boss/zodiac sets while the player reads the form.
    try { setTimeout(() => { try { _warmDecodeRegistries(true); } catch (e) {} }, 1200); } catch (e) {}`, 'C2d post-auth heavy');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpc2', s, 'utf8');
await rename(FILE + '.tmpc2', FILE);
console.log('C2 DONE');
