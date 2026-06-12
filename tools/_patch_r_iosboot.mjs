// v0.26.962 R: iOS boot-kill fix — bounded decode concurrency. Safari was
// reloading the page mid-boot (video evidence: 75% -> restart -> 0%) under
// the memory spike of hundreds of concurrent image decodes; pooling caps it.
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

// R1 — pool helper, defined next to the pill (main script scope).
rep(`function _lxSpritePillTick() {`,
`// v0.26.962 — bounded-concurrency runner. iOS Safari KILLS the page (the
// reported "back to the start screen, then black") when hundreds of image
// decodes fire at once during boot — each decoded bitmap is megabytes of
// transient RAM. Pooling keeps a handful in flight at a time.
function _lxAsyncPool(limit, items, worker) {
  let i = 0;
  const next = () => {
    if (i >= items.length) return Promise.resolve();
    const item = items[i++];
    return Promise.resolve().then(() => worker(item)).catch(() => {}).then(next);
  };
  const lanes = [];
  for (let k = 0; k < Math.min(limit, items.length); k++) lanes.push(next());
  return Promise.all(lanes);
}
function _lxSpritePillTick() {`, 'R1 pool helper');

// R2 — warm decode: pooled x6 instead of all-at-once.
rep(`    const jobs = [];
    imgs.forEach((img) => {
      try {
        if (!img.src) return;
        if (img.complete && img.naturalWidth) {
          if (img.decode) jobs.push(img.decode().catch(() => {}));
        } else {
          // v0.26.946 — image still downloading: await load (8s cap) THEN
          // decode, instead of silently skipping it into a gameplay stutter.
          jobs.push(new Promise((res) => {
            const t = setTimeout(res, 8000);
            const fin = () => { clearTimeout(t); (img.decode ? img.decode() : Promise.resolve()).then(res, res); };
            img.addEventListener('load', fin, { once: true });
            img.addEventListener('error', () => { clearTimeout(t); res(); }, { once: true });
          }));
        }
      } catch (e) {}
    });
    try { console.log('[boot] decoding', jobs.length, 'registry sprites as part of the loading phase'); } catch (e) {}
    return Promise.allSettled ? Promise.allSettled(jobs).then(() => jobs.length)
                              : Promise.all(jobs).then(() => jobs.length, () => jobs.length);`,
`    // v0.26.962 — POOLED (x6): firing every decode at once spiked memory
    // by hundreds of MB and got the page killed on iPhones.
    const _decodeOne = (img) => new Promise((res) => {
      try {
        if (!img.src) return res();
        const fin = () => { (img.decode ? img.decode() : Promise.resolve()).then(res, res); };
        if (img.complete && img.naturalWidth) return fin();
        const t = setTimeout(res, 8000);
        img.addEventListener('load', () => { clearTimeout(t); fin(); }, { once: true });
        img.addEventListener('error', () => { clearTimeout(t); res(); }, { once: true });
      } catch (e) { res(); }
    });
    try { console.log('[boot] decoding', imgs.length, 'registry sprites (pooled x6)'); } catch (e) {}
    return _lxAsyncPool(6, imgs, _decodeOne).then(() => imgs.length);`, 'R2 warm decode pooled');

// R3 — map preloader: collect images, pool x6.
rep(`  const jobs = [];
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
  };`,
`  // v0.26.962 — collect now, load/decode through a x6 pool below (the
  // all-at-once version contributed to the iOS boot kill).
  const _imgs = [];
  const track = (img) => { if (img && img.src) _imgs.push(img); };`, 'R3a preloader collect');
rep(`  const total = jobs.length;
  let done = 0;
  window._lxSpriteTotal = (window._lxSpriteTotal || 0) + total;   // v0.26.948 — feeds the progress pill
  const tick = () => {
    done++;
    window._lxSpriteDone = (window._lxSpriteDone || 0) + 1;
    try { _lxSpritePillTick(); } catch (e) {}
    if (onProgress) { try { onProgress(done, total); } catch (e) {} }
  };
  jobs.forEach((p) => p.then(tick, tick));
  const all = Promise.allSettled ? Promise.allSettled(jobs) : Promise.all(jobs.map((p) => p.catch(() => {})));
  return Promise.race([all, new Promise((res) => setTimeout(res, 25000))]).then(() => total);`,
`  const total = _imgs.length;
  let done = 0;
  window._lxSpriteTotal = (window._lxSpriteTotal || 0) + total;   // v0.26.948 — feeds the progress pill
  const tick = () => {
    done++;
    window._lxSpriteDone = (window._lxSpriteDone || 0) + 1;
    try { _lxSpritePillTick(); } catch (e) {}
    if (onProgress) { try { onProgress(done, total); } catch (e) {} }
  };
  const _loadOne = (img) => new Promise((res) => {
    const t = setTimeout(res, 8000);
    const fin = () => { clearTimeout(t); (img.decode ? img.decode() : Promise.resolve()).then(res, res); };
    if (img.complete && img.naturalWidth) fin();
    else {
      img.addEventListener('load', fin, { once: true });
      img.addEventListener('error', () => { clearTimeout(t); res(); }, { once: true });
    }
  }).then(tick, tick);
  const all = _lxAsyncPool(6, _imgs, _loadOne);
  return Promise.race([all, new Promise((res) => setTimeout(res, 25000))]).then(() => total);`, 'R3b preloader pooled');

// R4 — manifest buckets: x8 pool instead of 266 concurrent fetch+decodes.
rep(`  Promise.all(BAZAAR.map(p => loadOne(p, true).then(() => { bzLoaded++; update(); })))
    .then(() => maybeReveal());`,
`  _lxAsyncPool(8, BAZAAR, p => loadOne(p, true).then(() => { bzLoaded++; update(); }))
    .then(() => maybeReveal());   // v0.26.962 — pooled x8 (iOS boot kill)`, 'R4a BAZAAR');
rep(`  Promise.all(CRITICAL.map(p => loadOne(p, true).then(() => { critLoaded++; update(); })))
    .then(() => maybeReveal());`,
`  _lxAsyncPool(8, CRITICAL, p => loadOne(p, true).then(() => { critLoaded++; update(); }))
    .then(() => maybeReveal());   // v0.26.962 — pooled x8`, 'R4b CRITICAL');
rep(`  const startDeferred = () => {
    DEFERRED.forEach(p => loadOne(p, false).then(() => {
      defLoaded++;
      update();
      maybeReveal();`,
`  const startDeferred = () => {
    _lxAsyncPool(6, DEFERRED, p => loadOne(p, false).then(() => {   // v0.26.962 — pooled x6
      defLoaded++;
      update();
      maybeReveal();`, 'R4c DEFERRED');

rep(`const GAME_VERSION = 'v0.26.961';`, `const GAME_VERSION = 'v0.26.962';`, 'R5 version');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v962_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v962_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpr3', s, 'utf8');
await rename(FILE + '.tmpr3', FILE);
console.log('R DONE');
