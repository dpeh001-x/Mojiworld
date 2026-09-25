#!/usr/bin/env node
// Do boss frames stay sharp when the render scale RISES mid-session?
// ============================================================================
// Per user: "make sure bosses such as aetherion blur is fixed, check if other
// bosses suffer from similar problems".
//
// The frame-shrink path (_lxShrinkFrames) was held to be DPR-aware because its
// cap multiplies by the render scale — true at any FIXED scale. The hole was
// the transition: its v0.29.707 versioning re-opened a set when a SMALLER cap
// arrived, but a LARGER one returned early, so entering fullscreen (the
// commonest route to a big screen, per v0.30.238's own note) kept every boss
// frame at the old resolution and upscaled it onto the sharpened store.
// Aetherion, whose 1656px frames shrink to 1242 at a windowed scale of 1.5,
// came out with his ~750px body stretched across 1156 device pixels.
//
// This test reproduces exactly that: boot in a window (scale resolves to 1.5),
// draw several bosses so their frames bake, force the scale to 2, keep
// drawing, then walk EVERY boss/monster/zodiac frame store and flag any
// installed canvas smaller than what the new cap would bake from its source.
//
//   node scripts/boss_scale_transition_test.mjs [page] [port]
// ============================================================================
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = process.argv[3] || '8767';
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!EXE) { console.error('no Chromium'); process.exit(1); }

