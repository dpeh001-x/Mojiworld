// v0.26.945 C1: _lxPreloadMapAssets (per-map sprite preloader) + loadMap hook.
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

const PRELOADER = `// v0.26.945 — Per-map sprite preloader. Fills the SAME memoized registries
// the renderer reads (_monsterFramesFor / _npcIdleFrame), then resolves when
// every frame has loaded + decoded (8s per image, 12s total cap), so callers
// can gate on "this map's sprites are genuinely render-ready". Reused by the
// boot gate (start map) and fire-and-forget on every later map enter.
function _lxPreloadMapAssets(id, onProgress) {
  const jobs = [];
  const track = (img) => {
    if (!img || !img.src) return;
    jobs.push(new Promise((res) => {
      const t = setTimeout(res, 8000);
      const fin = () => { clearTimeout(t); (img.decode ? img.decode() : Promise.resolve()).then(res, res); };
      if (img.complete && img.naturalWidth) fin();
      else {
        img.addEventListener('load', fin, { once: true });
        img.addEventListener('error', () => { clearTimeout(t); res(); }, { once: true });
      }
    }));
  };
  try {
    const md = (typeof _variedMapData === 'function') ? _variedMapData(id) : null;
    if (md) {
      const seenT = new Set();
      for (const sp of (md.spawns || [])) {
        if (!sp || !sp.type || seenT.has(sp.type)) continue;
        seenT.add(sp.type);
        try {
          if (typeof MONSTER_SPRITES !== 'undefined' && MONSTER_SPRITES[sp.type]) track(MONSTER_SPRITES[sp.type]);
          const set = (typeof _monsterFramesFor === 'function') ? _monsterFramesFor(sp.type) : null;
          if (set) for (const mode in set) (set[mode] || []).forEach(track);
        } catch (e) {}
      }
      for (const n of (md.npcs || [])) {
        try {
          if (!n || !n.name) continue;
          if (typeof _npcIdleFrame === 'function') _npcIdleFrame(n.name);   // memoized registry fill
          const file = (typeof NPC_SPRITE_FILES !== 'undefined') ? NPC_SPRITE_FILES[n.name] : null;
          if (file) {
            const base = file.replace(/\\.(png|webp|jpg|jpeg)$/i, '');
            ((typeof NPC_IDLE_FRAMES !== 'undefined' && NPC_IDLE_FRAMES[base]) || []).forEach(track);
          }
          if (typeof _NPC_SPRITES !== 'undefined' && _NPC_SPRITES[n.name]) track(_NPC_SPRITES[n.name]);
        } catch (e) {}
      }
      try { if (md.bg && typeof BG_IMAGES !== 'undefined' && BG_IMAGES[md.bg]) track(BG_IMAGES[md.bg]); } catch (e) {}
    }
    // Active-deck skill icons (~250KB total) — boot-critical for the mobile HUD.
    try {
      document.querySelectorAll('[data-sk-ico]').forEach((el) => {
        const ico = el.getAttribute('data-sk-ico');
        if (!ico) return;
        const img = new Image(); img.decoding = 'async'; img.onerror = () => {};
        img.src = 'Sprites/skills/' + ico + '.png';
        track(img);
      });
    } catch (e) {}
  } catch (e) {}
  const total = jobs.length;
  let done = 0;
  const tick = () => { done++; if (onProgress) { try { onProgress(done, total); } catch (e) {} } };
  jobs.forEach((p) => p.then(tick, tick));
  const all = Promise.allSettled ? Promise.allSettled(jobs) : Promise.all(jobs.map((p) => p.catch(() => {})));
  return Promise.race([all, new Promise((res) => setTimeout(res, 12000))]).then(() => total);
}
function loadMap(id, entryX, entryY) {
  // v0.26.945 — warm this map's frames as the transition starts (no await;
  // the gate covers the boot map, this covers every later map enter).
  try {
    window._lxMapPreloaded = window._lxMapPreloaded || {};
    if (!window._lxMapPreloaded[id]) { window._lxMapPreloaded[id] = 1; _lxPreloadMapAssets(id); }
  } catch (e) {}`;

rep(`function loadMap(id, entryX, entryY) {`, PRELOADER, 'C1 preloader + loadMap hook');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpc1', s, 'utf8');
await rename(FILE + '.tmpc1', FILE);
console.log('C1 DONE');
