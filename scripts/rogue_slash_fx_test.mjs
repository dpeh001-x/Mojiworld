// The rogue's basic swings a real violet crescent, drawn procedurally.
// Per user: "incorporate better animation for the purple stab animation for
// rogue's basic attack such as the one attached in the image in purple."
// Run: node scripts/rogue_slash_fx_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9262;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(() => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'rogue'; player.level = 40; player.hp = 9e6; player.maxHp = 9e6;
  player._enh = null; player._warlordBanner = 0;
  if (player.mods) player.mods.diagSlash = 0;
  game.paused = false;
  loadMap('forest', 300);
  player.x = 500; player.y = 400; player.facing = 1;
  const pcx = player.x + player.w / 2;

  game.smoothFx = [];
  game.monsters.length = 0;
  try { SKILL_FNS.stab(); } catch (e) { return { err: String(e).slice(0, 160) }; }
  const fx = game.smoothFx || [];
  const arc = fx.filter(f => f && f.type === 'slash').pop() || null;
  const lance = fx.filter(f => f && f.type === 'stab').pop() || null;

  // does the class SPRITE path still claim this colour? (it must be bypassed)
  const bucket = (typeof _lxFxBucket === 'function') ? _lxFxBucket('#c07bff') : null;

  return {
    hasArc: !!arc,
    arc: arc ? { color: arc.color, edgeCol: arc.edgeCol, spread: arc.spread, thickness: arc.thickness,
                 life: arc.maxLife, noSprite: !!arc.noSprite, clean: !!arc.clean, bodyAlpha: arc.bodyAlpha,
                 originPastCentre: arc.x - pcx, length: arc.length } : null,
    lance: lance ? { length: lance.length, thickness: lance.thickness, color: lance.color } : null,
    bucketClaimsRogue: bucket === 'rogue',
    arcOuterPastCentre: arc ? (arc.x + arc.length + (arc.thickness || 0) / 2) - pcx : null,
  };
});
await browser.close(); server.kill();

ok('the rogue basic now spawns a swing arc at all', !out.err && out.hasArc, out.err || '');
if (out.hasArc) {
  ok('the arc is violet with a hot near-white cutting edge',
     out.arc.color === '#c07bff' && out.arc.edgeCol === '#fbf2ff',
     `${out.arc.color} -> ${out.arc.edgeCol}`);
  ok('the swing carries the sprite opt-out, so the emblem can never stamp it',
     out.arc.noSprite === true, `noSprite: ${out.arc.noSprite}`);
  // Recorded rather than assumed: the rogue basic's violet is NOT in
  // _LX_FX_ROGUE_COLORS, so the crescent-moon emblem was never in play for
  // this colour. noSprite is belt-and-braces for a future palette edit.
  ok('the basic\'s violet does not map to the emblem sprite today either',
     out.bucketClaimsRogue === false, `_lxFxBucket('#c07bff') buckets rogue: ${out.bucketClaimsRogue}`);
  // Tighter and shorter-lived than the warrior's (1.02pi over 18 frames): a
  // flick, not a heave. The blade is thick enough to actually read - a first
  // pass at 6px with 0.44 body alpha was measured on screen and was too faint
  // to see against a lit map, which is the whole point of the change.
  ok('it is shaped as a dagger flick, not a warrior heave',
     out.arc.spread < Math.PI * 0.75 && out.arc.life <= 14,
     `spread ${(out.arc.spread / Math.PI).toFixed(2)}pi, life ${out.arc.life}`);
  ok('the blade is bold enough to read on a lit map',
     out.arc.thickness >= 8 && out.arc.bodyAlpha >= 0.6,
     `thickness ${out.arc.thickness}, bodyAlpha ${out.arc.bodyAlpha}`);
  ok('the glint and speedlines stay on (that streak is the motion)',
     out.arc.clean === false, `clean: ${out.arc.clean}`);
  ok('the arc reaches the hit edge (~169px past centre), not short of it',
     out.arcOuterPastCentre > 140 && out.arcOuterPastCentre < 200,
     `${Math.round(out.arcOuterPastCentre)}px past centre`);
}
ok('the thrust lance survives, slimmed, as the core of the strike',
   !!out.lance && out.lance.length === 86 && out.lance.thickness === 5,
   out.lance ? `length ${out.lance.length}, thickness ${out.lance.thickness}` : 'no lance');

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
