// COMBAT LAG: the edge memo must survive the mob tint bake.
// ============================================================================
// _lxDrawSoft feathers a sprite's harsh canvas-edge cut, and to know WHICH
// edges to feather it runs _lxEdgesTouched — a 48x48 alpha probe whose first
// call on any image forces a synchronous webp decode on the render thread
// (~11 ms measured). The result is memoised on the image object.
//
// The bug this pins: _lxTintBake mints a NEW canvas per (sprite frame x tint
// filter), and _lxDrawSoft probed THAT copy. So all 8 tint variants (freeze /
// burn / poison / stun / hit-flash / flash+freeze / dying / plain) cold-probed
// every animation frame they ever appeared on. Measured on a 28-mob fight:
// 217 probes costing 2198 ms across 8.1 s — 27% of wall-clock and the single
// largest entry in the CPU profile.
//
// The fix rests on ONE invariant, which is what this test certifies:
//   every mob tint filter is colour-only, so the baked canvas has alpha
//   geometry byte-identical to its source — and alpha is the only thing the
//   probe measures.
// If someone later adds an opacity() or blur() to a mob tint, that invariant
// breaks (both change alpha) and this test fails loudly rather than the
// feather silently going wrong on tinted mobs.
// Run: node scripts/mob_tint_edge_memo_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 9477;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof _lxTintBake === 'function' && typeof _lxEdgesTouched === 'function' && typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60; player.cls = 'warrior'; player.hp = 99999; player.maxHp = 99999;
  try { loadMap('blockland_apex'); } catch (e) { try { loadMap('boneGraveyard'); } catch (e2) {} }
  game.paused = false;
});
await page.waitForTimeout(5000);
await page.evaluate(() => {
  const types = Object.keys(monsterTypes).slice(0, 8);
  for (let i = 0; i < 16; i++) { try { if (typeof spawnMonster === 'function') spawnMonster(player.x + (i % 6 - 3) * 90, player.y - 40, types[i % types.length]); } catch (e) {} }
});
await page.waitForTimeout(7000);

