// A LIVE BOSS'S CURRENT FORM STAYS IN THE CANVAS BUDGET (v0.30.x boss-set-pin; per user: boss visuals must never lag a fight).
// Gravitos's form-3 frames are ~169M px of canvas at DPR 2+ (60M at DPR 1) against a 160M budget (40M on an iOS-class device),
// so the trim kept releasing them mid-fight and each came back as a re-bake with his pose held. The real _lxCvTrim is driven
// with synthetic tracked copies (canvases with no context, so no memory) whose sources are Gravitos's REAL frame <img>s:
//   [1] form 3 alive, 1.8x the budget, everything idle 20 s: none of his form-3 copies released, the other copies are - down to
//       (pinned + half the budget) = 1.53x, the line riding above his form (was 1.2x: his frames were the first to go)
//   [2] form 3 alive, 1.6x, nothing idle 15 s: his form-2 copies idle 6 s go first (forms only go forward); form 3 and the rest stay
//   [3] form 3 alone at 2.4x the budget: released only down to 0.9x the pin cap (1.8x), least recently drawn first
//   [4] town, no boss, 1.3x idle 20 s: down to 0.8x the budget, as before
//   [5] the game's own form-3 bakes / pins, aged 20 s, with filler past the ceiling: none released, the filler is
//   [8] iPhone page at DPR 2.5: his form 3 (169M px) cannot be kept whole under the cap - the old rule, unchanged
//   [6] iPhone page (40M budget): his form 3 (60M) stays and the other idle copies keep half the budget (2.0x in all); [7] past
//       the 2.5x pin cap: down to 0.9x of it
//   node scripts/boss_set_pin_test.mjs      (MOJI_GAME_FILE=<build.html> PORT=<port> for a private build)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11677';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
// boot one page into the Gravitos arena with him alive in form 3 (the keybinds_test recipe)
async function bootArena(ctxOpts) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', ...ctxOpts }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('lx_render_scale', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxCvTrim === 'function', null, { timeout: 150000 });
  const info = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 100;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, {}); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player._tutorialSeen = true; player._gravitosCineSeen = true; player.invulnerable = 999999;
    loadMap('gravitosArena', 300); await sleep(3000); game.paused = false;
    for (const id of ['boss-intro-overlay', 'story-beat-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    let m = game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
    if (!m) { const G = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, b) => b.w - a.w)[0]; m = spawnMonster(G ? G.x + G.w / 2 : 1000, (G ? G.y : 400) - 200, 'gravitos', true, false); }
    m.currentHp = m.maxHp = 9e9; m.invulnerable = true; m._wardNextAt = 1e12; m._phaseSprite = 'gravitos3'; m._gravitosPhase = 3; m.phase = 3; window.__m = m;
    // a few game frames so the sim is stepping
    const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < 5 && performance.now() - t0 < 20000) await sleep(50);
    return { budget: _LX_CV_BUDGET_PX, frames: (game.time | 0) - g0, alive: m.currentHp > 0 };
  });
  return { ctx, p, info };
}
// the synthetic run: rows [{ g, n, px, src: 'g1'|'g2'|'g3'|null, idle }] go into the LRU oldest first; the real copies are set aside
const RUN = async (p, rows, boss) => p.evaluate(async ({ rows, boss }) => {
  const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
  const m = window.__m; if (boss !== 'none') { m.currentHp = m.maxHp; m._phaseSprite = boss; }
  { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) === g0 && performance.now() - t0 < 5000) await sleep(20); }   // a new game frame (the stamp is per frame)
  const fam = (re) => { const o = []; for (const S of [BOSS_IDLE_FRAMES, BOSS_WALK_FRAMES, BOSS_ATTACK_FRAMES]) for (const k in S) if (re.test(k)) for (const x of S[k]) if (x) o.push(x._lxSrc || x); return o; };
  const SRC = { g1: fam(/^gravitos(?![0-9])/), g2: fam(/^gravitos2/), g3: fam(/^gravitos3/) };
  const B = _LX_CV_BUDGET_PX, saved = [..._lxCvLru.entries()], savedPx = _lxCvLruPx; _lxCvLru.clear(); _lxCvLruPx = 0;
  const now = performance.now(), map = _lxCvMapNow(), all = [];
  for (const r of rows) { const n = r.n === 'all' ? SRC[r.src].length : r.n;
    for (let i = 0; i < n; i++) { const cv = document.createElement('canvas'); cv.width = 1000; cv.height = Math.max(1, Math.round(r.px * B / 1000)); const px = cv.width * cv.height;
      if (r.src) cv._lxSrc = SRC[r.src][i % SRC[r.src].length]; cv._lxMapT = map; cv._lxLruT = now - r.idle - (r.stagger ? (n - i) * 10 : 0);
      _lxCvLru.set(cv, { px, evict: null }); _lxCvLruPx += px; all.push({ cv, g: r.g, i }); } }
  const before = _lxCvLruPx / B; _lxCvTrim();
  const gone = {}, kept = {}, goneIdx = {};
  for (const x of all) { const k = _lxCvLru.has(x.cv) ? kept : gone; k[x.g] = (k[x.g] || 0) + 1; if (k === gone) (goneIdx[x.g] = goneIdx[x.g] || []).push(x.i); }
  const res = { before: +before.toFixed(3), after: +(_lxCvLruPx / B).toFixed(3), gone, kept, n: { g1: SRC.g1.length, g2: SRC.g2.length, g3: SRC.g3.length }, oldestGone: goneIdx.g3 ? Math.max(...goneIdx.g3) : -1 };
  _lxCvLru.clear(); _lxCvLruPx = savedPx; for (const [c, e] of saved) _lxCvLru.set(c, e);
  if (boss !== 'none') { m.currentHp = m.maxHp; m._phaseSprite = 'gravitos3'; }
  return res;
}, { rows, boss });
try {
  // ---- desktop-class budget ----
  const D = await bootArena({});
  check(D.info.budget >= 1e8 && D.info.frames > 0 && D.info.alive, 'desktop page: 160M budget, the arena steps, Gravitos alive in form 3', D.info);
  const r1 = await RUN(D.p, [{ g: 'g3', n: 'all', src: 'g3', px: 165.6 / 160 / 69, idle: 20000 }, { g: 'misc', n: 51, src: null, px: 2.4 / 160, idle: 20000 }], 'gravitos3');
  check(r1.n.g3 >= 60 && !r1.gone.g3 && r1.gone.misc > 0 && r1.after > 1.45 && r1.after <= 1.55, '[1] form 3 alive at 1.8x, all idle 20 s: no form-3 copy released, the other copies are (down to pinned + half the budget, 1.53x)', r1);
  const r2 = await RUN(D.p, [{ g: 'g2', n: 'all', src: 'g2', px: 0.4 / 160, idle: 6000 }, { g: 'g3', n: 'all', src: 'g3', px: 165.6 / 160 / 69, idle: 2000 }, { g: 'misc', n: 60, src: null, px: 1 / 160, idle: 2000 }], 'gravitos3');
  check(r2.before > 1.5 && r2.gone.g2 > 0 && !r2.gone.g3 && !r2.gone.misc, '[2] form 3 alive at 1.6x, nothing idle 15 s: his form-2 copies (idle 6 s) are released first, form 3 and the rest kept', r2);
  const r3 = await RUN(D.p, [{ g: 'g3', n: 'all', src: 'g3', px: 384 / 160 / 69, idle: 20000, stagger: true }], 'gravitos3');
  check(r3.after > 1.7 && r3.after <= 1.8 && r3.gone.g3 > 0 && r3.kept.g3 > 0, '[3] form 3 alone at 2.4x: released only down to 0.9x the pin cap (1.8x the budget)', r3);
  check(r3.oldestGone >= 0 && r3.oldestGone < (r3.gone.g3 || 0) + 1, '[3b] ... least recently drawn first', r3);
  // [5] the game's own copies: his real form-3 bakes / pins, aged 20 s and oldest in the LRU, filler past the 1.5x ceiling
  const r5 = await D.p.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    const S3 = new Set(); const fill = () => { for (const S of [BOSS_IDLE_FRAMES, BOSS_WALK_FRAMES, BOSS_ATTACK_FRAMES]) for (const k in S) if (/^gravitos3/.test(k)) for (const x of S[k]) if (x) S3.add(x._lxSrc || x); };
    const real = () => { fill(); const o = []; for (const [cv] of _lxCvLru) if (cv._lxSrc && S3.has(cv._lxSrc)) o.push(cv); return o; };
    const t0 = performance.now();
    while (real().length < 40 && performance.now() - t0 < 90000) { try { _lxBossArtWant('gravitos', true); _lxBossBakeQueue('gravitos3', null); } catch (e) {} await sleep(500); }
    { const g0 = game.time | 0, t1 = performance.now(); while ((game.time | 0) === g0 && performance.now() - t1 < 5000) await sleep(20); }
    const R = real(), B = _LX_CV_BUDGET_PX, now = performance.now(), ent = [..._lxCvLru.entries()], rs = new Set(R);
    _lxCvLru.clear(); for (const [c, e] of ent) if (rs.has(c)) { c._lxLruT = now - 20000; _lxCvLru.set(c, e); }
    const need = Math.max(0, B * 1.8 - _lxCvLruPx), fill2 = [];
    for (let i = 0; i < Math.ceil(need / 4e6); i++) { const cv = document.createElement('canvas'); cv.width = 4000; cv.height = 1000; cv._lxMapT = _lxCvMapNow(); cv._lxLruT = now - 20000; _lxCvLru.set(cv, { px: 4e6, evict: null }); _lxCvLruPx += 4e6; fill2.push(cv); }
    for (const [c, e] of ent) if (!rs.has(c)) _lxCvLru.set(c, e);
    const before = _lxCvLruPx / B; _lxCvTrim();
    const res = { real: R.length, realGone: R.filter((c) => !_lxCvLru.has(c)).length, fillGone: fill2.filter((c) => !_lxCvLru.has(c)).length, fill: fill2.length, before: +before.toFixed(2), after: +(_lxCvLruPx / B).toFixed(2), waitedMs: Math.round(performance.now() - t0) };
    for (const c of fill2) if (_lxCvLru.has(c)) { _lxCvLruPx -= 4e6; _lxCvLru.delete(c); }
    return res;
  });
  check(r5.real >= 20 && r5.realGone === 0 && r5.fillGone > 0, '[5] his real form-3 bakes / pins, idle 20 s past the ceiling: none released, the filler is', r5);
  // [4] town: no boss
  await D.p.evaluate(async () => { loadMap('town', 300); await new Promise((s) => setTimeout(s, 2500)); });
  const r4 = await RUN(D.p, [{ g: 'misc', n: 52, src: null, px: 4 / 160, idle: 20000 }], 'none');
  check(r4.gone.misc > 0 && r4.after <= 0.8 && r4.after > 0.7, '[4] town, no boss, 1.3x idle 20 s: down to 0.8x the budget, as before', r4);
  await D.ctx.close();
  // ---- iOS-class budget (an iPhone user agent: 40M px) ----
  const P = await bootArena({ userAgent: IPHONE });
  check(P.info.budget < 1e8 && P.info.frames > 0 && P.info.alive, 'iPhone page: 40M budget, the arena steps, Gravitos alive in form 3', P.info);
  const r6 = await RUN(P.p, [{ g: 'g3', n: 'all', src: 'g3', px: 60 / 40 / 69, idle: 20000 }, { g: 'misc', n: 30, src: null, px: 1 / 40, idle: 20000 }], 'gravitos3');
  check(!r6.gone.g3 && r6.gone.misc >= 9 && r6.gone.misc <= 11 && r6.after > 1.95 && r6.after < 2.05, '[6] iPhone: his form 3 (60M px, 1.5x) stays and the other idle copies keep half the budget (2.0x in all)', r6);
  const r7 = await RUN(P.p, [{ g: 'g3', n: 'all', src: 'g3', px: 120 / 40 / 69, idle: 20000, stagger: true }], 'gravitos3');
  check(r7.after > 2.15 && r7.after <= 2.25 && r7.gone.g3 > 0, '[7] iPhone: form 3 alone at 3x is released only down to 0.9x the 2.5x pin cap (100M px)', r7);
  // [8] the same iPhone at DPR 2.5 (Sharp Display on an iPad-class screen): his form 3 no longer fits whole - the trim is the old one
  const w8 = await P.p.evaluate(async () => { const sleep = (ms) => new Promise((s) => setTimeout(s, ms)); _lxApplyRenderScale(2.5);
    const g3 = []; for (const S of [BOSS_IDLE_FRAMES, BOSS_WALK_FRAMES, BOSS_ATTACK_FRAMES]) for (const k in S) if (/^gravitos3/.test(k)) for (const x of S[k]) if (x) g3.push(x._lxSrc || x);
    const t0 = performance.now(); while (!g3.every((x) => x.naturalWidth > 0) && performance.now() - t0 < 60000) { try { _lxBossArtWant('gravitos', true); } catch (e) {} await sleep(250); }
    return { dpr: _LX_DPR, loaded: g3.filter((x) => x.naturalWidth > 0).length, n: g3.length }; });
  const r8 = await RUN(P.p, [{ g: 'g3', n: 'all', src: 'g3', px: 60 / 40 / 69, idle: 20000 }, { g: 'misc', n: 30, src: null, px: 1 / 40, idle: 20000 }], 'gravitos3');
  check(w8.loaded === w8.n && r8.gone.g3 > 0 && r8.after <= 0.8 && r8.after > 0.7, '[8] iPhone at DPR 2.5: his form 3 (169M px) cannot be kept whole under the cap - released down to 0.8x as before', { w8, r8 });
  await P.ctx.close();
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} catch (e) { check(false, 'harness: ' + String(e && e.message).slice(0, 300), null); }
finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
