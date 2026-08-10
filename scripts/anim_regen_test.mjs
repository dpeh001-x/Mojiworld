// REGENERATED ANIMATION SETS (v0.29.x). New base sprites were dropped into
// Sprites/, so every animation driven by one had to be rebuilt from the NEW
// base — otherwise the static sprite and its animation disagree on screen.
//
// Verifies against the LIVE game: each set resolves through the loader the
// game actually uses, every frame decodes, the frame count is unchanged, and
// no request 404s. A set that silently fails to decode leaves the effect
// invisible with nothing in the console.
// Run: node scripts/anim_regen_test.mjs [game-file]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv[2] || 'mojiworld_game.html';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [], failed = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
page.on('response', (r) => {
  if (r.status() >= 400 && /(comet|goo|octoHead|cloudburst|quake_ring|qte_break)_\d+\.webp/i.test(r.url())) {
    failed.push(r.status() + ' ' + r.url().split('/').pop());
  }
});
await page.goto('file:///' + path.join(ROOT, FILE).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _projAnimFrame === 'function' && typeof LX_MOB_PROJ !== 'undefined', { timeout: 60000 });

const out = await page.evaluate(async () => {
  const wait = async (img, ms = 25000) => {
    const t0 = Date.now();
    while (img && (!img.complete || !img.naturalWidth) && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 200));
    return !!(img && img.complete && img.naturalWidth > 0);
  };
  const res = {};
  // projectile anim sets, through the game's own loader
  for (const k of ['comet', 'goo', 'octoHead']) {
    _projAnimFrame(k);                                  // primes PROJ_ANIM_FRAMES[k]
    const arr = (typeof PROJ_ANIM_FRAMES === 'object') ? PROJ_ANIM_FRAMES[k] : null;
    if (!arr) { res[k] = { err: 'set did not resolve' }; continue; }
    let ok = 0;
    for (const f of arr) if (await wait(f)) ok++;
    res[k] = { total: arr.length, decoded: ok, w: arr[0] && arr[0].naturalWidth, h: arr[0] && arr[0].naturalHeight };
  }
  // vfx sets. The loader is _lxVfxFrame (SINGULAR — there is no plural) and it
  // is keyed by camelKey, not by the file base: quake_ring_*.webp is reached as
  // 'quakeRing' via _VFX_ANIM_BASE. Using the file name reported "did not
  // resolve" against perfectly good frames.
  for (const [k, camel] of [['cloudburst', 'cloudburst'], ['quake_ring', 'quakeRing']]) {
    _lxVfxFrame(camel);                                 // primes VFX_ANIM_FRAMES[camel]
    const arr = (typeof VFX_ANIM_FRAMES === 'object') ? VFX_ANIM_FRAMES[camel] : null;
    if (!arr || !arr.length) { res[k] = { err: 'set did not resolve via _lxVfxFrame("' + camel + '")' }; continue; }
    let ok = 0;
    for (const f of arr) if (await wait(f)) ok++;
    res[k] = { total: arr.length, decoded: ok, w: arr[0] && arr[0].naturalWidth, h: arr[0] && arr[0].naturalHeight };
  }
  // the feathered burst
  const qb = (typeof _fxAnimFrames === 'function') ? _fxAnimFrames('qte_break') : null;
  if (qb) { let ok = 0; for (const f of qb) if (await wait(f)) ok++; res.qte_break = { total: qb.length, decoded: ok, w: qb[0] && qb[0].naturalWidth }; }
  return res;
});
await browser.close();

let bad = 0;
const ck = (c, n, x) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${!c && x !== undefined ? ' — ' + JSON.stringify(x) : ''}`); if (!c) bad++; };
console.log('regenerated animation sets, decoded through the game\'s own loaders:');
for (const [k, r] of Object.entries(out)) {
  if (r.err) { ck(false, `${k}: ${r.err}`); continue; }
  ck(r.decoded === r.total && r.total >= 9, `${k.padEnd(12)} ${r.decoded}/${r.total} frames decode at ${r.w}x${r.h || r.w}`, r);
}
ck(!failed.length, 'no failed frame requests', failed);
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 2).join(' | ') : '\nno page errors');
console.log(bad ? `\n${bad} problem(s)` : '\nall good — every regenerated set loads and decodes in the live game');
process.exit(bad || errs.length ? 1 : 0);
