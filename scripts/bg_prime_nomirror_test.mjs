// THE VEIL'S PRE-BAKE IS THE SIZE THE BACKDROP DRAWS AT, on every map drawn as ONE copy (bgNoMirror). _lxPrimeBackdrop (the
// boot ready-gate and every map entry's veil gate) bakes the plate under the veil so the first visible frame blits it 1:1. It
// sized that bake W x H (or the tower's 1.45x), but drawBackground sizes a bgNoMirror plate by its own aspect and the parallax
// travel - and _lxBgScaled keeps ONE bake per image - so the pre-bake was thrown away and the plate re-baked on a frame the
// player could see (Everdawn Central, The Weight-Bearer's Stair), or baked a size nothing ever drew (the Glasswind plates,
// small enough to blit raw at their drawn size).
// Per map, in a fresh browser context (cold image cache): enter it with loadMap - the real veil path - with _lxBgScaled hooked,
// and log every BAKE (the image's cached canvas changed) with its size and whether the veil was still up. Held: [1] no bake lands
// after the veil lifts - also with the plate's download held back until the veil starts waiting for it, so the veil's own
// last-moment prime (_lxVeilBackdrop) is what bakes it just before the veil lifts; [2] nothing baked under the veil is a size the draw never asks for (no wasted or
// evicting bake); [3] the prime asks the drawn size (read off _lxPrimeBackdrop's own call). A map with a clip (town's
// everdawn.mp4, the Stair's weightbearerStair.mp4) paints it over its plate once it has a frame, so those maps are held with
// reduced motion, the path where the plate is what shows; with the clip the log is printed for the record (the prime then asks
// the clip's box, the plate being its fade-in underlay). Against the
// build before the fix, the late entries of the plates that bake fail [1], and [3] fails on every map.
//   node scripts/bg_prime_nomirror_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11883);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${c ? '' : JSON.stringify(x).slice(0, 300)}`); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
let browser = null;
const WATCHDOG = setTimeout(async () => { ok('the run finishes inside 12 minutes', false, {}); try { await browser.close(); } catch (e) {} server.kill(); process.exit(1); }, 12 * 60 * 1000);
// one cold entry: boot, hook, loadMap(id), watch until the veil is down and 45 more game frames have drawn
async function enter(id, reduced, late) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  // LATE: the plate's download is held - however early the boot asked for it - until the veil starts waiting for it, so the
  // veil's last word (_lxVeilBackdrop) is what primes it, just before the veil lifts: the path where a wrong-size prime leaves the
  // re-bake to a frame the player sees
  let releaseLate = () => {}; const lateGate = new Promise((r) => { releaseLate = r; });
  if (late) await ctx.route('**/' + late, async (route) => { await lateGate; await route.continue().catch(() => {}); });
  try {
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/${PAGE_URL}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof MAPS === 'object' && typeof loadMap === 'function' && typeof _lxBgScaled === 'function' && typeof _lxPrimeBackdrop === 'function', null, { timeout: 180000 });
    await page.waitForTimeout(4000);
    // the plate is let through once the veil starts waiting for it (_lxVeilBackdrop called), or after 8 s, whatever happens
    if (late) { await page.exposeFunction('__lxReleasePlate', () => { setTimeout(releaseLate, 150); }); setTimeout(releaseLate, 8000); }
    const r = await page.evaluate(async (id) => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const clear = () => { try { closeAllModals(); } catch (e) {} for (const o of ['story-beat-overlay', 'boss-intro-overlay']) { const el = document.getElementById(o); if (el) el.classList.remove('on'); }
        for (const o of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const el = document.getElementById(o); if (el) el.style.display = 'none'; }
        window._prologueActive = false; window._lxBootGateDone = true; game.paused = false; player._god = true; player.invulnerable = 999999; };
      if (!player.cls) player.cls = 'warrior'; player.level = 100; player._gravitosCineSeen = true;
      try { for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true; } catch (e) {}
      clear();
      const md0 = MAPS[id], img = BG_IMAGES[md0.bg];
      const veil = () => !!(game._mapFadeEl && game._mapFadeEl.classList.contains('on'));
      const log = [], orig = window._lxBgScaled, primeBy = []; let primeAsk = null, inPrime = false;
      window._lxBgScaled = function (im, w, h) { const before = im && im._lxBgS, out = orig.apply(this, arguments);
        if (im === img) log.push({ w: Math.round(w), h: Math.round(h), baked: !!(im._lxBgS && im._lxBgS !== before), veil: veil(), prime: inPrime, f: game.time | 0 }); return out; };
      const origPrime = window._lxPrimeBackdrop;
      window._lxPrimeBackdrop = function (pid) { inPrime = true; try { const v = origPrime.apply(this, arguments);
        if (pid === id) { const L = log.filter((e) => e.prime); if (L.length) primeAsk = [L[L.length - 1].w, L[L.length - 1].h];
          primeBy.push(/_lxVeilBackdrop|\btick\b/.test(String(new Error().stack || '')) ? 'veil' : 'gate');
        }
        return v; } finally { inPrime = false; } };
      const origVeil = window._lxVeilBackdrop;   // LATE: the veil has started waiting - let the plate through now
      window._lxVeilBackdrop = function () { if (typeof window.__lxReleasePlate === 'function') window.__lxReleasePlate(); return origVeil.apply(this, arguments); };
      loadMap(id);
      let lifted = null, cv = null;
      for (const t0 = performance.now(); performance.now() - t0 < 15000; await sleep(16)) {
        clear();
        if (lifted === null && game.currentMap === id && !veil() && (game.time | 0) > 0) { lifted = game.time | 0;
          cv = { alphaFor: (typeof _lxMapVideoAlphaFor !== 'undefined') ? _lxMapVideoAlphaFor : null, alpha: (typeof _lxMapVideoAlpha !== 'undefined') ? +(+_lxMapVideoAlpha).toFixed(2) : null }; }
        if (lifted !== null && (game.time | 0) - lifted > 45) break;
      }
      window._lxBgScaled = orig; window._lxPrimeBackdrop = origPrime; window._lxVeilBackdrop = origVeil;
      const drawn = log.filter((e) => !e.prime && !e.veil);
      return { id, plate: img ? [img.naturalWidth, img.naturalHeight] : null, lifted, clip: cv, primeAsk, primeBy, drawAsk: drawn.length ? [drawn[drawn.length - 1].w, drawn[drawn.length - 1].h] : null,
        bakes: log.filter((e) => e.baked).map((e) => `${e.w}x${e.h}${e.prime ? ' prime' : ''}${e.veil ? ' veil' : ' AFTER'} f${e.f}`), calls: log.length };
    }, id);
    r.errors = errs.slice(0, 2); return r;
  } finally { releaseLate(); await ctx.close().catch(() => {}); }
}
try {
  await new Promise((r) => setTimeout(r, 1500));
  browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
  // the one-copy maps, read off the game itself
  const probe = await browser.newContext({ serviceWorkers: 'block' }); const pg = await probe.newPage();
  await pg.goto(`http://localhost:${PORT}/${PAGE_URL}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await pg.waitForFunction(() => typeof MAPS === 'object', null, { timeout: 180000 });
  const plates = await pg.evaluate(() => Object.fromEntries(Object.keys(MAPS).filter((k) => MAPS[k] && MAPS[k].bgNoMirror && MAPS[k].bg && BG_IMAGES[MAPS[k].bg])
    .map((k) => { const im = BG_IMAGES[MAPS[k].bg]; return [k, String(im._lxPath || im.getAttribute('src') || im.src || '').split('/').pop()]; })));
  const ids = Object.keys(plates);
  const clips = await pg.evaluate(() => Object.keys((typeof _LX_MAP_VIDEO !== 'undefined' && _LX_MAP_VIDEO) || {}));   // maps whose backdrop is a clip
  await probe.close();
  ok('[0] the game has one-copy (bgNoMirror) maps to check', ids.length >= 3, plates);
  const runs = [];
  for (const id of ids) runs.push(await enter(id, clips.includes(id)));
  // the same entries with the plate arriving late, so _lxVeilBackdrop primes it right before the veil lifts
  for (const id of ids) { const r = await enter(id, clips.includes(id), plates[id]); r.id = id + ' (plate late)'; runs.push(r); }
  for (const id of ids.filter((k) => clips.includes(k))) { const w = await enter(id, false); w.id = id + ' (with its clip)'; runs.push(w); }
  for (const r of runs) {
    console.log(`      ${r.id}: plate ${r.plate} | prime asked ${r.primeAsk} by ${r.primeBy} | draw asks ${r.drawAsk} | bakes [${r.bakes.join(', ')}] | veil down at f${r.lifted}${r.clip && r.clip.alphaFor ? ` (clip ${r.clip.alphaFor} at alpha ${r.clip.alpha})` : ''}`);
    if (r.id.endsWith('(with its clip)')) continue;   // recorded, not held: the clip, not the plate, is what shows once it has a frame
    if (r.id.endsWith('(plate late)')) ok(`[1] ${r.id}: primed by the veil, and still no bake lands after it lifts`, r.primeBy.includes('veil') && r.lifted !== null && !r.bakes.some((b) => b.includes('AFTER')), r);
    if (r.id.endsWith('(plate late)')) continue;
    ok(`[1] ${r.id}: no bake lands after the veil lifts`, r.lifted !== null && !r.bakes.some((b) => b.includes('AFTER')), r);
    ok(`[2] ${r.id}: nothing is baked that the draw never asks for`, !!r.drawAsk && r.bakes.every((b) => b.startsWith(r.drawAsk[0] + 'x' + r.drawAsk[1])), { bakes: r.bakes, drawAsk: r.drawAsk });
    ok(`[3] ${r.id}: the pre-bake asks the drawn size (${r.drawAsk})`, !!r.primeAsk && !!r.drawAsk && r.primeAsk[0] === r.drawAsk[0] && r.primeAsk[1] === r.drawAsk[1], { primeAsk: r.primeAsk, drawAsk: r.drawAsk });
  }
  ok('[4] no page errors', runs.every((r) => !r.errors.length), runs.map((r) => r.errors).flat().slice(0, 3));
} catch (e) { ok('the harness runs to the end', false, String((e && e.message) || e).slice(0, 200)); }
finally { clearTimeout(WATCHDOG); if (browser) await browser.close().catch(() => {}); server.kill(); }
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