let pass = 0, fail = 0;
const ok = (name, cond, info) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 240) : ''));
  cond ? pass++ : fail++;
};

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
// dsf 1 on a 1498-wide window: the render scale resolves to ~1.5 via fitScale.
const page = await (await b.newContext({ viewport: { width: 1498, height: 886 }, deviceScaleFactor: 1 })).newPage();
await page.goto(`http://localhost:${PORT}/${PAGE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof player === 'object', null, { timeout: 180000 });
await page.waitForTimeout(8000);
await page.evaluate(() => {
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal', 'advancement-modal', 'boot-gate', 'intro-overlay'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  game.paused = false; player.level = 90;
  if (typeof refreshGearCache === 'function') refreshGearCache();
  player.hp = getMaxHp(); player._god = true;
  try { loadMap('innerDimension'); } catch (e) {}
});
await page.waitForTimeout(2600);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
// Spawn a spread of big bosses + zodiac + a plain mob, let them DRAW so their
// frame sets pass through _lxShrinkFrames under the windowed cap.
await page.evaluate(() => {
  game.monsters.length = 0;
  for (const t of ['aetherion', 'kingKrook', 'mooma', 'king', 'zodiac_taurus', 'skeleton']) {
    try { spawnMonster(player.x + 150 + Math.random() * 500, player.y - 40, t, true); } catch (e) {}
  }
});
await page.waitForTimeout(6000);

const scan = () => page.evaluate(() => {
  const cap720 = _lxShrinkCap(720);
  const flag = [];
  let canvases = 0, images = 0;
  const check = (label, arr, base) => {
    if (!arr) return;
    // The shrink base differs per call site (bosses 720, mob sets smaller) and
    // guessing it flagged healthy skeleton frames on this test's first run.
    // The game stamps the real base on the array (frames._lxBase); a set
    // without the stamp on an OLD build falls back to the guess, so the
    // fallback stays for the before/after comparison to run at all.
    const realBase = (arr._lxBase != null) ? arr._lxBase : base;
    const cap = _lxShrinkCap(realBase);
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      if (!f) continue;
      if (f.tagName !== 'CANVAS') { images++; continue; }
      canvases++;
      const src = f._lxSrc;
      const srcLong = src && src.naturalWidth > 0 ? Math.max(src.naturalWidth, src.naturalHeight) : null;
      const want = srcLong ? Math.min(srcLong, cap) : cap;
      const cur = Math.max(f.width, f.height);
      if (cur < want * 0.94) flag.push({ set: label, i, cur, want, srcLong });
    }
  };
  const stores = [
    ['BOSS_IDLE_FRAMES', 720], ['BOSS_WALK_FRAMES', 720], ['BOSS_ATTACK_FRAMES', 720],
    ['ZODIAC_IDLE_FRAMES', 720], ['ZODIAC_WALK_FRAMES', 720], ['ZODIAC_ATTACK_FRAMES', 720], ['ZODIAC_CHARGE_FRAMES', 720],
  ];
  for (const [name, base] of stores) {
    try {
      const S = eval(name);
      if (S) for (const k in S) check(name + '.' + k, S[k], base);
    } catch (e) {}
  }
  try { for (const k in MONSTER_FRAMES) for (const mode of ['idle', 'walk', 'attack']) check('MONSTER.' + k + '.' + mode, MONSTER_FRAMES[k][mode], 480); } catch (e) {}
  return { dpr: _LX_DPR, cap720, canvases, images, flagged: flag.slice(0, 10), nFlagged: flag.length };
});

const before = await scan();
console.log(`  windowed: dpr=${before.dpr} cap(720)=${before.cap720} — ${before.canvases} baked canvases, ${before.nFlagged} undersized (expected 0: the cap matches the bakes)`);

// THE TRANSITION — what entering fullscreen does.
await page.evaluate(() => { _lxApplyRenderScale(2); });
await page.waitForTimeout(9000);   // draw loop re-runs the shrink; async re-bakes drain
const after = await scan();
console.log(`  scaled up: dpr=${after.dpr} cap(720)=${after.cap720} — ${after.canvases} baked canvases, ${after.nFlagged} stored-but-undrawn at the old size (they re-bake on first draw)`);
// v0.30.x — WHAT IS DRAWN. This test used to fail on any stored canvas below the new cap. When it was written
// (v0.30.256) a boss set was baked only when drawn, so every stored canvas was one being drawn. Since the spawn-time
// bake queue (v0.30.775 / 790, "grav-smooth") a boss's poses are ALL baked when he spawns, so the poses he has not
// used since the switch sit at the old size until their first draw re-bakes them (_lxShrinkFrames; the stand-in
// holds the pose for the ~100-300 ms bake). Which sets were caught depended on what the bosses happened to do in the
// 9 s window: 37 frames on one run, 6 on the next, same build. The v0.30.256 promise is about what is DRAWN: every
// boss frame drawn in the six seconds after the switch settles must be a bake at the NEW cap (or its full source).
const drawn = await page.evaluate(async () => {
  const oD = window._drawBossSprite;
  const res = { draws: 0, bakes: 0, bad: [] };
  window._drawBossSprite = function (sprite, m) {
    res.draws++;
    const src = sprite && sprite.tagName === 'CANVAS' ? sprite._lxSrc : null;
    if (src && src.naturalWidth > 0) {   // a bake: is it the size the CURRENT cap would make from its source?
      const set = src._lxSet, base = Math.max((set && set._lxBase) || 720, (set && set._lxBaseMin) || 0);
      const srcLong = Math.max(src.naturalWidth, src.naturalHeight), want = Math.min(srcLong, _lxShrinkCap(base));
      const cur = Math.max(sprite.width, sprite.height);
      res.bakes++;
      if (cur < want * 0.94 && res.bad.length < 12) res.bad.push({ type: m && m.type, st: sprite._lxSt, cur, want, src: srcLong });
    }
    return oD.apply(this, arguments);
  };
  await new Promise((r) => setTimeout(r, 6000));
  window._drawBossSprite = oD;
  return res;
});
console.log(`  drawn after the switch: ${drawn.draws} boss draws (${drawn.bakes} from bakes), ${drawn.bad.length} from a bake older than the switch`);

ok('render scale actually rose (1.5 -> 2)', before.dpr < after.dpr && after.dpr === 2, { before: before.dpr, after: after.dpr });
ok('windowed bakes matched the windowed cap', before.nFlagged === 0, before.flagged);
ok('after the scale increase, bosses were drawn from bakes (the check below saw real frames)', drawn.bakes > 100, drawn);
ok('after the scale increase, every boss frame DRAWN is a bake at the new cap (stored, undrawn poses re-bake on first use)',
  drawn.bad.length === 0, { stale: drawn.bad, storedUndrawn: after.nFlagged });
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
