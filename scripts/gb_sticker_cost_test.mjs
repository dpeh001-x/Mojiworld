#!/usr/bin/env node
// v0.30.1326: what a gold B/G sticker costs. Each atlas row is a full glyph cell per glyph, so the silhouette (stroke + fill)
// and the fill (fill + dilate) are merged into one row each - the same picture, a third fewer draws and fill. The sheets
// drop the star (a sticker is never a crit), a boss spawn prewarms both ladders (the second FX tier draws every sticker
// from the stress sheet, which was never prewarmed: 36% of sticker frames fell back to live text), and the 8 s idle trim
// no longer throws the ladders away while a boss lives. Checks:
//   - ROWS / DRAWS: 4 rows on the stress sheet, 6 on the big normal one, no star cell; '12,345' is 24 / 30 draws (was 36 / 42)
//   - SAME PICTURE: the merged silhouette cell = its stroke and fill cells composited at 0.8 each; the merged fill cell =
//     its fill and dilate cells composited
//   - PREWARM: both ladders are asked for, the tier in use first, and all 18 sheets sit in the cache together
//   - IDLE: 8 s without numbers trims the sheets with no boss, and keeps them while one lives
//   - FIGHT: a kit-bot fight at King Krook draws its stickers from the sheets (misses at most 10% of lookups)
//   node scripts/gb_sticker_cost_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10701);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch(EXE ? { executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] } : { channel: 'chrome', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxGbPrewarm === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    player.cls = 'warrior'; player.job = 'berserker'; player.master = 'warlord'; player.masteries = { warlord: true }; player.level = 200; player._god = true;
    loadMap('forest', 300); await sleep(1500);
    const o = { ver: GAME_VERSION };
    const uiK = (game._uiScale > 0) ? game._uiScale : 1, b0 = ((LX_GB_ROW_SIZE + 4) * uiK) | 0, col = LX_GB_ROW_COL;
    const dpr = () => _lxDnAtlasDpr(Math.max(0.25, Math.min(3, _LX_DPR || 1)));
    const pxK = (k) => _lxDnAtlasPx4(b0, Math.pow(_LX_DN_ATLAS_STEP, k)), px8 = pxK(8);
    // ROWS / DRAWS
    const S8 = _lxGbAtlasBuild(b0, px8, false, col, true, dpr()), N8 = _lxGbAtlasBuild(b0, px8, false, col, false, dpr()), N0 = _lxGbAtlasBuild(b0, pxK(0), false, col, false, dpr());
    const rowsOf = (a) => a.rows.map((R) => R.p + (R.w || '')).join(',');
    o.rows = { s8: rowsOf(S8), n8: rowsOf(N8), n0: rowsOf(N0) };
    o.star = [S8, N8, N0].some((a) => a.cells.has(String.fromCharCode(0x2605))); o.cellsOk = [...'0123456789,'].every((ch) => S8.cells.has(ch));
    const P = CanvasRenderingContext2D.prototype, oD = P.drawImage;
    const draws = (at) => { let n = 0; P.drawImage = function () { if (this === ctx) n++; return oD.apply(this, arguments); };
      try { ctx.save(); ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); ctx.translate(480, 300); _lxGbAtlasBlit(at, '12,345', 2.4, false, (b0 * 2.4) / px8, false); ctx.restore(); } finally { P.drawImage = oD; } return n; };
    o.draws = { s8: draws(S8), n8: draws(N8) };
    // SAME PICTURE: a merged cell vs its two passes drawn apart and composited
    const cellOf = (at, row, ch) => { const c0 = at.cells.get(ch), cv = document.createElement('canvas'); cv.width = c0.sw; cv.height = at.cellH; cv.getContext('2d').drawImage(at.cv, c0.sx, row * at.rowH, c0.sw, at.cellH, 0, 0, c0.sw, at.cellH); return cv; };
    const pass1 = (at, ch, paint) => { const c0 = at.cells.get(ch), cv = document.createElement('canvas'); cv.width = c0.sw; cv.height = at.cellH; const g = cv.getContext('2d');
      g.setTransform(at.dpr, 0, 0, at.dpr, at.pad * at.dpr, at.base * at.dpr); g.font = '900 ' + px8 + 'px Impact, "Arial Black", "Trebuchet MS", sans-serif';
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineCap = 'round'; paint(g); return cv; };
    const comp = (a, b, alpha) => { const cv = document.createElement('canvas'); cv.width = a.width; cv.height = a.height; const g = cv.getContext('2d'); g.globalAlpha = alpha; g.drawImage(a, 0, 0); g.drawImage(b, 0, 0); return cv; };
    const diff = (a, b) => { const A = a.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, a.width, a.height).data, B = b.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, b.width, b.height).data; let s = 0, m = 0; for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); s += d; if (d > m) m = d; } return { mean: +(s / A.length).toFixed(4), max: m }; };
    o.same = {};
    for (const ch of ['8', ',']) {
      const sh = comp(pass1(S8, ch, (g) => { g.lineWidth = LX_GB_WHITE; g.strokeStyle = '#000'; g.strokeText(ch, 0, 0); }), pass1(S8, ch, (g) => { g.fillStyle = '#000'; g.fillText(ch, 0, 0); }), LX_GB_SHADOW_A);
      o.same['shadow' + ch] = diff(cellOf(S8, 0, ch), sh);
      const fl = comp(pass1(S8, ch, (g) => { g.fillStyle = col; g.fillText(ch, 0, 0); }), pass1(S8, ch, (g) => { g.lineWidth = LX_GB_DILATE; g.strokeStyle = col; g.strokeText(ch, 0, 0); }), 1);
      o.same['fill' + ch] = diff(cellOf(S8, S8.rows.length - 1, ch), fl);
    }
    _lxDnAtlasFree(S8.cv); _lxDnAtlasFree(N8.cv); _lxDnAtlasFree(N0.cv);
    // PREWARM: the tier in use first, both ladders cached together
    const keys = () => { const d = dpr(), out = []; for (const v of ['n', 's0']) for (let k = 0; k <= 8; k++) out.push('gb|' + b0 + '|' + pxK(k) + '|' + v + '|' + col + '|' + d); return out; };
    const purge = () => { for (const k of [..._LX_DN_ATLAS.keys()]) if (k.indexOf('gb|') === 0) { const a = _LX_DN_ATLAS.get(k); _LX_DN_ATLAS.delete(k); if (a) { _lxDnAtlasPx -= a.px; _lxDnAtlasFree(a.cv); } } for (const k of [..._lxDnWPend.keys()]) if (k.indexOf('gb|') === 0) _lxDnWPend.delete(k); };
    const waitAll = async (ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (keys().every((k) => _LX_DN_ATLAS.get(k))) return Math.round(performance.now() - t0); await sleep(50); } return -1; };
    const w = _lxDnWorker(), order = [], op = w.postMessage.bind(w); w.postMessage = function (j) { if (j && j.kind === 'gb') order.push(j.stress ? 's' : 'n'); return op.apply(null, arguments); };
    const vl = window._perfVeryLowFx;
    purge(); window._perfVeryLowFx = () => true; o.postedLow = _lxGbPrewarm(); o.firstLow = order.join('').slice(0, 9); window._perfVeryLowFx = vl;
    o.readyMs = await waitAll(20000);
    o.cachedMP = +(keys().reduce((s, k) => s + ((_LX_DN_ATLAS.get(k) || {}).px || 0), 0) / 1e6).toFixed(1); o.capMP = _LX_DN_ATLAS_MAX_PX / 1e6;
    purge(); order.length = 0; window._perfVeryLowFx = () => false; o.postedHigh = _lxGbPrewarm(); o.firstHigh = order.join('').slice(0, 9); window._perfVeryLowFx = vl;
    await waitAll(20000); w.postMessage = op;
    // IDLE: no boss here - 8 s without numbers trims
    const bossAlive = () => game.monsters.some((m) => m && m.currentHp > 0 && (m.isBoss || m.boss || m.zodiacBoss));
    game.damageNumbers = []; o.bossesForest = bossAlive();
    _lxDnAtlasIdleAt = ((game.time | 0) - 500) || -1; drawDamageNumbers(); o.idleNoBoss = { left: keys().filter((k) => _LX_DN_ATLAS.get(k)).length, px: +(_lxDnAtlasPx / 1e6).toFixed(1) };
    // ... and with one alive, it keeps them
    loadMap('krookThrone', 300); let boss = null; for (let i = 0; i < 100 && !boss; i++) { await sleep(100); boss = game.monsters.find((m) => m && (m.isBoss || m.boss) && m.currentHp > 0) || null; }
    o.boss = boss ? boss.type : null; o.bossReadyMs = await waitAll(20000);
    game.damageNumbers = []; _lxDnAtlasIdleAt = ((game.time | 0) - 500) || -1; drawDamageNumbers(); o.idleBoss = { left: keys().filter((k) => _LX_DN_ATLAS.get(k)).length, alive: bossAlive() };
    // FIGHT: kit bot for 10 s, sticker lookups vs misses
    player.hp = player.maxHp = 999999; player.maxMp = 99999; player.mp = 99999; player.skillCooldowns = player.skillCooldowns || {};
    const kit = Object.keys(SKILLS).filter((id) => { const s = SKILLS[id]; return s.cls === 'warrior' && (!s.job || s.job === player.job) && (!s.master || s.master === player.master); });
    let gets = 0, miss = 0; const og = window._lxGbAtlasGet; window._lxGbAtlasGet = function () { const a = og.apply(this, arguments); gets++; if (!a) miss++; return a; };
    let stop = false, last = 0; const tick = () => { if (stop) return; const m = game.monsters.find((x) => x && (x.isBoss || x.boss) && x.currentHp > 0);
      if (m) { player.x = m.x - 150; player.vx = 0; player.facing = 1; if (m.currentHp < m.maxHp * 0.35) m.currentHp = m.maxHp * 0.9; } player.hp = 999999; player.mp = 99999; if (game.paused) game.paused = false;
      for (const id of ['boss-intro-skip', 'plg-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) b.click(); }
      const now = performance.now(); if (now - last > 90) { last = now; for (const id of kit) if ((player.skillCooldowns[id] || 0) <= 0) { try { castSkill(id); } catch (e) {} } } requestAnimationFrame(tick); };
    requestAnimationFrame(tick); await sleep(10000); stop = true; window._lxGbAtlasGet = og;
    o.fight = { gets, miss };
    return o;
  });
  console.log(`build ${r.ver}`);
  console.log(`  rows ${JSON.stringify(r.rows)} star ${r.star} draws ${JSON.stringify(r.draws)} same ${JSON.stringify(r.same)}`);
  console.log(`  prewarm: very-low tier posted ${r.postedLow} (first ${r.firstLow}), normal tier posted ${r.postedHigh} (first ${r.firstHigh}); both ladders cached in ${r.readyMs} ms, ${r.cachedMP} MP of the ${r.capMP} MP cache`);
  console.log(`  idle: no boss (${r.bossesForest}) ${JSON.stringify(r.idleNoBoss)}; ${r.boss} alive (ladders ready in ${r.bossReadyMs} ms) ${JSON.stringify(r.idleBoss)}; fight ${JSON.stringify(r.fight)}`);
  ok('the stress sheet is four rows and the big normal one six, with no star cell', r.rows.s8 === 'shadow,white,black,fill' && r.rows.n8 === 'shadow,halo9,halo7,white,black,fill' && r.rows.n0 === 'shadow,white,black,fill' && !r.star && r.cellsOk, JSON.stringify(r.rows));
  ok('a six-glyph sticker is 24 draws on the stress sheet and 30 on the normal one (was 36 and 42)', r.draws.s8 === 24 && r.draws.n8 === 30, JSON.stringify(r.draws));
  ok('the merged rows hold exactly their two passes composited', Object.values(r.same).every((d) => d.max <= 2 && d.mean <= 0.05), JSON.stringify(r.same));
  ok('a boss spawn asks for both ladders, the tier in use first', r.postedLow === 18 && r.firstLow === 'sssssssss' && r.postedHigh === 18 && r.firstHigh === 'nnnnnnnnn', `${r.postedLow} ${r.firstLow} / ${r.postedHigh} ${r.firstHigh}`);
  ok('all eighteen sheets sit in the cache together', r.readyMs >= 0 && r.cachedMP > 0 && r.cachedMP < r.capMP * 0.8, `${r.readyMs} ms, ${r.cachedMP} MP`);
  ok('eight seconds without numbers trims the sheets with no boss about', r.bossesForest === false && r.idleNoBoss.left < 18 && r.idleNoBoss.px <= 6.5, JSON.stringify(r.idleNoBoss));
  ok('...and keeps them while a boss lives', !!r.boss && r.bossReadyMs >= 0 && r.idleBoss.left === 18 && r.idleBoss.alive, JSON.stringify(r.idleBoss));
  ok('a fight draws its stickers from the sheets', r.fight.gets >= 20 && r.fight.miss <= r.fight.gets * 0.1, JSON.stringify(r.fight));
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
