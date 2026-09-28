#!/usr/bin/env node
// Do the sprite caches bake at DEVICE resolution?
// ============================================================================
// Per the tester, with video, on a render-scale-2 machine: "king krook sprite
// looks blurry". v0.30.238 sharpened the backing store (devicePixelRatio x
// fitScale, cap 2) and every pre-scaled cache kept baking at LOGICAL size, so
// its canvas was upscaled ~2x onto the sharpened store — procedural art got
// crisper while every cached sprite went soft. This pins the fix:
//
//   1. _lxBakeDpr() reports the (quarter-bucketed) render scale;
//   2. a _getCachedScaledSprite bake is DEVICE-sized and stamps the logical
//      draw size the consumers rely on;
//   3. the backdrop bake (_lxBgScaled) is device-sized;
//   4. at render scale 1 nothing changes: bakes stay logical-sized.
//
//   node scripts/bake_dpr_test.mjs [page] [port]
// ============================================================================
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';

const PAGE = process.argv[2] || FILE;
const PORT = process.argv[3] || process.env.PORT || '8767';
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!EXE) { console.error('no Chromium'); process.exit(1); }

let pass = 0, fail = 0;
const ok = (name, cond, info) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 200) : ''));
  cond ? pass++ : fail++;
};

async function probe(dsf) {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
  const page = await (await b.newContext({ viewport: { width: 1498, height: 886 }, deviceScaleFactor: dsf })).newPage();
  await page.goto(`http://localhost:${PORT}/${PAGE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof player === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(7000);
  await page.evaluate(() => {
    window._lxBootGateDone = true; window._prologueActive = false;
    for (const id of ['loading-overlay', 'class-select-modal', 'advancement-modal', 'boot-gate', 'intro-overlay'])
      { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    game.paused = false; player.level = 60;
    if (typeof refreshGearCache === 'function') refreshGearCache();
    player.hp = getMaxHp(); player._god = true;
    try { loadMap('innerDimension'); } catch (e) {}
  });
  await page.waitForTimeout(2600);
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  await page.evaluate(() => {
    game.monsters.length = 0;
    try { spawnMonster(player.x + 200, player.y - 40, 'skeleton', false); } catch (e) {}
    // Every mob now has idle/walk/attack frame sets, and _getCachedScaledSprite is the STATIC-sprite path drawMonster
    // takes only while no state frame is ready. This probe used to rely on the skeleton's first draws landing before
    // its frames decoded - a race that stopped landing after v0.30.1192 (d0999692 moved the boss pre-derive off
    // loadMap, so frames are ready first). Pin the static path for this one mob instead, through the real draw.
    try {
      const _sf = window._monsterStateFrame;
      if (typeof _sf === 'function' && !_sf._lxBakeProbe) {
        window._monsterStateFrame = function (m) { return (m && m._lxBakeProbe) ? null : _sf.apply(this, arguments); };
        window._monsterStateFrame._lxBakeProbe = true;
      }
      const sk = game.monsters.find((q) => q && q.type === 'skeleton'); if (sk) sk._lxBakeProbe = true;
    } catch (e) {}
  });
  // The static path bakes only once MONSTER_SPRITES.skeleton has decoded (_lxBakeDownscaled returns null for an
  // incomplete image), and since v0.30.1205 lazy-art2 that sheet is parked until wanted - on a loaded machine it could
  // still be in flight after a fixed 2.5 s, so one pass saw an empty cache. Ask for it, then wait for the bake itself.
  await page.evaluate(() => { try { if (typeof _lxArt2WantMon === 'function') _lxArt2WantMon('skeleton', true); } catch (e) {} });
  await page.waitForFunction(() => { const s = (typeof MONSTER_SPRITES !== 'undefined') && MONSTER_SPRITES.skeleton;
    return !!(s && s.complete && s.naturalWidth > 0); }, null, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => { if (typeof _MOB_SPRITE_CACHE === 'undefined') return false;
    for (const k of _MOB_SPRITE_CACHE.keys()) if (k.indexOf('skeleton_') === 0) return true; return false; },
    null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);   // a few more frames on the minted cache
  const R = await page.evaluate(() => {
    const out = {
      dpr: (typeof _LX_DPR !== 'undefined') ? _LX_DPR : null,
      bakeDpr: (typeof _lxBakeDpr === 'function') ? _lxBakeDpr() : null,
      entries: [],
    };
    if (typeof _MOB_SPRITE_CACHE !== 'undefined') {
      for (const c of _MOB_SPRITE_CACHE.values()) {
        out.entries.push({ w: c.width, h: c.height, drawW: c._lxDrawW || null, drawH: c._lxDrawH || null });
        if (out.entries.length >= 5) break;
      }
    }
    // backdrop bake — the bg images are new Image() instances that never enter
    // the DOM, so document.images cannot see them. Ask the draw path directly:
    // _pickBGImage() returns the live plate and _lxBgScaled mints/returns its
    // bake for the given draw size.
    try {
      const plate = (typeof _pickBGImage === 'function') ? _pickBGImage() : null;
      if (plate && typeof _lxBgScaled === 'function') {
        const bk = _lxBgScaled(plate, 960, 560);
        out.bg = { baked: bk.width + 'x' + bk.height, isBaked: bk !== plate,
          natural: (plate.naturalWidth || plate.width) + 'x' + (plate.naturalHeight || plate.height) };
      } else out.bg = null;
    } catch (e) { out.bg = null; }
    return out;
  });
  await b.close();
  return R;
}

const hi = await probe(2);
ok('render scale resolves to 2 on the tester-shaped window', hi.dpr === 2, { dpr: hi.dpr });
ok('_lxBakeDpr reports it', hi.bakeDpr === 2, { bakeDpr: hi.bakeDpr });
const stamped = hi.entries.filter((e) => e.drawW != null);
ok('sprite-cache bakes are DEVICE-sized and stamp their logical size',
  stamped.length > 0 && stamped.every((e) => Math.abs(e.w - e.drawW * 2) <= 2 && Math.abs(e.h - e.drawH * 2) <= 2),
  hi.entries);
ok('the backdrop bake is device-sized (1920-wide for the 960 logical draw)',
  !!hi.bg && hi.bg.isBaked && parseInt(hi.bg.baked, 10) === 1920, hi.bg);

// A dsf-1 window is NOT render scale 1: the scale is dpr x fitScale (the
// v0.30.238 fix), so this 1498-wide window resolves to 1.5 even at dsf 1 —
// and the bake must follow THAT. The invariant is bake == logical x bakeDpr
// at whatever scale the game chose; "scale 1 changes nothing" falls out of
// the same formula when bakeDpr is 1. A first draft asserted bakeDpr === 1
// here and failed against a correct build.
const lo = await probe(1);
const okLow = lo.entries.filter((e) => e.drawW != null);
ok('at any other scale the bake still equals logical x bakeDpr (here ' + lo.bakeDpr + 'x)',
  lo.bakeDpr >= 1 && okLow.length > 0
    && okLow.every((e) => Math.abs(e.w - e.drawW * lo.bakeDpr) <= 2 && Math.abs(e.h - e.drawH * lo.bakeDpr) <= 2),
  { bakeDpr: lo.bakeDpr, entries: lo.entries });

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