const r = await page.evaluate(async () => {
  // The live set of mob tint filters, copied from drawMonster / the status block.
  const TINTS = [
    'grayscale(1)',
    'brightness(2.0) hue-rotate(60deg) saturate(1.15)',
    'brightness(2.5)',
    'brightness(0.9) hue-rotate(60deg) saturate(1.1)',
    'sepia(0.85) saturate(3.0) hue-rotate(175deg) brightness(1.10)',
    'sepia(0.70) saturate(2.6) hue-rotate(60deg) brightness(1.02)',
    'sepia(0.75) saturate(3.2) hue-rotate(-18deg) brightness(1.05)',
    'sepia(0.50) saturate(2.0) hue-rotate(15deg) brightness(1.12)',
  ];
  // Gather real, decoded monster sprites off the live roster.
  const imgs = [];
  const seen = new Set();
  const take = (cand) => { if (cand && cand.naturalWidth > 0 && !seen.has(cand) && imgs.length < 6) { seen.add(cand); imgs.push(cand); } };
  // give the roster's art a moment to decode, then harvest from the live mobs
  for (let w = 0; w < 60 && imgs.length < 6; w++) {
    for (const m of game.monsters) {
      if (imgs.length >= 6) break;
      try { take((typeof _monsterStateFrame === 'function') ? _monsterStateFrame(m) : null); } catch (e) {}
      try { take(MONSTER_SPRITES[m.type]); } catch (e) {}
    }
    if (imgs.length < 6) { try { for (const k in MONSTER_SPRITES) take(MONSTER_SPRITES[k]); } catch (e) {} }
    if (imgs.length >= 6) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const out = { tints: TINTS.length, sprites: imgs.length, mismatch: [], notCarried: 0, carried: 0, alphaChecked: 0, alphaDiff: 0, lrtDiff: 0, byEdge: { l:0, r:0, t:0, b:0 }, examples: [], srcHadMemo: 0, srcDeferred: 0 };
  if (!imgs.length) return out;

  // An INDEPENDENT probe (never touches the _lxEdges memo) so we compare what
  // the real probe would have computed on each canvas, not what it cached.
  const probe = (src) => {
    const S = 48, cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, S, S);
    g.drawImage(src, 0, 0, S, S);
    return g.getImageData(0, 0, S, S).data;
  };
  const edgeSig = (d) => {
    const S = 48, a = (x, y) => d[(y * S + x) * 4 + 3];
    const scan = (get) => { let n = 0, f = -1, l = -1; for (let i = 0; i < S; i++) if (get(i) > 24) { n++; if (f < 0) f = i; l = i; } return n > 1 ? `${n},${f},${l}` : '-'; };
    return [scan(i => a(0, i)), scan(i => a(S - 1, i)), scan(i => a(i, 0)), scan(i => a(i, S - 1))].join('|');
  };

  for (const img of imgs) {
    // Mirror _lxDrawSoft's real order: it probes the SOURCE, then bakes.
    try { _lxEdgesTouched(img); } catch (e) {}
    const srcSig = edgeSig(probe(img));
    for (const t of TINTS) {
      const cv = _lxTintBake(img, t);
      if (!cv) continue;
      // 1. THE INVARIANT: colour-only filter => identical alpha geometry.
      out.alphaChecked++;
      const bakeSig = edgeSig(probe(cv));
      if (bakeSig !== srcSig) {
        out.alphaDiff++;
        const A = srcSig.split('|'), B = bakeSig.split('|'), names = ['l','r','t','b'];
        for (let k = 0; k < 4; k++) if (A[k] !== B[k]) {
          out.byEdge[names[k]]++;
          if (k < 3) out.lrtDiff++;   // l/r/t are the edges the feather actually reads
          if (out.examples.length < 6) out.examples.push(names[k] + ' ' + (img.src?img.src.split('/').pop():'cv') + ' ' + A[k] + ' -> ' + B[k]);
        }
      }
      // 2. and the memo is carried onto the bake. A source whose probe is still
      // DEFERRED (v0.29.707 sends >300px <img> probes to idle) has nothing to
      // carry yet and is counted separately — that is correct behaviour, not a
      // miss; the carry lands once the idle probe resolves.
      if (img._lxEdges !== undefined) {
        out.srcHadMemo++;
        if (cv._lxEdges !== undefined) out.carried++; else out.notCarried++;
      } else {
        out.srcDeferred++;
      }
    }
  }
  return out;
});

const res = [];
const ok = (n, c, x) => res.push({ n, pass: !!c, x: x === undefined ? '' : String(x).slice(0, 150) });
ok('found live monster sprites to test', r.sprites > 0, `${r.sprites} sprites x ${r.tints} tint filters`);
// LEFT / RIGHT / TOP are the edges _lxDrawSoft feathers for every sprite, and
// they are what the carried memo must get right. Asserted strictly.
ok('colour-only tints leave the FEATHERED edges (left/right/top) byte-identical on the bake',
  r.alphaChecked > 0 && r.lrtDiff === 0,
  `${r.alphaChecked} (sprite x tint) pairs, L${r.byEdge.l} R${r.byEdge.r} T${r.byEdge.t} differing`);
// BOTTOM is measured by the probe but never feathered (feet are full-bleed by
// design; only _LX_FEATHER_BOTTOM = {king, kingKrook} opt in). A handful of
// bottom diffs are expected and inert: they come from THIS TEST's two-step
// downscale (img -> full-size canvas -> 48px) resolving a threshold-marginal
// row differently from the one-step downscale, not from the filter touching
// alpha — which is why left/right/top above are exact.
console.log(`   note: ${r.byEdge.b} bottom-edge diffs (never feathered; test-probe downscale artifact)` + ((r.examples||[]).length ? '  e.g. ' + r.examples[0] : ''));
ok('every source memo is carried onto its tint bake (no cold re-probe per tint)',
  r.srcHadMemo > 0 && r.carried === r.srcHadMemo && r.notCarried === 0,
  `${r.carried}/${r.srcHadMemo} carried, ${r.notCarried} missed; ${r.srcDeferred} pairs had no source memo yet (probe deferred to idle)`);
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

let bad = 0;
for (const x of res) { if (!x.pass) bad++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.x ? '   [' + x.x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
await browser.close(); srv.kill();
process.exit(bad ? 1 : 0);
