// FIGHT LAG: no getImageData scan may fire during combat — the foot-anchor
// crosses the shrink bake instead.
// ============================================================================
// Per user: "reduce lag by reducing lag during damage calculation when
// fighting monsters and bosses".
//
// Measured first (scripts/_tmp probes, CDP sampling profiler): hitMonster's
// own arithmetic was 0.07ms/frame — the damage MATH was never the lag. 46% of
// all profile samples sat inside getImageData: _drawBossSprite's foot-anchor
// guard was raw-scanning the SHRINK-BAKED canvas of each boss frame at its
// first draw. The shrink bake changes dimensions, the bbox resolvers refused
// to answer through a different-sized source, a canvas has no src for the
// table to match, and no cache survives a rebake — so a Krook fight paid 16
// scans at 200-860ms each, 4.4s of synchronous GPU->CPU stalls landing
// exactly while the player trades hits. Fight fps measured 43 -> 61 with the
// road back to the source carried across the bake.
//
// The fix is arithmetic, not approximation: a uniform rescale scales every
// alpha feature by the same ratio, so the source's table row maps exactly.
// The aspect guard is what proves the copy was a rescale and not a crop.
// Run: node scripts/bbox_scan_fight_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9941);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6500);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'BboxScan').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

// ---- unit truth: a rescaled copy resolves through its source, exactly ------
const unit = await page.evaluate(() => {
  // build a source "image" with a known bbox and a 0.5x copy of it. The
  // naturalWidth/Height stamps mirror what _lxBitmapToCanvas puts on its
  // canvases — the raw scanner requires them, a bare canvas has neither.
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h; c.naturalWidth = w; c.naturalHeight = h; c.complete = true;
    return c;
  };
  const src = mk(200, 100);
  const g = src.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 20, 200, 60);   // opaque rows 20..79
  const half = mk(100, 50);
  half.getContext('2d').drawImage(src, 0, 0, 100, 50);
  half._lxBboxSrc = src;
  const crop = mk(200, 40);                            // NOT a uniform rescale
  crop.getContext('2d').drawImage(src, 0, 0);
  crop._lxBboxSrc = src;
  let rawCalls = 0;
  const origRaw = window._detectSpriteBboxBottomRaw;
  window._detectSpriteBboxBottomRaw = function () { rawCalls++; return origRaw.apply(this, arguments); };
  const srcBot = _detectSpriteBboxBottom(src);         // raw scan, once, on the source
  const rawAfterSrc = rawCalls;
  const halfBot = _detectSpriteBboxBottom(half);       // must resolve via ratio, no scan
  const rawAfterHalf = rawCalls;
  const srcTop = _detectSpriteBboxTop(src);
  const halfTop = _detectSpriteBboxTop(half);
  const cropBot = _detectSpriteBboxBottom(crop);       // aspect differs -> must SCAN, not guess
  const rawAfterCrop = rawCalls;
  window._detectSpriteBboxBottomRaw = origRaw;
  return { srcBot, halfBot, srcTop, halfTop, cropBot, rawAfterSrc, rawAfterHalf, rawAfterCrop };
});
ok('a half-size copy resolves its bottom row through the source, scaled exactly',
  unit.srcBot === 79 && unit.halfBot === 39,
  `src bottom ${unit.srcBot} -> half ${unit.halfBot} (79 * 50/100 = 39.5 -> row 39)`);
ok('...and its top row', unit.srcTop === 20 && unit.halfTop === 10,
  `src top ${unit.srcTop} -> half ${unit.halfTop}`);
ok('the copy resolution costs ZERO raw scans', unit.rawAfterHalf === unit.rawAfterSrc,
  `${unit.rawAfterHalf - unit.rawAfterSrc} scans for the half-size resolve`);
ok('a CROPPED copy (aspect changed) is refused and scanned — no wrong guesses',
  unit.rawAfterCrop > unit.rawAfterHalf && unit.cropBot === 39,
  `crop scanned (${unit.rawAfterCrop - unit.rawAfterHalf} scan), bottom ${unit.cropBot} on the 40px crop`);

// ---- the fight: a full Krook brawl with zero mid-combat readbacks ----------
const fight = await page.evaluate(async () => {
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1500));
  game.paused = false;
  player.level = 60; player._god = true; player.baseAtk = 400; player.mp = 9e9;
  game.monsters = [];
  try { spawnMonster(player.x + 350, player.y, 'kingKrook', true); } catch (e) {}
  const t = (game.mapData.spawns.find((sp) => sp && sp.type && !sp.boss) || {}).type;
  for (let k = 0; k < 14; k++) spawnMonster(player.x + 120 + (k % 7) * 70, player.y - (k > 6 ? 100 : 0), t, false);
  for (const m of game.monsters) { m.maxHp = m.currentHp = 9e12; m._px = m.x; m._py = m.y; }
  await new Promise((r) => setTimeout(r, 2500));   // settle: boot/idle-time work done

  let scans = 0, scanMs = 0;
  const proto = CanvasRenderingContext2D.prototype;
  const orig = proto.getImageData;
  proto.getImageData = function (...a) {
    const t0 = performance.now();
    const r = orig.apply(this, a);
    scans++; scanMs += performance.now() - t0;
    return r;
  };
  const sk = []; for (const id in SKILLS) if (SKILLS[id] && SKILLS[id].master === 'warlord') sk.push(id);
  const s0 = SKILLS[sk[0]];
  player.cls = s0.cls; player.job = s0.job; player.master = 'warlord';
  let frames = 0, worst = 0, last = performance.now();
  const t0 = performance.now();
  for (let i = 0; i < 600; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now();
    worst = Math.max(worst, now - last); last = now; frames++;
    for (const m of game.monsters) { m.currentHp = m.maxHp; if (m._px != null) { m.x = m._px; m.y = m._py; } m.vx = 0; }
    player.mp = 9e9; player.hp = getMaxHp();
    for (const id of sk) if (!(player.skillCooldowns[id] > 0)) { try { castSkill(id); } catch (e) {} }
    try { if (typeof performMelee === 'function') performMelee(); } catch (e) {}
  }
  proto.getImageData = orig;
  const fps = +(frames / (performance.now() - t0) * 1000).toFixed(1);
  game.monsters = [];
  return { scans, scanMs: +scanMs.toFixed(1), fps, worst: +worst.toFixed(0) };
});
// The boss cycles idle/walk/attack/stomp states across 10s of being hit, so
// every shrink-baked frame gets its first draw inside this window — the exact
// scenario that used to fire 16 scans totalling ~4.4s.
ok('ZERO getImageData readbacks during 10s of boss combat (was 16 totalling 4,400ms)',
  fight.scans === 0, `${fight.scans} scans, ${fight.scanMs}ms inside readbacks; worst frame ${fight.worst}ms`
    + ' (frame time itself is not asserted: headless-unaccelerated raster/decode noise'
    + ' produces occasional long frames with 0ms of readback in them — the contract'
    + ' of THIS fix is that none of a frame\'s time is a pixel readback)');
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
