// THE HERO'S SKILL ART IS WARM WHEN A BOSS FIGHT STARTS (bosslag5, _lxWarmKitFx). Measured in a real session (the kit set in town,
// every prewarm queue drained, then the Gravitos arena, CPU x4): the first cast of each skill froze the frame 30-405 ms - War
// Cry's mark, Power Strike, Rampage, Bloodlust, the dust ring, Ground Slam, Rush, the hit sparks, the shockwave's projectile
// copies - because single images were never warmed, and a set baked in town was evicted by the boss art and then stayed marked
// shrunk, so it was never baked again.
//   [1] after the town warm-up and the arena's veil, every animated set and projectile loop this kit can cast is baked (no raw
//       frame left) and every single image is pinned
//   [2] copies made in town were re-stamped as the arena's (the budget then protects them like the boss's own art)
//   [3] a kit frame the budget evicted (raw again, its set still marked shrunk) is baked again by the next warm (eviction itself
//       is unchanged: reopening every evicted set there made a 45-mob horde re-bake what the full budget evicts next)
//   [4] a map without a boss is left alone (nothing queued)
//   [5] no page errors
//   node scripts/kit_fx_warm_test.mjs        PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11941);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  // the kit in town, every prewarm queue drained (a hero who has had the class all session)
  const town = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }   // the title loop tears down, as on Continue
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.cls = 'warrior'; player.job = 'berserker'; player.master = null; player.level = 60; player._god = true;
    loadMap('town'); game.paused = false;
    const t0 = performance.now(); let calm = 0;
    while (performance.now() - t0 < 120000 && calm < 6) { await sleep(500); calm = (_LX_PREWARM_Q.length + _LX_PREWARM_FXQ.length) === 0 ? calm + 1 : 0; }
    return { warmS: Math.round((performance.now() - t0) / 1000), noBossWarm: _lxWarmKitFx('town') };
  });
  // the arena, through its own veil and ready gate; then the leftover queue drains in play
  await page.evaluate(() => { loadMap('gravitosArena'); game.paused = false; });
  await page.waitForFunction(() => !!window._lxKitWarmRec, null, { timeout: 120000 });
  await page.waitForFunction(() => _LX_PREWARM_FXQ.length === 0, null, { timeout: 60000 }).catch(() => {});
  const st = await page.evaluate(() => {
    const sets = {}, singles = {}; let raw = 0, unpinned = 0, notArena = 0, copies = 0;
    for (const t of _lxFxClassTags()) {
      const kind = t.slice(0, 2), k = t.slice(3);
      if (kind === 'fa' || kind === 'pa') {
        const arr = kind === 'fa' ? FX_ANIM_FRAMES[k] : PROJ_ANIM_FRAMES[k]; if (!arr) continue;
        let r = 0; for (const f of arr) { if (f && f.tagName === 'CANVAS') { copies++; if (f._lxLruT !== undefined && f._lxMapT !== 'gravitosArena') notArena++; } else if (f && !f._lxNoShrink) r++; }
        sets[t] = r; raw += r;
      } else if (kind === 'fx' || kind === 'pp' || kind === 'bp') {
        const im = _lxFxImg(t); if (!im || im.tagName !== 'IMG' || !(im.naturalWidth > 0)) continue;
        const pin = _lxPinCache.get(im); singles[t] = !!pin; if (!pin) unpinned++; else { copies++; if (pin._lxLruT !== undefined && pin._lxMapT !== 'gravitosArena') notArena++; }
      }
    }
    return { rec: window._lxKitWarmRec, raw, unpinned, notArena, copies, sets, singles };
  });
  ok('[1] after the arena veil every set and projectile loop of the kit is baked and every single image pinned', st.raw === 0 && st.unpinned === 0 && Object.keys(st.sets).length >= 6 && Object.keys(st.singles).length >= 6,
    { rec: st.rec, raw: st.raw, unpinned: st.unpinned, sets: st.sets, singles: st.singles });
  ok('[2] copies made in town now count as the arena\'s (protected like the boss art)', st.copies > 20 && st.notArena === 0, { copies: st.copies, notArena: st.notArena });
  const ev = await page.evaluate(async () => {
    const arr = FX_ANIM_FRAMES.warcry; if (!arr) return { err: 'no warcry set' };
    const i = arr.findIndex((f) => f && f.tagName === 'CANVAS' && _lxCvLru.has(f)); if (i < 0) return { err: 'no tracked warcry copy' };
    const cv = arr[i], e = _lxCvLru.get(cv); if (!e || !e.evict) return { err: 'no evict hook' };
    const shrunkBefore = !!arr._lxShrunk;
    _lxCvLru.delete(cv); _lxCvLruPx -= e.px; cv._lxLruT = undefined; e.evict(cv);   // exactly what _lxCvTrim does
    const back = arr[i] && arr[i].tagName === 'IMG', reopened = !arr._lxShrunk;
    // before the fix the set stayed "shrunk" with a raw frame in it, and nothing ever baked it again
    const queued = _lxWarmKitFx('gravitosArena');
    const t0 = performance.now(); while (performance.now() - t0 < 15000 && !(arr[i] && arr[i].tagName === 'CANVAS')) await new Promise((r) => setTimeout(r, 100));
    return { shrunkBefore, back, reopened, queued, rebaked: !!(arr[i] && arr[i].tagName === 'CANVAS'), shrunkAfter: !!arr._lxShrunk };
  });
  ok('[3] a kit frame the budget evicted (its slot raw again, its set still marked shrunk) is baked again by the next warm', !ev.err && ev.shrunkBefore && ev.back && ev.rebaked, ev);
  ok('[4] a map without a boss is left alone', town.noBossWarm === 0, town);
  ok('[5] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close(); }
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
