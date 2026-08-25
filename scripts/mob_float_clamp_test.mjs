#!/usr/bin/env node
// Which monsters are held OFF THE GROUND by the bury clamp?
// ============================================================================
// Per user, on the rebuilt smith golem: "now need to push smithgolem sprites 6
// pixels downwards to make it not float".
//
// The instinct was right and the literal instruction could not have worked.
// Shifting a sprite's pixels down cannot lower the mob, because the foot anchor
// IS the sprite's own ink bottom: raise bboxBottomY and dy compensates exactly.
// What lowers a mob is removing the empty canvas UNDER its feet, and the reason
// is _lxMobPlantDy's safety clamp:
//
//     if (dy + targetH > _BURY_MAX_PX) dy = _BURY_MAX_PX - targetH;   // 6 px
//
// dy + targetH is where the CANVAS bottom lands, not where the feet land. Floor
// padding pushes the canvas bottom down while the feet stay put, so a generously
// padded sprite trips a clamp meant to stop mobs sinking - and the clamp lifts
// the whole box, feet included. The golem had 94 empty rows below its ink (from
// FLOOR_MARGIN = 96 in the rebuild), worth 11.3 px of render space against a 6 px
// budget, so it hovered 5.3 px up. Every healthy mob measured has ZERO.
//
// The clamp is not the bug and must not be loosened - it is what keeps mobs out
// of the floor. The bug is art that spends more of the budget than it is given.
//
// Run against a live build; needs the probe server on :8766.
//   node scripts/mob_float_clamp_test.mjs
// ============================================================================
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const PORT = process.argv[2] || '8766';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!EXE) { console.error('Chrome not found'); process.exit(1); }

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://localhost:${PORT}/_mob_probe.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof player === 'object', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => {
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay','class-select-modal','advancement-modal','boot-gate','intro-overlay'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  game.paused = false; player.level = 60;
  if (typeof refreshGearCache === 'function') refreshGearCache();
  player.hp = getMaxHp(); player._god = true;
  try { loadMap('innerDimension'); } catch (e) {}
});
await page.waitForTimeout(2600);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }

const rows = await page.evaluate(() => {
  const out = [];
  for (const type of Object.keys(MONSTER_SPRITES)) {
    const stat = MONSTER_SPRITES[type];
    if (!stat || !stat.complete || !stat.naturalHeight) continue;
    let m; try { game.monsters.length = 0; m = spawnMonster(player.x + 220, player.y - 30, type, false); } catch (e) { continue; }
    // The engine OWN predicate, not a guess at it. A first pass here
    // filtered on m.flying - which does not exist; the field is m.flies -
    // and so reported eleven fliers and swimmers as floating bugs. Fliers
    // are SUPPOSED to hover, and _lxMobPlantDy skips the clamp for them.
    if (!m || _lxMobIsFloating(m)) continue;
    const meta = (typeof MONSTER_SPRITE_META === 'object') ? MONSTER_SPRITE_META[type] : null;
    const bb = meta && meta.bboxBottomY; if (bb == null) continue;
    const srcH = stat.naturalHeight;
    const sizeFactor = Math.max(0.85, Math.min(1.20, (stat._lxOrigLong || Math.max(stat.naturalWidth, srcH)) / 768));
    const mobScale = (typeof _lxMobScale === 'function' ? _lxMobScale(type) : 1) || 1;
    const targetH = m.h * 1.5 * sizeFactor * mobScale;
    const overhang = targetH * (GROUND_BURY_FRAC + (srcH - bb - 1) / srcH);
    out.push({ type, empty: srcH - bb - 1, srcH, overhang: +overhang.toFixed(2),
      lift: +Math.max(0, overhang - 6).toFixed(2) });
  }
  return out;
});
await b.close();

const float = rows.filter((r) => r.lift > 0.5).sort((a, b) => b.lift - a.lift);
console.log(`  ${rows.length} ground monsters measured; budget is 6.00 px of canvas below the feet.\n`);
console.log('  type                 empty rows   overhang   HOVERS BY');
for (const r of float) console.log('  ' + r.type.padEnd(20) + String(r.empty).padStart(9)
  + (r.overhang.toFixed(2) + ' px').padStart(12) + (r.lift.toFixed(2) + ' px').padStart(12));
if (!float.length) console.log('  (none — every ground monster plants its feet)');

const g = rows.find((r) => r.type === 'smithgolem');
console.log('');
if (!g) { console.error('  FAIL — smithgolem not measured'); process.exit(1); }
console.log(`  smithgolem: ${g.empty} empty rows, ${g.overhang.toFixed(2)} px overhang, hovers by ${g.lift.toFixed(2)} px`);
if (g.lift > 0.5) { console.error('  FAIL — smithgolem is still held up by the bury clamp'); process.exit(1); }
console.log('  PASS — smithgolem plants its feet');
if (float.length) console.log(`\n  ${float.length} other type(s) listed above for manual review — not failed here.`);
