#!/usr/bin/env node
// Does the band scan return EXACTLY what the full readback returned?
// ============================================================================
// _lxEdgeRows replaced three full-surface getImageData calls with a banded walk
// that stops at the first inked row from each end. That is only a safe trade if
// the answer is bit-identical, because these boxes drive boss content
// normalisation at a 2% threshold - a one-pixel disagreement is a visible size
// step on a ~900px titan.
//
// So this re-implements the ORIGINAL algorithm in the page (read everything,
// scan every row) and compares it against the shipped helper over every sprite
// the build has decoded, at all three alpha thresholds actually used:
// 64 (_spriteContentBox), 235 (_spriteBodyBox) and 30 (_lxBakeSeamlessTile).
//
//   node scripts/edge_rows_parity_test.mjs [page] [port]
// ============================================================================
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults

// the page defaults to the game itself (it was a hand-staged _perf_probe.html copy that no longer exists)
const PAGE = process.argv[2] || (process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html');
// PORT from the command line or the environment; with none given (or nothing listening there) this script starts the
// checkout's own serve.js on it - it used to need a hand-started server on a fixed port and failed without one.
let PORT = String(process.argv[3] || process.env.PORT || '');
{
  const { spawn: _sSpawn } = await import('node:child_process'); const _sNet = await import('node:net');
  const _sPath = await import('node:path'); const { fileURLToPath: _sF2P } = await import('node:url');
  const _sRoot = _sPath.resolve(_sPath.dirname(_sF2P(import.meta.url)), '..');
  const _sFree = (p) => new Promise((r) => { const sv = _sNet.createServer(); sv.once('error', () => r(false)); sv.once('listening', () => sv.close(() => r(true))); sv.listen(p, '127.0.0.1'); });
  if (!PORT) for (let p = 8767; p <= 8999 && !PORT; p++) if (await _sFree(p)) PORT = String(p);
  if (await _sFree(Number(PORT))) {
    const _srv = _sSpawn(process.execPath, [_sPath.join(_sRoot, 'serve.js'), PORT], { stdio: 'ignore', cwd: _sRoot });
    _srv.unref(); process.on('exit', () => { try { _srv.kill(); } catch (e) {} });
    await new Promise((r) => setTimeout(r, 1500));
  }
}
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!EXE) { console.error('Chrome not found'); process.exit(1); }

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://localhost:${PORT}/${PAGE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _lxEdgeRows === 'function', null, { timeout: 180000 });
// the real game decodes its art on demand (lazy-fx, v0.30.1234) and holds it at the title: release the hold and walk
// into a hunting map so there are decoded sprites to compare (the staged probe page used to preload them)
await page.evaluate(async () => {
  try { _lxBootGateDone = true; window._prologueActive = false; if (window._lxBootHold) window._lxBootHold.release('menu'); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  try { loadMap('forest'); } catch (e) {} game.paused = false;
});
await page.waitForTimeout(9000);

const R = await page.evaluate(async () => {
  // The ORIGINAL algorithm, verbatim in shape: read the whole surface, walk
  // every row from the top and every row from the bottom.
  function refEdgeRows(c, x0, y0, w, h, aMin) {
    const d = c.getImageData(x0, y0, w, h).data;
    let top = -1, bottom = -1;
    for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) { if (d[(y * w + x) * 4 + 3] > aMin) { top = y; break; } }
    for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) { if (d[(y * w + x) * 4 + 3] > aMin) { bottom = y; break; } }
    return top < 0 ? null : { top, bottom };
  }
  const imgs = [];
  const push = (o) => { for (const k in o) { const v = o[k];
    if (v && v.naturalWidth > 0) imgs.push({ k, img: v });
    else if (Array.isArray(v)) v.forEach((f, i) => { if (f && f.naturalWidth > 0) imgs.push({ k: k + '_' + i, img: f }); }); } };
  for (const name of ['MONSTER_SPRITES', 'BOSS_SPRITES', 'ZODIAC_SPRITES', 'BOSS_ATTACK_FRAMES',
                      'BOSS_IDLE_FRAMES', 'BOSS_WALK_FRAMES', 'ZODIAC_ATTACK_FRAMES',
                      'ZODIAC_CHARGE_FRAMES', 'TILE_SPRITES']) {
    try { const o = eval(name); if (o) push(o); } catch (e) {}
  }
  const seen = new Set(); const uniq = [];
  for (const e of imgs) { const s = e.img.src; if (seen.has(s)) continue; seen.add(s); uniq.push(e); }

  let checked = 0, mismatch = [];
  for (const { k, img } of uniq.slice(0, 260)) {
    const W = img.naturalWidth, H = img.naturalHeight;
    if (!W || !H) continue;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    for (const a of [30, 64, 235]) {
      const ref = refEdgeRows(c, 0, 0, W, H, a);
      const got = _lxEdgeRows(c, 0, 0, W, H, a);
      checked++;
      const same = (ref === null && got === null)
        || (ref && got && ref.top === got.top && ref.bottom === got.bottom);
      if (!same) mismatch.push({ k, a, ref, got, dims: W + 'x' + H });
    }
  }
  return { images: uniq.length, checked, mismatch: mismatch.slice(0, 10), nMis: mismatch.length };
});
await b.close();

console.log(`  ${R.images} distinct decoded images, ${R.checked} comparisons (3 alpha thresholds each)`);
if (R.nMis) {
  console.error(`\n  FAIL — ${R.nMis} disagreement(s) between the band scan and the full readback:`);
  for (const m of R.mismatch) console.error(`    ${m.k} (${m.dims}) alpha>${m.a}: full=${JSON.stringify(m.ref)} band=${JSON.stringify(m.got)}`);
  process.exit(1);
}
if (R.checked < 60) { console.error('\n  FAIL — too few images decoded to be meaningful'); process.exit(1); }
console.log('\n  PASS — the band scan is bit-identical to the full readback everywhere');
